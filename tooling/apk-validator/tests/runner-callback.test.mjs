import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

const workflow = (await readFile(new URL('../../../.github/workflows/apk-validator.yml', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const callbackStep = workflow.split('      - name: Return signed result\n')[1].split('      - name: Enforce validation outcome\n')[0];
const script = callbackStep.split('          script: |\n')[1].split('\n').map((line) => line.slice(12)).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runCallback = new AsyncFunction('require', 'process', 'core', 'fetch', 'setTimeout', script);

function fixture(result, replies = [{ ok: true, status: 200 }]) {
  const fs = {
    readFile: vi.fn(async () => {
      if (result === undefined) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      return JSON.stringify(result);
    }),
    writeFile: vi.fn(async () => {})
  };
  const core = { getIDToken: vi.fn(async () => 'fresh-token'), setSecret: vi.fn(), warning: vi.fn() };
  const fetch = vi.fn(async () => {
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { fs, core, fetch, run: () => runCallback(() => fs, {
    env: { HUB_ORIGIN: 'https://hub.example.com', CORRELATION_ID: '02586adf-1c19-47b0-99b6-97b0352dd841' }
  }, core, fetch, (resolve) => resolve()) };
}

describe('runner callback', () => {
  it('runs independently of checkout and setup, and selects supported Android tools', () => {
    expect(workflow.indexOf('id: identity')).toBeLessThan(workflow.indexOf('actions/checkout'));
    expect(workflow).toContain('packages: platform-tools');
    expect(workflow).toContain('run-name: APK validation ${{ inputs.correlation_id }}');
    expect(callbackStep).toContain('if: always()');
    expect(callbackStep).not.toContain('tooling/apk-validator');
  });

  it('reports an infrastructure failure without fabricated APK observations', async () => {
    const f = fixture();
    await f.run();
    const body = JSON.parse(f.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ status: 'failed', failureCodes: ['VALIDATOR_RUNNER_FAILED'] });
    expect(body).not.toHaveProperty('observed');
    expect(f.fs.writeFile).toHaveBeenCalledWith('result.json', JSON.stringify(body), { mode: 0o600 });
    expect(f.fetch.mock.calls[0][1].redirect).toBe('error');
  });

  it('preserves the complete APK result and refreshes the JWT on transport/5xx retries', async () => {
    const result = { status: 'succeeded', observed: { sha256: 'abc' }, failureCodes: [] };
    const f = fixture(result, [new Error('transport'), { ok: false, status: 503 }, { ok: true, status: 200 }]);
    await f.run();
    expect(f.fetch).toHaveBeenCalledTimes(3);
    expect(f.core.getIDToken).toHaveBeenCalledTimes(3);
    for (const [, request] of f.fetch.mock.calls) expect(JSON.parse(request.body)).toEqual(result);
    expect(f.fs.writeFile).not.toHaveBeenCalled();
  });

  it.each([401, 403, 409, 400])('does not retry or bypass HTTP %s', async (status) => {
    const f = fixture(undefined, [{ ok: false, status }]);
    await expect(f.run()).rejects.toThrow(`Validator callback HTTP ${status}`);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });

  it('bounds unsuccessful retries to three requests', async () => {
    const f = fixture(undefined, Array.from({ length: 3 }, () => ({ ok: false, status: 503 })));
    await expect(f.run()).rejects.toThrow('Validator callback HTTP 503');
    expect(f.fetch).toHaveBeenCalledTimes(3);
  });
});

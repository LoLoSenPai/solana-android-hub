import { generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { verifyOperationsGithubToken } from "../server/operations-github-oidc";

vi.mock("../server/runtime", () => ({ hubConfig: {} }));

const repository = "LoLoSenPai/solana-android-hub";
const policy = { workflowFile: "publication-health.yml", audience: "dapport-publication-health" };
const workflowRef = `${repository}/.github/workflows/publication-health.yml@refs/heads/main`;
const subject = `repo:${repository}:ref:refs/heads/main`;
const claims = {
  iss: "https://token.actions.githubusercontent.com", aud: policy.audience, sub: subject,
  repository, workflow_ref: workflowRef, ref: "refs/heads/main", event_name: "schedule", run_id: "123", run_attempt: "1"
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  [keys, otherKeys] = await Promise.all([generateKeyPair("RS256"), generateKeyPair("RS256")]);
});

function verify(overrides: JWTPayload = {}, { wrongSigner = false, missingExpiry = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, nbf: now, ...(missingExpiry ? {} : { exp: now + 300 }), ...claims, ...overrides };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256" })
    .sign(wrongSigner ? otherKeys.privateKey : keys.privateKey)
    .then((token) => verifyOperationsGithubToken(token, repository, policy, () => keys.publicKey));
}

describe("operations GitHub OIDC", () => {
  it.each(["schedule", "workflow_dispatch"])("accepts a signed token for the exact workflow on main via %s", async (eventName) => {
    expect(await verify({ event_name: eventName })).toEqual({ subject, runId: "123", runAttempt: "1" });
  });

  it.each([
    ["issuer", { iss: "https://other.example" }],
    ["audience", { aud: "dapport-apk-dispatcher" }],
    ["multi-audience", { aud: [policy.audience, "different-audience"] }],
    ["repository", { repository: "other/repo" }],
    ["branch", { ref: "refs/heads/feature" }],
    ["subject", { sub: `repo:${repository}:pull_request` }],
    ["workflow", { workflow_ref: workflowRef.replace("publication-health.yml", "apk-validator.yml") }],
    ["workflow branch", { workflow_ref: workflowRef.replace("refs/heads/main", "refs/heads/feature") }],
    ["reusable workflow", { job_workflow_ref: workflowRef.replace("publication-health.yml", "reusable.yml") }],
    ["event", { event_name: "pull_request" }],
    ["run", { run_id: "" }],
    ["attempt", { run_attempt: "0" }],
    ["expired", { exp: 1 }]
  ] satisfies Array<[string, JWTPayload]>)("rejects a token with unexpected %s", async (_description, overrides) => {
    expect(await verify(overrides)).toBeNull();
  });

  it("rejects a different signing key", async () => {
    expect(await verify({}, { wrongSigner: true })).toBeNull();
  });

  it("requires expiry", async () => {
    expect(await verify({}, { missingExpiry: true })).toBeNull();
  });
});

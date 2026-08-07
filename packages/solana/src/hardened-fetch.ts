import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export interface HardenedFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  resolveHostname?: (hostname: string) => Promise<readonly string[]>;
}

export async function fetchHardenedJson(url: string, options: HardenedFetchOptions = {}): Promise<unknown> {
  const resolveHostname = options.resolveHostname ?? resolvePublicAddresses;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let current = new URL(url);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const addresses = await assertSafeHttpsUrl(current, resolveHostname);
    const response = options.fetchImpl
      ? await options.fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs)
      })
      : await fetchPinnedResponse(current, addresses[0]!, timeoutMs);

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("METADATA_REDIRECT_REJECTED");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`METADATA_HTTP_${response.status}`);

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null && Number(contentLength) > maxBytes) throw new Error("METADATA_TOO_LARGE");
    const body = await readLimitedBody(response, maxBytes);
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
    } catch {
      throw new Error("METADATA_INVALID_JSON");
    }
  }
  throw new Error("METADATA_REDIRECT_REJECTED");
}

async function assertSafeHttpsUrl(
  url: URL,
  resolveHostname: (hostname: string) => Promise<readonly string[]>
): Promise<readonly string[]> {
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") throw new Error("UNSAFE_METADATA_URL");
  if (url.port !== "" && url.port !== "443") throw new Error("UNSAFE_METADATA_PORT");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) === 0 ? await resolveHostname(hostname) : [hostname];
  if (addresses.length === 0 || addresses.some(isNonPublicAddress)) throw new Error("UNSAFE_METADATA_ADDRESS");
  return addresses;
}

function fetchPinnedResponse(url: URL, address: string, timeoutMs: number): Promise<Response> {
  const family = isIP(address);
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      headers: { accept: "application/json", host: url.host },
      servername: url.hostname,
      lookup: (_hostname, lookupOptions, callback) => lookupOptions.all
        ? callback(null, [{ address, family }])
        : callback(null, address, family)
    }, (response) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(name, item);
        else if (value !== undefined) headers.set(name, value);
      }
      resolve(new Response(Readable.toWeb(response) as ReadableStream, { status: response.statusCode ?? 500, headers }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("METADATA_TIMEOUT")));
    request.on("error", reject);
    request.end();
  });
}

async function resolvePublicAddresses(hostname: string): Promise<readonly string[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
}

async function readLimitedBody(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("METADATA_TOO_LARGE");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function isNonPublicAddress(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isNonPublicAddress(normalized.slice(7));
  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const first = octets[0] ?? 0;
    const second = octets[1] ?? 0;
    const third = octets[2] ?? 0;
    return first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0 && (third === 0 || third === 2)) ||
      (first === 192 && second === 88 && third === 99) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113) ||
      (first === 198 && (second === 18 || second === 19));
  }
  if (isIP(normalized) === 6) {
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:");
  }
  return true;
}

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { execFile } from "node:child_process";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_APK_BYTES = 500 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export function validateManifestShape(value) {
  if (!value || typeof value !== "object") throw validatorError("MANIFEST_INVALID", "Manifest must be an object");
  const requiredStrings = ["runId", "apkUrl", "expectedSha256", "packageName", "versionCode", "certificateSha256"];
  for (const field of requiredStrings) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw validatorError("MANIFEST_INVALID", `Manifest field ${field} is invalid`);
    }
  }
  if (!Number.isSafeInteger(value.expectedSize) || value.expectedSize < 1 || value.expectedSize > MAX_APK_BYTES) {
    throw validatorError("MANIFEST_INVALID", "Manifest byte size is invalid");
  }
  if (!/^[0-9a-f]{64}$/u.test(value.expectedSha256) || !/^[0-9a-f]{64}$/u.test(value.certificateSha256)) {
    throw validatorError("MANIFEST_INVALID", "Manifest digest is invalid");
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/u.test(value.packageName)) {
    throw validatorError("MANIFEST_INVALID", "Manifest package is invalid");
  }
  if (!/^[1-9][0-9]*$/u.test(value.versionCode)) throw validatorError("MANIFEST_INVALID", "Manifest version code is invalid");
  if (!Number.isInteger(value.minSdk) || value.minSdk < 1 || value.minSdk > 100) {
    throw validatorError("MANIFEST_INVALID", "Manifest minSdk is invalid");
  }
  if (!Array.isArray(value.permissions) || value.permissions.some((permission) => typeof permission !== "string")) {
    throw validatorError("MANIFEST_INVALID", "Manifest permissions are invalid");
  }
  return Object.freeze({ ...value, permissions: [...new Set(value.permissions)].sort() });
}

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && c === 0) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/u.test(normalized)) return false;
    if (normalized.startsWith("ff") || normalized.startsWith("2001:db8:")) return false;
    if (normalized.startsWith("::ffff:")) return isPublicAddress(normalized.slice(7));
    return true;
  }
  return false;
}

export function compareObserved(expected, observed) {
  const failures = [];
  if (observed.byteSize !== expected.expectedSize) failures.push("APK_SIZE_MISMATCH");
  if (normalizeDigest(observed.sha256) !== expected.expectedSha256) failures.push("APK_HASH_MISMATCH");
  if (observed.packageName !== expected.packageName) failures.push("APK_PACKAGE_MISMATCH");
  if (String(observed.versionCode) !== expected.versionCode) failures.push("APK_VERSION_MISMATCH");
  if (observed.minSdk !== expected.minSdk) failures.push("APK_MIN_SDK_MISMATCH");
  if (normalizeDigest(observed.certificateSha256) !== expected.certificateSha256) failures.push("APK_CERTIFICATE_MISMATCH");
  const actualPermissions = [...new Set(observed.permissions ?? [])].sort();
  if (JSON.stringify(actualPermissions) !== JSON.stringify(expected.permissions)) failures.push("APK_PERMISSIONS_MISMATCH");
  return failures;
}

export async function validateApk(manifestInput, options = {}) {
  const manifest = validateManifestShape(manifestInput);
  const workDirectory = await mkdtemp(join(tmpdir(), "hub-apk-validator-"));
  const apkPath = join(workDirectory, "candidate.apk");
  try {
    const download = await downloadApk(manifest.apkUrl, apkPath, manifest.expectedSize, options.fetchImpl);
    const failures = [];
    if (download.byteSize !== manifest.expectedSize) failures.push("APK_SIZE_MISMATCH");
    if (download.sha256 !== manifest.expectedSha256) failures.push("APK_HASH_MISMATCH");
    if (failures.length > 0) return failureResult(manifest.runId, failures, download);

    const inspected = await inspectApk(apkPath, options);
    const observed = { ...download, ...inspected };
    failures.push(...compareObserved(manifest, observed));
    return failures.length === 0
      ? { runId: manifest.runId, status: "succeeded", observed, failureCodes: [], toolVersions: inspected.toolVersions }
      : failureResult(manifest.runId, failures, observed, inspected.toolVersions);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "VALIDATOR_INTERNAL_ERROR";
    return failureResult(manifest.runId, [code], undefined, undefined, error instanceof Error ? error.message : "Validation failed");
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

async function downloadApk(initialUrl, apkPath, expectedSize, fetchImpl) {
  let current = new URL(initialUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const addresses = await resolvePublicHttps(current);
    const response = fetchImpl
      ? await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/vnd.android.package-archive, application/octet-stream" }
      })
      : await requestPinned(current, addresses[0]);
    const status = "status" in response ? response.status : response.statusCode ?? 0;
    const header = (name) => typeof response.headers.get === "function"
      ? response.headers.get(name)
      : Array.isArray(response.headers[name]) ? response.headers[name][0] ?? null : response.headers[name] ?? null;
    if ([301, 302, 303, 307, 308].includes(status)) {
      if (redirect === MAX_REDIRECTS) throw validatorError("APK_REDIRECT_LIMIT", "APK redirect limit exceeded");
      const location = header("location");
      if (!location) throw validatorError("APK_REDIRECT_INVALID", "APK redirect has no location");
      current = new URL(location, current);
      continue;
    }
    const ok = "ok" in response ? response.ok : status >= 200 && status <= 299;
    const body = "body" in response && response.body ? response.body : response;
    if (!ok || !(Symbol.asyncIterator in body)) throw validatorError("APK_DOWNLOAD_HTTP", `APK download returned ${status}`);
    const advertisedSize = Number(header("content-length"));
    if (Number.isFinite(advertisedSize) && advertisedSize > expectedSize) throw validatorError("APK_TOO_LARGE", "APK exceeds expected size");
    return writeBodyToFile(body, apkPath, expectedSize);
  }
  throw validatorError("APK_REDIRECT_INVALID", "APK redirect could not be resolved");
}

async function resolvePublicHttps(url) {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw validatorError("APK_URL_UNSAFE", "APK URL must be credential-free HTTPS on port 443");
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw validatorError("APK_ADDRESS_UNSAFE", "APK URL resolves to a non-public address");
  }
  return addresses;
}

function requestPinned(url, resolved) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      headers: { accept: "application/vnd.android.package-archive, application/octet-stream", host: url.host },
      servername: url.hostname,
      lookup: (_hostname, options, callback) => options?.all
        ? callback(null, [resolved])
        : callback(null, resolved.address, resolved.family)
    }, resolve);
    request.setTimeout(30_000, () => request.destroy(validatorError("APK_DOWNLOAD_TIMEOUT", "APK request timed out")));
    request.on("error", reject);
    request.end();
  });
}

async function writeBodyToFile(body, apkPath, expectedSize) {
  const digest = createHash("sha256");
  const file = await open(apkPath, "wx", 0o600);
  let byteSize = 0;
  try {
    for await (const chunk of body) {
      const bytes = Buffer.from(chunk);
      byteSize += bytes.length;
      if (byteSize > expectedSize || byteSize > MAX_APK_BYTES) throw validatorError("APK_TOO_LARGE", "APK exceeds expected size");
      digest.update(bytes);
      await file.write(bytes);
    }
  } finally {
    await file.close();
  }
  return { byteSize, sha256: digest.digest("hex") };
}

async function inspectApk(apkPath, options) {
  const apksigner = options.apksigner ?? process.env.APKSIGNER ?? "apksigner";
  const aapt2 = options.aapt2 ?? process.env.AAPT2 ?? "aapt2";
  let signatureOutput;
  try {
    signatureOutput = (await runExecutable(apksigner, ["verify", "--verbose", "--print-certs", apkPath], 60_000)).stdout;
  } catch (error) {
    throw validatorError("APK_SIGNATURE_INVALID", error instanceof Error ? error.message : "apksig rejected APK");
  }
  const certificateMatches = [...signatureOutput.matchAll(/Signer #\d+ certificate SHA-256 digest:\s*([0-9a-f:]+)/giu)];
  if (certificateMatches.length !== 1 || !certificateMatches[0]?.[1]) {
    throw validatorError("APK_SIGNER_UNSUPPORTED", "Exactly one current signer is required");
  }
  const [badging, apksignerVersion, aapt2Version] = await Promise.all([
    analyzer(aapt2, ["dump", "badging", apkPath]),
    toolVersion(apksigner),
    toolVersion(aapt2)
  ]);
  const packageMatch = badging.match(/^package: name='([^']+)' versionCode='([^']+)'/mu);
  const minSdkMatch = badging.match(/^minSdkVersion:'([0-9]+)'/mu);
  if (!packageMatch?.[1] || !packageMatch[2] || !minSdkMatch?.[1]) {
    throw validatorError("APK_MANIFEST_INVALID", "aapt2 could not extract package identity");
  }
  const permissions = [...badging.matchAll(/^uses-permission(?:-sdk-[0-9]+)?: name='([^']+)'/gmu)]
    .map((match) => match[1]).filter(Boolean).sort();
  return {
    packageName: packageMatch[1],
    versionCode: packageMatch[2],
    minSdk: Number(minSdkMatch[1]),
    certificateSha256: normalizeDigest(certificateMatches[0][1]),
    permissions,
    toolVersions: { apksigner: apksignerVersion, aapt2: aapt2Version }
  };
}

async function analyzer(binary, args) {
  try {
    return (await runExecutable(binary, args, 60_000)).stdout.trim();
  } catch (error) {
    throw validatorError("APK_MANIFEST_INVALID", error instanceof Error ? error.message : "aapt2 rejected APK");
  }
}

async function toolVersion(binary) {
  try {
    const result = await runExecutable(binary, ["--version"], 10_000);
    return `${result.stdout}${result.stderr}`.trim().slice(0, 200);
  } catch {
    return "unknown";
  }
}

function runExecutable(binary, args, timeout) {
  const windowsBatch = process.platform === "win32" && /\.(?:bat|cmd)$/iu.test(binary);
  return execFileAsync(binary, args, { timeout, shell: windowsBatch });
}

function failureResult(runId, failureCodes, observed, toolVersions, detail) {
  return {
    runId,
    status: "failed",
    ...(observed ? { observed } : {}),
    failureCodes: [...new Set(failureCodes)],
    ...(toolVersions ? { toolVersions } : {}),
    ...(detail ? { detail: detail.slice(0, 500) } : {})
  };
}

function normalizeDigest(value) {
  return typeof value === "string" ? value.replaceAll(":", "").trim().toLowerCase() : "";
}

function validatorError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function main() {
  const [manifestPath, resultPath] = process.argv.slice(2);
  if (!manifestPath || !resultPath) throw new Error("Usage: validate.mjs <manifest.json> <result.json>");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = await validateApk(manifest);
  await writeFile(resultPath, `${JSON.stringify(result)}\n`, { mode: 0o600 });
  if (result.status !== "succeeded") process.exitCode = 1;
}

if (process.argv[1] && new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/u, (value) => value.slice(1)) === process.argv[1].replaceAll("\\", "/")) {
  await main();
}

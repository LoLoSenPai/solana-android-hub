import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";

// Only the shared dispatcher leases queue records, including when a wake-up is
// accepted by GitHub but its response is lost before reaching the application.
export async function wakeApkDispatcher(repository: string, correlationId: string): Promise<boolean> {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId && !installationId && !privateKey) return false;

  let stage = "configuration";
  let httpStatus: number | undefined;
  try {
    if (!appId || !installationId || !privateKey || !/^\d+$/u.test(appId) || !/^\d+$/u.test(installationId)) {
      throw new Error("Incomplete GitHub App configuration");
    }
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(appId)
      .setIssuedAt(now - 60)
      .setExpirationTime(now + 300)
      .sign(createPrivateKey(privateKey.replaceAll("\\n", "\n")));

    const signal = AbortSignal.timeout(5_000);
    const headers = {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    };
    stage = "installation_token";
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { ...headers, authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ repositories: [repository.split("/")[1]], permissions: { actions: "write" } })
    });
    if (response.status !== 201) {
      httpStatus = response.status;
      throw new Error("GitHub App token request failed");
    }
    const { token } = await response.json() as { token?: unknown };
    if (typeof token !== "string" || !token) throw new Error("Missing GitHub App installation token");

    stage = "workflow_dispatch";
    const dispatch = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/dispatch-apks.yml/dispatches`, {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { ...headers, authorization: `Bearer ${token}` },
      body: JSON.stringify({ ref: "main", inputs: { correlation_id: correlationId } })
    });
    if (dispatch.status !== 200 && dispatch.status !== 204) {
      httpStatus = dispatch.status;
      throw new Error("GitHub dispatcher wake-up failed");
    }
    return true;
  } catch {
    // Do not log response bodies or exceptions that could contain credentials.
    console.warn("apk_dispatcher_wakeup_failed", { correlationId, stage, httpStatus });
    return false;
  }
}

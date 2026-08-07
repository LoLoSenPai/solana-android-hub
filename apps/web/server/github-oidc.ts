import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { hubConfig } from "./runtime";

const issuer = "https://token.actions.githubusercontent.com";
const githubJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));

export interface GithubActionsIdentity {
  subject: string;
  replayKeyHash: string;
  claims: JWTPayload;
}

export async function authenticateGithubActions(request: Request): Promise<GithubActionsIdentity | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/u)?.[1];
  if (!token || !hubConfig.githubRepository) return null;
  try {
    const { payload } = await jwtVerify(token, githubJwks, {
      issuer,
      audience: hubConfig.githubOidcAudience,
      algorithms: ["RS256"]
    });
    const identity = validateGithubClaims(payload, hubConfig.githubRepository);
    return identity ? { ...identity, claims: payload } : null;
  } catch {
    return null;
  }
}

export function validateGithubClaims(payload: JWTPayload, expectedRepository: string): Omit<GithubActionsIdentity, "claims"> | null {
  const repository = stringClaim(payload, "repository");
  const workflowRef = stringClaim(payload, "job_workflow_ref") ?? stringClaim(payload, "workflow_ref");
  const eventName = stringClaim(payload, "event_name");
  const subject = payload.sub;
  const runId = stringClaim(payload, "run_id");
  const runAttempt = stringClaim(payload, "run_attempt") ?? "1";
  if (repository !== expectedRepository || !subject || !runId || eventName !== "workflow_dispatch") return null;
  if (!workflowRef?.startsWith(`${expectedRepository}/.github/workflows/apk-validator.yml@`)) return null;
  return {
    subject,
    replayKeyHash: createHash("sha256").update(`${subject}|${runId}|${runAttempt}`, "utf8").digest("hex")
  };
}

function stringClaim(payload: JWTPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

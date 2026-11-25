import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { hubConfig } from "./runtime";

const issuer = "https://token.actions.githubusercontent.com";
const githubJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
const ref = "refs/heads/main";
// GitHub includes these immutable IDs in the production repository's default subject.
const productionOwnerId = "87042754";
const productionRepositoryId = "1327221601";

interface WorkflowPolicy {
  workflowFile: string;
  audience: string;
}

interface OperationsGithubIdentity {
  subject: string;
  runId: string;
  runAttempt: string;
}

export async function authenticateOperationsGithubActions(
  request: Request, policy: WorkflowPolicy
): Promise<OperationsGithubIdentity | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._-]+)$/u)?.[1];
  if (!token || !hubConfig.githubRepository) return null;
  return verifyOperationsGithubToken(token, hubConfig.githubRepository, policy, githubJwks);
}

export async function verifyOperationsGithubToken(
  token: string, repository: string, policy: WorkflowPolicy, getKey: JWTVerifyGetKey
): Promise<OperationsGithubIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer,
      audience: policy.audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "nbf", "exp"],
      maxTokenAge: "10 minutes",
      clockTolerance: "5 seconds"
    });
    const workflowRef = `${repository}/.github/workflows/${policy.workflowFile}@${ref}`;
    const [owner, name] = repository.split("/");
    const subject = `repo:${owner}@${productionOwnerId}/${name}@${productionRepositoryId}:ref:${ref}`;
    const { run_id: runId, run_attempt: runAttempt } = payload;
    if (payload.aud !== policy.audience || payload.repository !== repository || payload.ref !== ref || payload.sub !== subject
      || payload.repository_id !== productionRepositoryId || payload.repository_owner_id !== productionOwnerId
      || payload.workflow_ref !== workflowRef || (payload.job_workflow_ref !== undefined && payload.job_workflow_ref !== workflowRef)
      || (payload.event_name !== "schedule" && payload.event_name !== "workflow_dispatch")
      || typeof runId !== "string" || !/^[1-9][0-9]*$/u.test(runId)
      || typeof runAttempt !== "string" || !/^[1-9][0-9]*$/u.test(runAttempt)) return null;
    return { subject, runId, runAttempt };
  } catch {
    return null;
  }
}

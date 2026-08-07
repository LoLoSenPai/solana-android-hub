import { describe, expect, it } from "vitest";
import { validateGithubClaims } from "../server/github-oidc";

const repository = "example/solana-hub";
const claims = {
  sub: "repo:example/solana-hub:ref:refs/heads/main",
  repository,
  event_name: "workflow_dispatch",
  run_id: "1234",
  run_attempt: "1",
  job_workflow_ref: `${repository}/.github/workflows/apk-validator.yml@refs/heads/main`
};

describe("GitHub Actions OIDC policy", () => {
  it("binds repository, workflow, event, run, and attempt", () => {
    const identity = validateGithubClaims(claims, repository);
    expect(identity?.subject).toBe(claims.sub);
    expect(identity?.replayKeyHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(validateGithubClaims({ ...claims, run_attempt: "2" }, repository)?.replayKeyHash).not.toBe(identity?.replayKeyHash);
  });

  it("rejects a different repository, workflow, or event", () => {
    expect(validateGithubClaims(claims, "attacker/repo")).toBeNull();
    expect(validateGithubClaims({ ...claims, event_name: "pull_request" }, repository)).toBeNull();
    expect(validateGithubClaims({ ...claims, job_workflow_ref: `${repository}/.github/workflows/ci.yml@refs/heads/main` }, repository)).toBeNull();
  });
});

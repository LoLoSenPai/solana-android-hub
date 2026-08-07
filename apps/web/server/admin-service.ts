import { AdminRepository, type SessionRecord } from "@hub/database";
import { database, hubConfig } from "./runtime";

const repository = new AdminRepository(database);

export function isAdmin(session: SessionRecord | null): session is SessionRecord {
  return session !== null && hubConfig.adminWallets.has(session.walletAddress);
}

export async function getAdminOverview(session: SessionRecord) {
  requireAdmin(session);
  return repository.overview();
}

export async function setReleaseApproval(session: SessionRecord, input: {
  releaseId: string;
  status: "verified_approved" | "rejected";
  sourceReference: string;
  evidence: Record<string, unknown>;
  reason: string;
  requestId: string;
}) {
  requireAdmin(session);
  return repository.setApproval({
    ...input,
    evidenceJson: JSON.stringify(input.evidence),
    actorWallet: session.walletAddress
  });
}

export async function suspendApp(session: SessionRecord, input: { appId: string; reason: string; requestId: string }) {
  requireAdmin(session);
  return repository.suspendApp({ ...input, actorWallet: session.walletAddress });
}

function requireAdmin(session: SessionRecord): void {
  if (!hubConfig.adminWallets.has(session.walletAddress)) throw new Error("ADMIN_REQUIRED");
}

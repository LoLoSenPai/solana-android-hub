import { createHmac } from "node:crypto";
import { SecurityRepository } from "@hub/database";
import { database, hubConfig } from "./runtime";

const repository = new SecurityRepository(database);
const pepper = hubConfig.sessionPepper ?? "local-development-session-pepper-v1";

export async function enforceRateLimit(input: {
  request: Request;
  routeClass: "auth_challenge" | "auth_verify" | "publisher_discovery" | "publisher_mutation";
  subject?: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const now = Date.now();
  const windowMilliseconds = input.windowSeconds * 1000;
  const bucketStart = new Date(Math.floor(now / windowMilliseconds) * windowMilliseconds);
  const ip = clientAddress(input.request);
  const subject = `${input.routeClass}|${ip}|${input.subject ?? "anonymous"}`;
  const result = await repository.consumeRateLimit({
    subjectHash: createHmac("sha256", pepper).update(subject, "utf8").digest(),
    routeClass: input.routeClass,
    bucketStart,
    expiresAt: new Date(bucketStart.getTime() + windowMilliseconds * 2),
    limit: input.limit
  });
  return result.allowed;
}

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthRepository, type SessionRecord } from "@hub/database";
import { buildAuthenticationMessage } from "@hub/domain";
import { normalizeSolanaAddress, verifyWalletSignature } from "@hub/solana";
import { cookies } from "next/headers";
import { database, hubConfig } from "./runtime";

const SESSION_COOKIE = "hub_session";
const CSRF_COOKIE = "hub_csrf";
const authRepository = new AuthRepository(database);
const sessionPepper = hubConfig.sessionPepper ?? "local-development-session-pepper-v1";

export interface CreatedSession {
  session: SessionRecord;
  token: string;
  csrfToken: string;
}

export async function createAuthenticationChallenge(walletInput: string) {
  const wallet = normalizeSolanaAddress(walletInput);
  const nonce = randomBytes(32).toString("base64url");
  const issuedAt = floorToSecond(new Date());
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60_000);
  const message = buildAuthenticationMessage({
    environment: hubConfig.appEnvironment,
    origin: hubConfig.hubOrigin,
    wallet,
    nonce,
    issuedAt: issuedAt.toISOString().replace(".000Z", "Z"),
    expiresAt: expiresAt.toISOString().replace(".000Z", "Z")
  });
  const challenge = await authRepository.createChallenge({
    walletAddress: wallet,
    purpose: "authentication",
    environment: hubConfig.appEnvironment,
    nonceHash: sha256(nonce),
    message,
    expiresAt
  });
  return { challengeId: challenge.id, message, expiresAt: expiresAt.toISOString() };
}

export async function verifyAuthenticationChallenge(challengeId: string, signatureBase64Url: string): Promise<CreatedSession | null> {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const absoluteExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const session = await authRepository.authenticate({
    challengeId,
    expectedEnvironment: hubConfig.appEnvironment,
    tokenHash: hashSecret(token),
    csrfHash: hashSecret(csrfToken),
    idleExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    absoluteExpiresAt,
    verify: (wallet, message) => verifyWalletSignature({ wallet, message, signatureBase64Url })
  });
  return session ? { session, token, csrfToken } : null;
}

export async function setSessionCookies(created: CreatedSession): Promise<void> {
  const cookieStore = await cookies();
  const secure = hubConfig.appEnvironment !== "local";
  cookieStore.set(SESSION_COOKIE, created.token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: created.session.absoluteExpiresAt
  });
  cookieStore.set(CSRF_COOKIE, created.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    expires: created.session.absoluteExpiresAt
  });
}

export async function getCurrentSession(request?: Request, requireCsrf = false): Promise<SessionRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await authRepository.getSession(hashSecret(token));
  if (!session || !requireCsrf) return session;
  const csrfCookie = cookieStore.get(CSRF_COOKIE)?.value;
  const csrfHeader = request?.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) return null;
  const observed = hashSecret(csrfHeader);
  return observed.length === session.csrfHash.length && timingSafeEqual(observed, session.csrfHash) ? session : null;
}

export async function logoutCurrentSession(): Promise<void> {
  const session = await getCurrentSession();
  if (session) await authRepository.revokeSession(session.id);
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export function hashSecret(value: string): Buffer {
  return createHmac("sha256", sessionPepper).update(value, "utf8").digest();
}

export function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function floorToSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

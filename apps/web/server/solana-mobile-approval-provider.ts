import type {
  OfficialStoreReleaseLookup,
  OfficialStoreSystemContext,
  SolanaMobileApprovalProvider
} from "@hub/domain";
import { z } from "zod";

export const SOLANA_MOBILE_GRAPHQL_ENDPOINT = "https://dappstore.solanamobile.com/graphql";

export const SEEKER_STORE_CONTEXT: OfficialStoreSystemContext = {
  locale: "en-US",
  platformSdk: 34,
  pixelDensity: 480,
  model: "SEEKER"
};

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const androidPackageSchema = z.string().trim().min(3).max(255)
  .regex(/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/);
const responseSchema = z.object({
  data: z.object({
    dAppByAndroidPackage: z.object({
      androidPackage: androidPackageSchema,
      lastRelease: z.object({
        androidDetails: z.object({
          versionCode: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
        }).nullable()
      }).nullable()
    }).nullable()
  }).nullable().optional(),
  errors: z.array(z.object({ message: z.string().optional() }).passthrough()).optional()
}).passthrough();

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class OfficialSolanaMobileApprovalProvider implements SolanaMobileApprovalProvider {
  public constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async lookupLatestVisibleRelease(androidPackage: string): Promise<OfficialStoreReleaseLookup> {
    const checkedAt = this.now().toISOString();
    const parsedPackage = androidPackageSchema.safeParse(androidPackage);
    if (!parsedPackage.success) return unavailable(androidPackage, checkedAt, "INVALID_ANDROID_PACKAGE");

    try {
      const response = await this.fetchImpl(SOLANA_MOBILE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: "https://dapport.app",
          referer: "https://dapport.app/",
          "user-agent": "Dapport/1.0 (+https://dapport.app)"
        },
        body: JSON.stringify({ query: buildLookupQuery(parsedPackage.data) }),
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!response.ok) return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_HTTP_ERROR");

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_RESPONSE_TOO_LARGE");
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
        return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_RESPONSE_TOO_LARGE");
      }

      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_INVALID_JSON");
      }
      const parsed = responseSchema.safeParse(json);
      if (!parsed.success) return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_INVALID_RESPONSE");
      if (parsed.data.errors?.length) return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_GRAPHQL_ERROR");
      if (!parsed.data.data) return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_MISSING_DATA");

      const app = parsed.data.data.dAppByAndroidPackage;
      if (!app?.lastRelease?.androidDetails) {
        return {
          status: "not_visible",
          androidPackage: parsedPackage.data,
          checkedAt,
          systemContext: SEEKER_STORE_CONTEXT,
          sourceReference: SOLANA_MOBILE_GRAPHQL_ENDPOINT
        };
      }
      if (app.androidPackage !== parsedPackage.data) {
        return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_PACKAGE_MISMATCH");
      }
      return {
        status: "visible",
        androidPackage: app.androidPackage,
        versionCode: BigInt(app.lastRelease.androidDetails.versionCode),
        checkedAt,
        systemContext: SEEKER_STORE_CONTEXT,
        sourceReference: SOLANA_MOBILE_GRAPHQL_ENDPOINT
      };
    } catch {
      return unavailable(parsedPackage.data, checkedAt, "OFFICIAL_PROVIDER_UNAVAILABLE");
    }
  }
}

function buildLookupQuery(androidPackage: string): string {
  const packageLiteral = JSON.stringify(androidPackage);
  const context = `{locale: "${SEEKER_STORE_CONTEXT.locale}", platformSdk: ${SEEKER_STORE_CONTEXT.platformSdk}, pixelDensity: ${SEEKER_STORE_CONTEXT.pixelDensity}, model: "${SEEKER_STORE_CONTEXT.model}"}`;
  return `query DapportOfficialReleaseLookup {
    dAppByAndroidPackage(systemContext: ${context}, androidPackage: ${packageLiteral}) {
      androidPackage
      lastRelease(systemContext: ${context}) {
        androidDetails { versionCode }
      }
    }
  }`;
}

function unavailable(androidPackage: string, checkedAt: string, errorCode: string): OfficialStoreReleaseLookup {
  return { status: "unavailable", androidPackage, checkedAt, errorCode };
}

import type {
  OfficialStoreReleaseLookup,
  OfficialStoreSystemContext,
  SolanaMobileApprovalProvider
} from "@hub/domain";
import { z } from "zod";

export const SOLANA_MOBILE_GRAPHQL_ENDPOINT = "https://dappstore.solanamobile.com/graphql";
export const SOLANA_MOBILE_CATALOG_SOURCE = `${SOLANA_MOBILE_GRAPHQL_ENDPOINT}#explore`;

export const SEEKER_STORE_CONTEXT: OfficialStoreSystemContext = {
  locale: "en-US",
  platformSdk: 34,
  pixelDensity: 480,
  model: "SEEKER"
};

const PAGE_SIZE = 20;
const MAX_CATALOG_PAGES = 30;
const CATALOG_CACHE_MS = 5 * 60 * 1_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const androidPackageSchema = z.string().trim().min(3).max(255)
  .regex(/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/);
const releaseSchema = z.object({
  androidDetails: z.object({
    versionCode: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
  }).nullable()
}).nullable();
const exploreResponseSchema = z.object({
  data: z.object({
    explore: z.object({
      units: z.object({
        edges: z.array(z.object({
          node: z.object({
            __typename: z.string(),
            dApps: z.object({
              edges: z.array(z.object({
                node: z.object({
                  androidPackage: androidPackageSchema,
                  lastRelease: releaseSchema
                })
              }))
            }).optional()
          }).passthrough()
        }))
      })
    })
  }).nullable().optional(),
  errors: z.array(z.object({ message: z.string().optional() }).passthrough()).optional()
}).passthrough();

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class OfficialSolanaMobileApprovalProvider implements SolanaMobileApprovalProvider {
  private catalogPromise: Promise<Map<string, bigint>> | null = null;
  private catalogExpiresAt = 0;

  public constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async lookupLatestVisibleRelease(androidPackage: string): Promise<OfficialStoreReleaseLookup> {
    const checkedAt = this.now().toISOString();
    const parsedPackage = androidPackageSchema.safeParse(androidPackage);
    if (!parsedPackage.success) return unavailable(androidPackage, checkedAt, "INVALID_ANDROID_PACKAGE");

    try {
      const catalog = await this.loadVisibleCatalog();
      const versionCode = catalog.get(parsedPackage.data);
      if (versionCode === undefined) {
        return {
          status: "not_visible",
          androidPackage: parsedPackage.data,
          checkedAt,
          systemContext: SEEKER_STORE_CONTEXT,
          sourceReference: SOLANA_MOBILE_CATALOG_SOURCE
        };
      }
      return {
        status: "visible",
        androidPackage: parsedPackage.data,
        versionCode,
        checkedAt,
        systemContext: SEEKER_STORE_CONTEXT,
        sourceReference: SOLANA_MOBILE_CATALOG_SOURCE
      };
    } catch (error) {
      const code = error instanceof OfficialProviderError ? error.code : "OFFICIAL_PROVIDER_UNAVAILABLE";
      return unavailable(parsedPackage.data, checkedAt, code);
    }
  }

  private loadVisibleCatalog(): Promise<Map<string, bigint>> {
    const now = this.now().getTime();
    if (this.catalogPromise && now < this.catalogExpiresAt) return this.catalogPromise;

    this.catalogExpiresAt = now + CATALOG_CACHE_MS;
    this.catalogPromise = this.fetchVisibleCatalog().catch((error) => {
      this.catalogPromise = null;
      this.catalogExpiresAt = 0;
      throw error;
    });
    return this.catalogPromise;
  }

  private async fetchVisibleCatalog(): Promise<Map<string, bigint>> {
    const catalog = new Map<string, bigint>();
    for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
      const parsed = await this.fetchPage(page);
      let pageEntries = 0;
      for (const edge of parsed.data?.explore.units.edges ?? []) {
        if (edge.node.__typename !== "DAppsByCategoryUnit" || !edge.node.dApps) continue;
        for (const appEdge of edge.node.dApps.edges) {
          const details = appEdge.node.lastRelease?.androidDetails;
          if (!details) continue;
          catalog.set(appEdge.node.androidPackage, BigInt(details.versionCode));
          pageEntries += 1;
        }
      }
      if (pageEntries === 0) return catalog;
    }
    throw new OfficialProviderError("OFFICIAL_PROVIDER_CATALOG_LIMIT_REACHED");
  }

  private async fetchPage(page: number): Promise<z.infer<typeof exploreResponseSchema>> {
    const response = await this.fetchImpl(SOLANA_MOBILE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: "https://dapport.app",
        referer: "https://dapport.app/",
        "user-agent": "Dapport/1.0 (+https://dapport.app)"
      },
      body: JSON.stringify({ query: buildExploreQuery(page) }),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) throw new OfficialProviderError("OFFICIAL_PROVIDER_HTTP_ERROR");

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw new OfficialProviderError("OFFICIAL_PROVIDER_RESPONSE_TOO_LARGE");
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
      throw new OfficialProviderError("OFFICIAL_PROVIDER_RESPONSE_TOO_LARGE");
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new OfficialProviderError("OFFICIAL_PROVIDER_INVALID_JSON");
    }
    const parsed = exploreResponseSchema.safeParse(json);
    if (!parsed.success) throw new OfficialProviderError("OFFICIAL_PROVIDER_INVALID_RESPONSE");
    if (parsed.data.errors?.length) throw new OfficialProviderError("OFFICIAL_PROVIDER_GRAPHQL_ERROR");
    if (!parsed.data.data) throw new OfficialProviderError("OFFICIAL_PROVIDER_MISSING_DATA");
    return parsed.data;
  }
}

function buildExploreQuery(page: number): string {
  const context = `{locale: "${SEEKER_STORE_CONTEXT.locale}", platformSdk: ${SEEKER_STORE_CONTEXT.platformSdk}, pixelDensity: ${SEEKER_STORE_CONTEXT.pixelDensity}, model: "${SEEKER_STORE_CONTEXT.model}"}`;
  const after = page === 0 ? "" : `, after: "${page * PAGE_SIZE}"`;
  return `query DapportOfficialCatalogLookup {
    explore {
      units(systemContext: ${context}) {
        edges {
          node {
            __typename
            ... on DAppsByCategoryUnit {
              dApps(systemContext: ${context}, first: ${PAGE_SIZE}${after}) {
                edges {
                  node {
                    androidPackage
                    lastRelease(systemContext: ${context}) {
                      androidDetails { versionCode }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;
}

class OfficialProviderError extends Error {
  public constructor(public readonly code: string) {
    super(code);
  }
}

function unavailable(androidPackage: string, checkedAt: string, errorCode: string): OfficialStoreReleaseLookup {
  return { status: "unavailable", androidPackage, checkedAt, errorCode };
}

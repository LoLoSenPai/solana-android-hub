import { z } from "zod";
import {
  CATALOG_CATEGORIES,
  CATALOG_SORTS,
  GAME_GENRES,
  type CatalogCategory,
  type CatalogChannel,
  type CatalogSort,
  type GameGenre
} from "@hub/domain";

export { CATALOG_CATEGORIES, CATALOG_SORTS, GAME_GENRES };
export type { CatalogCategory, CatalogChannel, CatalogSort, GameGenre };

export const catalogCategorySchema = z.enum(CATALOG_CATEGORIES);
export const catalogSortSchema = z.enum(CATALOG_SORTS);
export const gameGenreSchema = z.enum(GAME_GENRES);

export const trustFactsDtoSchema = z.object({
  publisherControl: z.literal("verified"),
  distributionConsent: z.literal("active"),
  releaseAuthenticity: z.enum(["development_preview", "server_binary_valid"]),
  solanaMobileApproval: z.enum(["unknown", "verified_approved", "rejected"])
});

export const releaseDtoSchema = z.object({
  id: z.uuid(),
  releaseMint: z.string(),
  packageName: z.string(),
  versionName: z.string(),
  versionCode: z.string().regex(/^\d+$/),
  apkUrl: z.url(),
  apkSize: z.int().positive(),
  apkSha256: z.string().regex(/^[0-9a-f]{64}$/),
  certificateSha256: z.string().regex(/^[0-9a-f]{64}$/),
  minSdk: z.int().positive(),
  targetSdk: z.int().positive().nullable(),
  permissions: z.array(z.string()),
  previewOnly: z.boolean(),
  trust: trustFactsDtoSchema
});

export const catalogAppDtoSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  appMint: z.string(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  iconUrl: z.url().nullable(),
  screenshots: z.array(z.url()),
  bannerUrl: z.url().nullable().default(null),
  featureGraphicUrl: z.url().nullable().default(null),
  category: catalogCategorySchema.default("other"),
  genres: z.array(gameGenreSchema).default([]),
  releaseUpdatedAt: z.iso.datetime().nullable().default(null),
  latestRelease: releaseDtoSchema
});

export const catalogResponseSchema = z.object({
  items: z.array(catalogAppDtoSchema),
  nextCursor: z.string().nullable(),
  requestId: z.string()
});

export const publicConfigDtoSchema = z.object({
  appEnvironment: z.enum(["local", "staging", "production"]),
  defaultCatalogChannel: z.literal("trusted"),
  previewEnabled: z.boolean(),
  solanaNetwork: z.literal("mainnet-beta")
});

export type TrustFactsDto = z.infer<typeof trustFactsDtoSchema>;
export type ReleaseDto = z.infer<typeof releaseDtoSchema>;
export type CatalogAppDto = z.infer<typeof catalogAppDtoSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type PublicConfigDto = z.infer<typeof publicConfigDtoSchema>;

export class HubApiClient {
  public constructor(private readonly origin: string, private readonly fetchImpl: typeof fetch = fetch) {}

  public async getConfig(): Promise<PublicConfigDto> {
    return publicConfigDtoSchema.parse(await this.getJson("/api/v1/config"));
  }

  public async getCatalog(input: {
    channel?: CatalogChannel;
    query?: string;
    category?: CatalogCategory;
    sort?: CatalogSort;
    androidSdk?: number;
    genre?: GameGenre;
  } = {}): Promise<CatalogResponse> {
    const url = new URL("/api/v1/catalog", this.origin);
    if (input.channel) url.searchParams.set("channel", input.channel);
    if (input.query) url.searchParams.set("query", input.query);
    if (input.category) url.searchParams.set("category", input.category);
    if (input.sort) url.searchParams.set("sort", input.sort);
    if (input.androidSdk !== undefined) url.searchParams.set("androidSdk", input.androidSdk.toString());
    if (input.genre) url.searchParams.set("genre", input.genre);
    return catalogResponseSchema.parse(await this.getJson(url));
  }

  private async getJson(url: string | URL): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      cache: "no-store",
      headers: { accept: "application/json", "cache-control": "no-cache" }
    });
    if (!response.ok) throw new Error(`Hub API request failed with ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}

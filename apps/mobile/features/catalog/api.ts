import { HubApiClient, type CatalogAppDto } from "@hub/api-client";
import Constants from "expo-constants";
import { getCatalogChannel, type CatalogChannel } from "@/storage/database";

const configuredOrigin: unknown = Constants.expoConfig?.extra?.hubOrigin;
const origin = process.env.EXPO_PUBLIC_HUB_ORIGIN
  ?? (typeof configuredOrigin === "string" ? configuredOrigin : "http://10.0.2.2:3000");
const client = new HubApiClient(origin);

export async function loadCatalog(channel?: CatalogChannel): Promise<readonly CatalogAppDto[]> {
  return (await client.getCatalog({ channel: channel ?? await getCatalogChannel() })).items;
}

export async function loadCatalogApp(slug: string): Promise<CatalogAppDto | undefined> {
  return (await loadCatalog()).find((app) => app.slug === slug);
}

export const hubOrigin = origin;

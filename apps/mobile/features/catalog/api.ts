import { HubApiClient, type CatalogAppDto } from "@hub/api-client";
import Constants from "expo-constants";
import { getCatalogChannel, type CatalogChannel } from "@/storage/database";

const origin = readStringProperty(process.env, "EXPO_PUBLIC_HUB_ORIGIN")
  ?? readConfiguredOrigin(Constants)
  ?? "http://10.0.2.2:3000";
const client = new HubApiClient(origin);

export async function loadCatalog(channel?: CatalogChannel): Promise<readonly CatalogAppDto[]> {
  return (await client.getCatalog({ channel: channel ?? await getCatalogChannel() })).items;
}

export async function loadCatalogApp(slug: string): Promise<CatalogAppDto | undefined> {
  return (await loadCatalog()).find((app) => app.slug === slug);
}

export const hubOrigin = origin;

function readConfiguredOrigin(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const expoConfig = value.expoConfig;
  if (!isRecord(expoConfig)) return undefined;
  const extra = expoConfig.extra;
  if (!isRecord(extra)) return undefined;
  return typeof extra.hubOrigin === "string" ? extra.hubOrigin : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : undefined;
}

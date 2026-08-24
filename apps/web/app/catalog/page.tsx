import { listCatalog } from "@/server/catalog-service";
import { CatalogClient } from "./CatalogClient";
import { catalogChannelFromParam } from "./catalog-channel";

export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<{ channel?: string | string[] }>;
}) {
  const channel = catalogChannelFromParam((await searchParams).channel);
  const apps = await listCatalog({ channel, sort: "recently_updated" });
  return (
    <main className="catalog-page">
      <CatalogClient apps={apps} channel={channel} />
    </main>
  );
}

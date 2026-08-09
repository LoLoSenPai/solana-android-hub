import { hubConfig } from "@/server/runtime";
import { listCatalog } from "@/server/catalog-service";
import { CatalogClient } from "./CatalogClient";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const apps = await listCatalog({ channel: "trusted", sort: "recently_updated" });
  return (
    <main className="catalog-page">
      <CatalogClient apps={apps} previewEnvironment={hubConfig.appEnvironment !== "production"} />
    </main>
  );
}

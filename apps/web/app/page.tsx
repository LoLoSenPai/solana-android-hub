import { listCatalog } from "../server/catalog-service";
import { hubConfig } from "../server/runtime";
import { CatalogueExperience } from "./components/CatalogueExperience";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const apps = await listCatalog({ channel: "trusted" });
  return (
    <main className="catalogue-page">
      <CatalogueExperience apps={apps} previewEnvironment={hubConfig.appEnvironment !== "production"} />
    </main>
  );
}

import { listCatalogChannels } from "../server/catalog-service";
import { CatalogClient } from "./catalog/CatalogClient";
import { catalogListings } from "./catalog/catalog-listings";
import { CatalogueExperience } from "./components/CatalogueExperience";
import styles from "./catalog/Home.module.css";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const channels = catalogListings(await listCatalogChannels());
  return (
    <main className={styles.page}>
      <CatalogueExperience />
      <CatalogClient channels={channels} />
    </main>
  );
}

import type { CatalogAppDto, CatalogCategory, GameGenre } from "@hub/api-client";
import { categoryLabel, genreLabel } from "../components/catalog-config";

export type CatalogSortMode = "recent" | "name";

type SearchableApp = Pick<CatalogAppDto, "name" | "shortDescription" | "description" | "publisher" | "category" | "genres" | "releaseUpdatedAt" | "slug">;

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function filterCatalogApps<T extends SearchableApp>(apps: readonly T[], input: {
  category: "all" | CatalogCategory;
  genre: "all" | GameGenre;
  sort: CatalogSortMode;
  query: string;
}): readonly T[] {
  const normalizedQuery = normalize(input.query.trim());
  return apps
    .filter((app) => input.category === "all" || app.category === input.category)
    .filter((app) => input.genre === "all" || app.genres.includes(input.genre))
    .filter((app) => !normalizedQuery || [app.name, app.shortDescription, app.description,
      app.publisher?.displayName, app.publisher?.slug, categoryLabel(app.category), ...app.genres.map(genreLabel)]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalize(value).includes(normalizedQuery)))
    .toSorted((left, right) =>
      (input.sort === "recent" ? compareRecent(left, right) : 0)
      || left.name.localeCompare(right.name, "en") || left.slug.localeCompare(right.slug, "en"));
}

function compareRecent(left: SearchableApp, right: SearchableApp): number {
  const leftTime = Date.parse(left.releaseUpdatedAt ?? "") || 0;
  const rightTime = Date.parse(right.releaseUpdatedAt ?? "") || 0;
  return rightTime - leftTime;
}

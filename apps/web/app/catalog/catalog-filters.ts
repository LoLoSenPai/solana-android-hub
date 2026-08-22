import type { CatalogAppDto, CatalogCategory, GameGenre } from "@hub/api-client";

export type CatalogTrustFilter = "all" | "checked" | "preview";
export type CatalogSortMode = "recent" | "name";

export function filterCatalogApps(apps: readonly CatalogAppDto[], input: {
  category: "all" | CatalogCategory;
  genre: "all" | GameGenre;
  trust: CatalogTrustFilter;
  sort: CatalogSortMode;
  query: string;
}): readonly CatalogAppDto[] {
  const normalizedQuery = input.query.trim().toLocaleLowerCase();
  return apps
    .filter((app) => input.category === "all" || app.category === input.category)
    .filter((app) => input.genre === "all" || app.genres.includes(input.genre))
    .filter((app) => !normalizedQuery || [app.name, app.shortDescription, app.description]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    .filter((app) => {
      if (input.trust === "checked") return app.latestRelease.trust.releaseAuthenticity === "server_binary_valid";
      if (input.trust === "preview") return app.latestRelease.previewOnly;
      return true;
    })
    .toSorted((left, right) => input.sort === "name"
      ? left.name.localeCompare(right.name)
      : compareRecent(left, right));
}

function compareRecent(left: CatalogAppDto, right: CatalogAppDto): number {
  const leftTime = Date.parse(left.releaseUpdatedAt ?? "") || 0;
  const rightTime = Date.parse(right.releaseUpdatedAt ?? "") || 0;
  return rightTime - leftTime || left.name.localeCompare(right.name);
}

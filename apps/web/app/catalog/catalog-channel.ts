import type { CatalogChannel } from "@hub/api-client";

export function catalogChannelFromParam(value: string | readonly string[] | undefined): CatalogChannel {
  const candidate = typeof value === "string" ? value : value?.[0];
  return candidate === "approved" ? "approved" : "trusted";
}

export function catalogHref(input: {
  channel: CatalogChannel;
  category?: string;
  view?: "grid" | "list";
}): string {
  const params = new URLSearchParams();
  if (input.category && input.category !== "all") params.set("category", input.category);
  if (input.channel === "approved") params.set("channel", "approved");
  if (input.view === "list") params.set("view", "list");
  return params.size ? `/catalog?${params.toString()}` : "/catalog";
}

export function appHref(slug: string, channel: CatalogChannel): string {
  return channel === "approved" ? `/apps/${slug}?channel=approved` : `/apps/${slug}`;
}

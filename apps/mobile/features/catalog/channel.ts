import type { CatalogChannel } from "@hub/api-client";

export function normalizeCatalogChannel(value: string | null | undefined): CatalogChannel {
  return value === "approved" ? "approved" : "trusted";
}

export const CATALOG_CHANNEL_OPTIONS: readonly {
  value: CatalogChannel;
  title: string;
  detail: string;
}[] = [
  {
    value: "trusted",
    title: "All Dapport apps",
    detail: "Show the latest publisher-authorized release checked by Dapport."
  },
  {
    value: "approved",
    title: "Solana Mobile approved only",
    detail: "Show only the latest release currently visible on Solana Mobile."
  }
];

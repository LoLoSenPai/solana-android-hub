import type { CatalogCategory, GameGenre } from "@hub/api-client";

export type CategoryId = "all" | CatalogCategory;

export const CATEGORIES: readonly {
  id: CategoryId;
  label: string;
  caption: string;
  tone: string;
}[] = [
  { id: "all", label: "All apps", caption: "Explore the complete catalogue", tone: "blue" },
  { id: "games", label: "Games", caption: "Puzzle, strategy, RPG and more", tone: "violet" },
  { id: "defi", label: "DeFi & trading", caption: "Swap, earn and manage", tone: "coral" },
  { id: "wallets", label: "Wallets", caption: "Keys, accounts and payments", tone: "sky" },
  { id: "depin", label: "DePIN", caption: "Real-world networks", tone: "sand" },
  { id: "nfts", label: "NFTs", caption: "Collect, create and discover", tone: "slate" },
  { id: "privacy-security", label: "Privacy & security", caption: "Safer tools and private access", tone: "blue" },
  { id: "content-streaming", label: "Content & streaming", caption: "Watch, listen and publish", tone: "coral" },
  { id: "productivity", label: "Productivity", caption: "Get useful things done", tone: "violet" },
  { id: "social-identity", label: "Social & identity", caption: "Communities and profiles", tone: "sky" },
  { id: "ai-agents", label: "AI & agents", caption: "Intelligent onchain experiences", tone: "sand" },
  { id: "lifestyle", label: "Lifestyle", caption: "Everyday Solana experiences", tone: "slate" },
  { id: "other", label: "More", caption: "Everything else for Android", tone: "blue" }
];

export function categoryLabel(category: CatalogCategory): string {
  return CATEGORIES.find((item) => item.id === category)?.label ?? "More";
}

export function genreLabel(genre: GameGenre): string {
  return genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`;
}

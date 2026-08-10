import type { CatalogAppDto } from "@hub/api-client";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { AppArtwork } from "./AppArtwork";
import { HubSymbol } from "./HubSymbol";
import { formatCategory, type AppLocalStatus } from "@/features/catalog/discovery";

interface AppCardProps {
  app: CatalogAppDto;
  localStatus?: AppLocalStatus;
  showCategory?: boolean;
}

export function AppCard({ app, localStatus = "available", showCategory = true }: AppCardProps) {
  const actionLabel = localStatus === "update" ? "Update" : localStatus === "installed" ? "Installed" : "Install";
  const preview = app.latestRelease.previewOnly;

  return (
    <Link href={{ pathname: "/apps/[slug]", params: { slug: app.slug } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${app.name}, ${actionLabel}`}
        className="mb-3 flex-row items-center rounded-[24px] border border-line bg-surface px-4 py-4 active:bg-raised"
      >
        <AppArtwork app={app} size={68} radius={20} />
        <View className="ml-4 min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="min-w-0 flex-1 text-[17px] font-bold text-ink" numberOfLines={1}>{app.name}</Text>
            <Text className={preview ? "text-[11px] font-semibold text-warning" : "text-[11px] font-semibold text-mint"}>
              {preview ? "Preview" : "Checked"}
            </Text>
          </View>
          <Text className="mt-1 text-sm leading-5 text-muted" numberOfLines={2}>
            {app.shortDescription ?? "Discover this Solana app"}
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              {showCategory ? formatCategory(app.category) : app.genres[0] ? formatGenre(app.genres[0]) : `Version ${app.latestRelease.versionName}`}
            </Text>
            <View className={localStatus === "update" ? "flex-row items-center rounded-full bg-coral px-3 py-1.5" : "flex-row items-center rounded-full bg-ink px-3 py-1.5"}>
              {localStatus === "update" ? <HubSymbol name="update" size={14} color="#091018" /> : null}
              <Text className={localStatus === "update" ? "ml-1 text-xs font-bold text-canvas" : "text-xs font-bold text-canvas"}>{actionLabel}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function formatGenre(genre: CatalogAppDto["genres"][number]): string {
  return genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`;
}

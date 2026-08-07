import type { CatalogAppDto } from "@hub/api-client";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export function AppCard({ app }: { app: CatalogAppDto }) {
  return (
    <Link href={{ pathname: "/apps/[slug]", params: { slug: app.slug } }} className="mb-3 rounded-2xl border border-line bg-raised p-4">
      <View className="flex-row gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-mint">
          <Text className="text-2xl font-bold text-canvas">{app.name.slice(0, 1)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-ink">{app.name}</Text>
          <Text className="mt-1 text-sm text-muted" numberOfLines={2}>{app.shortDescription ?? app.latestRelease.packageName}</Text>
          <View className="mt-3 flex-row justify-between">
            <Text className={app.latestRelease.previewOnly ? "text-xs text-warning" : "text-xs text-mint"}>
              {app.latestRelease.previewOnly ? "Development preview" : "Verified publisher release"}
            </Text>
            <Text className="text-xs text-muted">v{app.latestRelease.versionName}</Text>
          </View>
        </View>
      </View>
    </Link>
  );
}

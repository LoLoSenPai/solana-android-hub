import type { CatalogAppDto } from "@hub/api-client";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HUB_ICON from "../../assets/icon.png";
import { AppCard } from "@/components/AppCard";
import { CategoryTile } from "@/components/category-tile";
import { HubSymbol } from "@/components/HubSymbol";
import {
  CATEGORY_DEFINITIONS,
  filterAndSortApps,
  localStatusForApp,
  type BrowseCategory
} from "@/features/catalog/discovery";
import { loadCatalog } from "@/features/catalog/api";
import { useInstalledApps } from "@/features/installer/use-installed-apps";

const VISIBLE_CATEGORIES = CATEGORY_DEFINITIONS.filter((category) => category.id !== "all");

export default function CatalogueScreen() {
  const router = useRouter();
  const [apps, setApps] = useState<readonly CatalogAppDto[]>([]);
  const { installedApps, refresh: refreshInstalledApps } = useInstalledApps();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError(null);
    try {
      const catalog = await loadCatalog();
      setApps(catalog);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalogue unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const installedByPackage = useMemo(
    () => new Map(installedApps.map((app) => [app.packageName, app])),
    [installedApps]
  );
  const results = useMemo(() => filterAndSortApps({
    apps,
    category: "all",
    query,
    availability: "all",
    trust: "all",
    sort: "recent",
    installedByPackage
  }), [apps, installedByPackage, query]);

  const openCategory = (category: BrowseCategory) => {
    router.push(`/categories/${category}` as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(true); void refreshInstalledApps(); }} tintColor="#77A7FF" />}
      >
        <View className="mb-7 mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Image source={HUB_ICON} style={{ width: 42, height: 42, borderRadius: 14 }} />
            <View className="ml-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-mint">Browse everything</Text>
              <Text className="text-lg font-bold text-ink">Catalogue</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface active:bg-raised"
            onPress={() => router.push("/settings")}
          >
            <HubSymbol name="settings" size={22} />
          </Pressable>
        </View>

        <Text className="text-[36px] font-bold leading-[40px] tracking-[-1px] text-ink">Find your next app.</Text>
        <Text className="mt-3 max-w-[350px] text-base leading-6 text-muted">
          Search the whole catalogue or jump straight into a category.
        </Text>

        <View className="mt-6 flex-row items-center rounded-[22px] border border-line bg-surface px-4 py-1">
          <HubSymbol name="search" size={22} color="#95A5B7" />
          <TextInput
            accessibilityLabel="Search the app catalogue"
            className="ml-3 h-14 flex-1 text-base text-ink"
            placeholder="Search apps, games or use cases"
            placeholderTextColor="#718399"
            selectionColor="#77A7FF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" className="p-2" onPress={() => setQuery("")}>
              <HubSymbol name="close" size={20} color="#95A5B7" />
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View className="mt-4 flex-row items-start rounded-2xl border border-warning bg-surface p-4">
            <HubSymbol name="info" size={20} color="#FFC857" />
            <Text className="ml-3 flex-1 leading-5 text-warning">{error}</Text>
          </View>
        ) : null}

        {!query ? (
          <>
            <View className="mb-4 mt-9 flex-row items-end justify-between">
              <Text className="text-[25px] font-bold tracking-[-0.5px] text-ink">Categories</Text>
              <Text className="text-sm text-muted">{VISIBLE_CATEGORIES.length} ways to explore</Text>
            </View>
            <View className="flex-row flex-wrap justify-between">
              {VISIBLE_CATEGORIES.map((category) => (
                <CategoryTile key={category.id} category={category.id} onPress={() => openCategory(category.id)} />
              ))}
            </View>

            <Pressable
              className="mt-2 flex-row items-center justify-between rounded-[22px] border border-line bg-raised p-5 active:bg-surface"
              onPress={() => openCategory("all")}
            >
              <View>
                <Text className="text-base font-bold text-ink">All apps</Text>
                <Text className="mt-1 text-sm text-muted">Browse the complete catalogue</Text>
              </View>
              <HubSymbol name="chevron_right" size={22} color="#77A7FF" />
            </Pressable>

            <View className="mb-4 mt-9 flex-row items-end justify-between">
              <Text className="text-[25px] font-bold tracking-[-0.5px] text-ink">Recently added</Text>
              <Text className="text-sm text-muted">{apps.length} {apps.length === 1 ? "app" : "apps"}</Text>
            </View>
          </>
        ) : (
          <View className="mb-4 mt-8 flex-row items-end justify-between">
            <Text className="text-[25px] font-bold tracking-[-0.5px] text-ink">Search results</Text>
            <Text className="text-sm text-muted">{results.length} found</Text>
          </View>
        )}

        {loading ? <ActivityIndicator className="my-12" color="#77A7FF" /> : null}
        {!loading ? results.map((app) => (
          <AppCard key={app.id} app={app} localStatus={localStatusForApp(app, installedByPackage)} />
        )) : null}

        {!loading && !error && results.length === 0 ? (
          <View className="items-center rounded-[24px] border border-dashed border-line bg-surface px-6 py-12">
            <HubSymbol name="search_off" size={36} color="#95A5B7" />
            <Text className="mt-4 text-lg font-bold text-ink">No matching apps</Text>
            <Text className="mt-2 text-center leading-5 text-muted">Try another name or browse a category.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

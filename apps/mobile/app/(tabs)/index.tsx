import type { CatalogAppDto } from "@hub/api-client";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DAPPORT_HERO from "../../assets/dapport-hero.webp";
import HUB_ICON from "../../assets/icon.png";
import { AppCard } from "@/components/AppCard";
import { AppArtwork } from "@/components/AppArtwork";
import { HubSymbol } from "@/components/HubSymbol";
import {
  categoryDefinition,
  countCategory,
  filterAndSortApps,
  localStatusForApp,
  type BrowseCategory
} from "@/features/catalog/discovery";
import { loadCatalog } from "@/features/catalog/api";
import { checkForHubUpdate } from "@/features/hub-update/service";
import { initializeLocalDatabase, listInstalledApps, type LocalInstallRecord } from "@/storage/database";

const HOME_CATEGORIES: readonly BrowseCategory[] = ["games", "defi", "depin", "wallets", "social-identity", "ai-agents"];

export default function DiscoverScreen() {
  const router = useRouter();
  const [apps, setApps] = useState<readonly CatalogAppDto[]>([]);
  const [installedApps, setInstalledApps] = useState<readonly LocalInstallRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hubUpdate, setHubUpdate] = useState<{ versionName: string; apkSize: number } | null>(null);

  const refresh = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const [catalog, localApps] = await Promise.all([loadCatalog(), listInstalledApps()]);
      setApps(catalog);
      setInstalledApps(localApps);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalogue unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    void checkForHubUpdate().then((result) => {
      setHubUpdate(result.status === "available"
        ? { versionName: result.manifest.versionName, apkSize: result.manifest.apkSize }
        : null);
    });
  }, [refresh]));

  const installedByPackage = useMemo(
    () => new Map(installedApps.map((app) => [app.packageName, app])),
    [installedApps]
  );
  const visibleApps = useMemo(() => filterAndSortApps({
    apps,
    category: "all",
    query,
    availability: "all",
    trust: "all",
    sort: "recent",
    installedByPackage
  }), [apps, installedByPackage, query]);
  const availableNow = useMemo(
    () => [...apps].sort((left, right) => (Date.parse(right.releaseUpdatedAt ?? "") || 0) - (Date.parse(left.releaseUpdatedAt ?? "") || 0))[0],
    [apps]
  );
  const featuredArtwork = availableNow?.featureGraphicUrl ?? availableNow?.bannerUrl ?? availableNow?.screenshots[0];

  const openCategory = (category: BrowseCategory) => {
    router.push(`/categories/${category}` as Href);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Image source={HUB_ICON} style={{ width: 72, height: 72, borderRadius: 22 }} />
        <ActivityIndicator className="mt-5" color="#77A7FF" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor="#77A7FF" />}
      >
        <View className="mb-5 mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Image source={HUB_ICON} style={{ width: 42, height: 42, borderRadius: 14 }} />
            <View className="ml-3">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-mint">Solana apps. Any Android.</Text>
              <Text className="text-lg font-bold text-ink">Dapport</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse all apps"
            className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface active:bg-raised"
            onPress={() => openCategory("all")}
          >
            <HubSymbol name="apps" size={22} />
          </Pressable>
        </View>

        <Text className="max-w-[340px] text-[38px] font-bold leading-[42px] tracking-[-1.2px] text-ink">
          Find the app that fits.
        </Text>
        <Text className="mt-3 max-w-[350px] text-base leading-6 text-muted">
          Browse by category, find the right game, and keep every update in one place.
        </Text>

        <View className="mt-6 flex-row items-center rounded-[22px] border border-line bg-surface px-4 py-1">
          <HubSymbol name="search" size={22} color="#95A5B7" />
          <TextInput
            accessibilityLabel="Search the app catalogue"
            className="ml-3 h-14 flex-1 text-base text-ink"
            placeholder="Search apps or what you want to do"
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

        {hubUpdate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Update Dapport to version ${hubUpdate.versionName}`}
            className="mt-4 flex-row items-center rounded-[22px] border border-mint bg-raised p-4 active:opacity-80"
            onPress={() => router.push("/hub-update")}
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
              <HubSymbol name="system_update" size={23} color="#77A7FF" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-ink">Dapport update available</Text>
              <Text className="mt-1 text-sm text-muted">Version {hubUpdate.versionName} · {(hubUpdate.apkSize / 1024 / 1024).toFixed(1)} MB</Text>
            </View>
            <HubSymbol name="chevron_right" size={21} color="#95A5B7" />
          </Pressable>
        ) : null}

        {!query ? (
          <>
            <Pressable
              className="mt-7 overflow-hidden rounded-[30px] active:opacity-90"
              onPress={() => availableNow ? router.push(`/apps/${availableNow.slug}` as Href) : openCategory("all")}
            >
              <ImageBackground source={featuredArtwork ? { uri: featuredArtwork } : DAPPORT_HERO} resizeMode="cover" style={{ minHeight: 340 }}>
                <View className="min-h-[340px] justify-between p-6" style={{ backgroundColor: "rgba(5, 12, 21, 0.5)" }}>
                  <View className="self-start rounded-full bg-ink px-3 py-1.5">
                    <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-canvas">{availableNow ? "Featured on Dapport" : "Built for discovery"}</Text>
                  </View>
                  <View className="max-w-[285px]">
                    {availableNow ? (
                      <View className="mb-4 flex-row items-center">
                        <AppArtwork app={availableNow} size={58} radius={17} />
                        <View className="ml-3 flex-1">
                          <Text className="text-[27px] font-bold leading-8 text-ink">{availableNow.name}</Text>
                          <Text className="mt-1 text-sm text-ink" numberOfLines={1}>{availableNow.shortDescription}</Text>
                        </View>
                      </View>
                    ) : <Text className="text-[29px] font-bold leading-8 text-ink">A catalogue you can actually explore.</Text>}
                    <View className="self-start rounded-full bg-ink px-5 py-3">
                      <Text className="font-bold text-canvas">{availableNow ? "Discover the app" : "Explore with filters"}</Text>
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>

            <SectionHeader title="Categories" action="See all" onPress={() => openCategory("all")} />
            <View className="flex-row flex-wrap justify-between">
              {HOME_CATEGORIES.map((category) => {
                const definition = categoryDefinition(category);
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${definition.label}`}
                    className="mb-3 w-[48.5%] rounded-[24px] border border-line bg-surface p-4 active:bg-raised"
                    onPress={() => openCategory(category)}
                  >
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-raised">
                      <HubSymbol name={definition.icon} size={24} color={definition.accent} />
                    </View>
                    <Text className="mt-5 text-base font-bold text-ink" numberOfLines={1}>{definition.label}</Text>
                    <Text className="mt-1 text-xs text-muted">{countCategory(apps, category)} {countCategory(apps, category) === 1 ? "app" : "apps"}</Text>
                  </Pressable>
                );
              })}
            </View>

            {availableNow ? (
              <>
                <SectionHeader title="Available now" action="Details" onPress={() => router.push(`/apps/${availableNow.slug}` as Href)} />
                <Pressable
                  className="rounded-[28px] border border-line bg-raised p-5 active:bg-surface"
                  onPress={() => router.push(`/apps/${availableNow.slug}` as Href)}
                >
                  <View className="flex-row items-start">
                    <AppArtwork app={availableNow} size={78} radius={22} />
                    <View className="ml-4 flex-1">
                      <Text className="text-xs font-semibold uppercase tracking-[1.4px] text-mint">{categoryDefinition(availableNow.category).label}</Text>
                      <Text className="mt-1 text-xl font-bold text-ink">{availableNow.name}</Text>
                      <Text className="mt-1 text-sm leading-5 text-muted" numberOfLines={2}>{availableNow.shortDescription ?? "Discover this Solana app"}</Text>
                    </View>
                  </View>
                  <View className="mt-5 flex-row items-center justify-between border-t border-line pt-4">
                    <View className="flex-row items-center">
                      <HubSymbol name={availableNow.latestRelease.previewOnly ? "science" : "verified"} size={18} color={availableNow.latestRelease.previewOnly ? "#FFC857" : "#77A7FF"} />
                      <Text className="ml-2 text-xs text-muted">{availableNow.latestRelease.previewOnly ? "Preview release" : "Checked release"}</Text>
                    </View>
                    <HubSymbol name="chevron_right" size={20} color="#F4F7FB" />
                  </View>
                </Pressable>
              </>
            ) : null}

            <View className="mt-8 flex-row rounded-[24px] border border-line bg-surface p-5">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-raised">
                <HubSymbol name="shield_lock" size={24} color="#77A7FF" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-base font-bold text-ink">The final check happens here.</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">Every APK is verified again on this device before Android opens its installer.</Text>
              </View>
            </View>
          </>
        ) : (
          <View className="mt-7">
            <View className="mb-4 flex-row items-end justify-between">
              <Text className="text-2xl font-bold text-ink">Search results</Text>
              <Text className="text-sm text-muted">{visibleApps.length} found</Text>
            </View>
            {visibleApps.map((app) => (
              <AppCard key={app.id} app={app} localStatus={localStatusForApp(app, installedByPackage)} />
            ))}
            {visibleApps.length === 0 ? (
              <View className="items-center rounded-[24px] border border-dashed border-line bg-surface px-6 py-12">
                <HubSymbol name="search_off" size={36} color="#95A5B7" />
                <Text className="mt-4 text-lg font-bold text-ink">No matching apps</Text>
                <Text className="mt-2 text-center leading-5 text-muted">Try a broader app name or use case.</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View className="mb-4 mt-9 flex-row items-center justify-between">
      <Text className="text-[25px] font-bold tracking-[-0.5px] text-ink">{title}</Text>
      <Pressable className="flex-row items-center py-2" onPress={onPress}>
        <Text className="text-sm font-semibold text-mint">{action}</Text>
        <HubSymbol name="chevron_right" size={18} color="#77A7FF" style={{ marginLeft: 2 }} />
      </Pressable>
    </View>
  );
}

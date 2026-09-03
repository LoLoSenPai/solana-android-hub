import type { CatalogAppDto } from "@hub/api-client";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DAPPORT_HERO from "../../assets/dapport-particle-hero-v2.png";
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
import { initializeLocalDatabase, listInstalledApps, type LocalInstallRecord } from "@/storage/database";

const HOME_CATEGORIES: readonly BrowseCategory[] = CATEGORY_DEFINITIONS
  .filter((category) => category.id !== "all")
  .map((category) => category.id);

export default function DiscoverScreen() {
  const router = useRouter();
  const [apps, setApps] = useState<readonly CatalogAppDto[]>([]);
  const [installedApps, setInstalledApps] = useState<readonly LocalInstallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const installedByPackage = useMemo(
    () => new Map(installedApps.map((app) => [app.packageName, app])),
    [installedApps]
  );
  const newestApps = useMemo(() => filterAndSortApps({
    apps,
    category: "all",
    query: "",
    availability: "all",
    trust: "all",
    sort: "recent",
    installedByPackage
  }).slice(0, 4), [apps, installedByPackage]);

  const openCategory = (category: BrowseCategory) => router.push(`/categories/${category}` as Href);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-36"
        showsVerticalScrollIndicator={false}
      >
        <PortalHero
          onExplore={() => router.push("./catalogue")}
          onSettings={() => router.push("/settings")}
        />

        <View className="-mt-36 px-4">
          <SectionHeader title="Explore categories" action="See all" onPress={() => router.push("/categories/all")} />
          <View className="flex-row flex-wrap justify-between">
            {HOME_CATEGORIES.map((category) => (
              <CategoryTile key={category} category={category} onPress={() => openCategory(category)} />
            ))}
          </View>

          <SectionHeader title="New on Dapport" action="Full catalogue" onPress={() => router.push("./catalogue")} />
          {loading ? (
            <View className="items-center rounded-[26px] border border-line bg-surface px-7 py-10">
              <ActivityIndicator color="#77A7FF" />
              <Text className="mt-3 text-sm text-muted">Loading the latest apps…</Text>
            </View>
          ) : error ? (
            <View className="items-center rounded-[26px] border border-line bg-surface px-7 py-10">
              <HubSymbol name="cloud_off" size={34} color="#95A5B7" />
              <Text className="mt-4 text-lg font-bold text-ink">Catalogue temporarily unavailable</Text>
              <Text className="mt-2 text-center leading-5 text-muted">Check your connection, then try again.</Text>
              <Pressable
                accessibilityRole="button"
                className="mt-5 rounded-full border border-line bg-raised px-5 py-3 active:opacity-75"
                onPress={() => {
                  setLoading(true);
                  void refresh();
                }}
              >
                <Text className="font-semibold text-ink">Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {!loading && !error ? newestApps.map((app) => (
            <AppCard key={app.id} app={app} localStatus={localStatusForApp(app, installedByPackage)} />
          )) : null}
          {!loading && !error && newestApps.length === 0 ? (
            <View className="items-center rounded-[26px] border border-dashed border-line bg-surface px-7 py-12">
              <HubSymbol name="apps" size={38} color="#95A5B7" />
              <Text className="mt-4 text-lg font-bold text-ink">The catalogue is opening</Text>
              <Text className="mt-2 text-center leading-5 text-muted">New publisher-approved apps will appear here.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PortalHero({ onExplore, onSettings }: { onExplore: () => void; onSettings: () => void }) {
  return (
    <View className="h-[610px] overflow-hidden bg-canvas">
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={DAPPORT_HERO}
        style={{ bottom: 0, height: "100%", left: 0, position: "absolute", right: 0, top: 0, width: "100%" }}
      />

      <View className="px-5 pt-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Image source={HUB_ICON} style={{ width: 45, height: 45, borderRadius: 14 }} />
            <View className="ml-3">
              <Text className="text-[18px] font-bold text-white">Dapport</Text>
              <Text className="text-[11px] text-[#AEBED2]">Solana apps. Any Android.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            className="h-12 w-12 items-center justify-center rounded-full border border-[#304763] bg-[#07111FCC] active:opacity-75"
            onPress={onSettings}
          >
            <HubSymbol name="settings" size={23} color="#DCE8F7" />
          </Pressable>
        </View>

        <View className="mt-14 max-w-[280px]">
          <View className="self-start rounded-full border border-[#5D6B9A] bg-[#070B18CC] px-3 py-1.5">
            <Text className="text-[10px] font-bold uppercase tracking-[1.65px] text-[#BCD0FF]">The open Android home</Text>
          </View>
          <Text className="mt-5 text-[38px] font-bold leading-[41px] tracking-[-1.25px] text-white">Solana apps.{"\n"}Any Android.</Text>
          <Text className="mt-3 max-w-[250px] text-[14px] leading-[20px] text-[#D5E0EF]">Discover games, wallets and apps made for the Solana ecosystem.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore the catalogue"
            className="mt-7 h-14 self-start flex-row items-center justify-center rounded-full bg-white px-6 active:opacity-85"
            onPress={onExplore}
          >
            <Text className="font-bold text-[#091018]">Explore the catalogue</Text>
            <HubSymbol name="arrow_forward" size={18} color="#091018" style={{ marginLeft: 8 }} />
          </Pressable>
        </View>
      </View>
    </View>
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

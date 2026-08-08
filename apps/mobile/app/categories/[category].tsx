import type { CatalogAppDto } from "@hub/api-client";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppCard } from "@/components/AppCard";
import { HubSymbol } from "@/components/HubSymbol";
import {
  CATEGORY_DEFINITIONS,
  categoryDefinition,
  filterAndSortApps,
  localStatusForApp,
  type AvailabilityFilter,
  type BrowseCategory,
  type BrowseSort,
  type TrustFilter
} from "@/features/catalog/discovery";
import { loadCatalog } from "@/features/catalog/api";
import { listInstalledApps, type LocalInstallRecord } from "@/storage/database";

const AVAILABILITY_FILTERS: readonly { id: AvailabilityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not-installed", label: "Not installed" },
  { id: "installed", label: "Installed" },
  { id: "updates", label: "Updates" }
];

const TRUST_FILTERS: readonly { id: TrustFilter; label: string }[] = [
  { id: "all", label: "Any trust status" },
  { id: "approved", label: "Mobile approved" },
  { id: "server-checked", label: "Server checked" },
  { id: "preview", label: "Preview" }
];

const SORTS: readonly { id: BrowseSort; label: string }[] = [
  { id: "recent", label: "Recently updated" },
  { id: "trust", label: "Trust evidence" },
  { id: "name", label: "A–Z" }
];

export default function CategoryScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category: string }>();
  const category = categoryDefinition(categoryParam).id;
  const definition = categoryDefinition(category);
  const [apps, setApps] = useState<readonly CatalogAppDto[]>([]);
  const [installedApps, setInstalledApps] = useState<readonly LocalInstallRecord[]>([]);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [trust, setTrust] = useState<TrustFilter>("all");
  const [sort, setSort] = useState<BrowseSort>("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, localApps] = await Promise.all([loadCatalog(), listInstalledApps()]);
      setApps(catalog);
      setInstalledApps(localApps);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalogue unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const installedByPackage = useMemo(
    () => new Map(installedApps.map((app) => [app.packageName, app])),
    [installedApps]
  );
  const results = useMemo(() => filterAndSortApps({
    apps,
    category,
    query,
    availability,
    trust,
    sort,
    installedByPackage
  }), [apps, availability, category, installedByPackage, query, sort, trust]);
  const updateCount = useMemo(
    () => filterAndSortApps({ apps, category, query: "", availability: "updates", trust: "all", sort: "recent", installedByPackage }).length,
    [apps, category, installedByPackage]
  );

  const changeCategory = (value: BrowseCategory) => {
    setAvailability("all");
    setTrust("all");
    setQuery("");
    router.replace(`/categories/${value}` as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-10"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable
            accessibilityLabel="Go back"
            className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface active:bg-raised"
            onPress={() => router.back()}
          >
            <HubSymbol name="arrow_back" size={24} />
          </Pressable>
          <View className="rounded-full border border-line bg-surface px-4 py-2">
            <Text className="text-xs font-semibold text-muted">{apps.length} {apps.length === 1 ? "app" : "apps"} indexed</Text>
          </View>
        </View>

        <View className="mt-8 flex-row items-end">
          <View className="h-16 w-16 items-center justify-center rounded-[22px] bg-raised">
            <HubSymbol name={definition.icon} size={34} color={definition.accent} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-[36px] font-bold leading-[40px] tracking-[-1px] text-ink">{definition.label}</Text>
            <Text className="mt-1 text-sm text-muted">{definition.description}</Text>
          </View>
        </View>

        <View className="mt-7 flex-row items-center rounded-[22px] border border-line bg-surface px-4 py-1">
          <HubSymbol name="search" size={22} color="#93A7A2" />
          <TextInput
            accessibilityLabel={`Search ${definition.label}`}
            className="ml-3 h-14 flex-1 text-base text-ink"
            placeholder={`Search in ${definition.label.toLocaleLowerCase()}`}
            placeholderTextColor="#71847F"
            selectionColor="#72F0C6"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" className="p-2" onPress={() => setQuery("")}>
              <HubSymbol name="close" size={20} color="#93A7A2" />
            </Pressable>
          ) : null}
        </View>

        <Text className="mb-3 mt-7 text-xs font-bold uppercase tracking-[1.6px] text-muted">Jump to category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-4">
          {CATEGORY_DEFINITIONS.map((item) => (
            <Pressable
              key={item.id}
              className={item.id === category ? "mr-2 flex-row items-center rounded-full bg-ink px-4 py-2.5" : "mr-2 flex-row items-center rounded-full border border-line bg-surface px-4 py-2.5"}
              onPress={() => changeCategory(item.id)}
            >
              <HubSymbol name={item.icon} size={17} color={item.id === category ? "#061311" : item.accent} />
              <Text className={item.id === category ? "ml-2 text-sm font-bold text-canvas" : "ml-2 text-sm font-semibold text-ink"}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text className="mb-3 mt-7 text-xs font-bold uppercase tracking-[1.6px] text-muted">Install status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-4">
          {AVAILABILITY_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.id === "updates" && updateCount > 0 ? `${filter.label} ${updateCount}` : filter.label}
              selected={availability === filter.id}
              onPress={() => setAvailability(filter.id)}
            />
          ))}
        </ScrollView>

        <Text className="mb-3 mt-7 text-xs font-bold uppercase tracking-[1.6px] text-muted">Trust evidence</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-4">
          {TRUST_FILTERS.map((filter) => (
            <FilterChip key={filter.id} label={filter.label} selected={trust === filter.id} onPress={() => setTrust(filter.id)} />
          ))}
        </ScrollView>

        <View className="mb-4 mt-8 flex-row items-center justify-between">
          <View>
            <Text className="text-[25px] font-bold text-ink">{results.length} {results.length === 1 ? "result" : "results"}</Text>
            <Text className="mt-1 text-xs text-muted">Filters stay on this device</Text>
          </View>
          <View className="flex-row items-center">
            <HubSymbol name="sort" size={18} color="#93A7A2" />
            <Text className="ml-2 text-xs font-semibold text-muted">Sort</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mb-5 pr-4">
          {SORTS.map((option) => (
            <FilterChip key={option.id} label={option.label} selected={sort === option.id} onPress={() => setSort(option.id)} />
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator className="my-12" color="#72F0C6" /> : null}
        {error ? (
          <View className="mb-4 flex-row rounded-2xl border border-warning bg-surface p-4">
            <HubSymbol name="info" size={20} color="#FFC857" />
            <Text className="ml-3 flex-1 text-warning">{error}</Text>
          </View>
        ) : null}
        {!loading ? results.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            localStatus={localStatusForApp(app, installedByPackage)}
            showCategory={category === "all"}
          />
        )) : null}

        {!loading && !error && results.length === 0 ? (
          <View className="items-center rounded-[26px] border border-dashed border-line bg-surface px-7 py-12">
            <HubSymbol name="filter_alt_off" size={38} color="#93A7A2" />
            <Text className="mt-4 text-lg font-bold text-ink">Nothing matches yet</Text>
            <Text className="mt-2 text-center leading-5 text-muted">Clear a filter or switch category to widen the results.</Text>
            <Pressable
              className="mt-6 rounded-full bg-ink px-5 py-3"
              onPress={() => { setAvailability("all"); setTrust("all"); setQuery(""); }}
            >
              <Text className="font-bold text-canvas">Clear filters</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={selected ? "mr-2 rounded-full bg-mint px-4 py-2.5" : "mr-2 rounded-full border border-line bg-surface px-4 py-2.5"}
      onPress={onPress}
    >
      <Text className={selected ? "text-sm font-bold text-canvas" : "text-sm font-semibold text-ink"}>{label}</Text>
    </Pressable>
  );
}

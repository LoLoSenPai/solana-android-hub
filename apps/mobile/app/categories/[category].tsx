import { GAME_GENRES, type CatalogAppDto, type GameGenre } from "@hub/api-client";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppCard } from "@/components/AppCard";
import { HubSymbol } from "@/components/HubSymbol";
import {
  categoryDefinition,
  filterAndSortApps,
  localStatusForApp,
  type AvailabilityFilter,
  type BrowseSort,
  type GenreFilter,
  type TrustFilter
} from "@/features/catalog/discovery";
import { loadCatalog } from "@/features/catalog/api";
import { listInstalledApps, type LocalInstallRecord } from "@/storage/database";

const AVAILABILITY_FILTERS: readonly { id: AvailabilityFilter; label: string }[] = [
  { id: "all", label: "All apps" },
  { id: "not-installed", label: "Ready to install" },
  { id: "installed", label: "Installed" },
  { id: "updates", label: "Updates" }
];

const TRUST_FILTERS: readonly { id: TrustFilter; label: string }[] = [
  { id: "all", label: "All available" },
  { id: "approved", label: "Approved" },
  { id: "server-checked", label: "Checked release" },
  { id: "preview", label: "Early access" }
];

const SORTS: readonly { id: BrowseSort; label: string }[] = [
  { id: "recent", label: "Recently updated" },
  { id: "name", label: "Name A–Z" },
  { id: "trust", label: "Trust signal" }
];

export default function CategoryScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category: string }>();
  const category = categoryDefinition(categoryParam).id;
  const definition = categoryDefinition(category);
  const isGames = category === "games";
  const [apps, setApps] = useState<readonly CatalogAppDto[]>([]);
  const [installedApps, setInstalledApps] = useState<readonly LocalInstallRecord[]>([]);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [trust, setTrust] = useState<TrustFilter>("all");
  const [sort, setSort] = useState<BrowseSort>("recent");
  const [genre, setGenre] = useState<GenreFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    genre: isGames ? genre : "all",
    installedByPackage
  }), [apps, availability, category, genre, installedByPackage, isGames, query, sort, trust]);
  const categoryAppCount = useMemo(
    () => filterAndSortApps({ apps, category, query: "", availability: "all", trust: "all", sort: "recent", genre: "all", installedByPackage }).length,
    [apps, category, installedByPackage]
  );
  const updateCount = useMemo(
    () => filterAndSortApps({ apps, category, query: "", availability: "updates", trust: "all", sort: "recent", genre: "all", installedByPackage }).length,
    [apps, category, installedByPackage]
  );
  const activeFilterCount = Number(availability !== "all") + Number(trust !== "all") + Number(sort !== "recent") + Number(isGames && genre !== "all");

  const clearFilters = () => {
    setAvailability("all");
    setTrust("all");
    setSort("recent");
    setGenre("all");
    setQuery("");
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable accessibilityLabel="Go back" className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface active:bg-raised" onPress={() => router.back()}>
            <HubSymbol name="arrow_back" size={24} />
          </Pressable>
          <Text className="text-xs font-semibold text-muted">{categoryAppCount} {categoryAppCount === 1 ? "app" : "apps"}</Text>
        </View>

        <View className="mt-7 flex-row items-end">
          <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-raised">
            <HubSymbol name={definition.icon} size={30} color={definition.accent} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-[36px] font-bold leading-[40px] tracking-[-1px] text-ink">{definition.label}</Text>
            <Text className="mt-1 text-sm text-muted">{isGames ? "Find your next game" : definition.description}</Text>
          </View>
        </View>

        <View className="mt-6 flex-row items-center rounded-[20px] border border-line bg-surface px-4 py-1">
          <HubSymbol name="search" size={22} color="#95A5B7" />
          <TextInput
            accessibilityLabel={`Search ${definition.label}`}
            className="ml-3 h-14 flex-1 text-base text-ink"
            placeholder={`Search ${definition.label.toLocaleLowerCase()}`}
            placeholderTextColor="#718399"
            selectionColor="#77A7FF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? <Pressable accessibilityLabel="Clear search" className="p-2" onPress={() => setQuery("")}><HubSymbol name="close" size={20} color="#95A5B7" /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-4 pr-4">
          {isGames ? <CompactFilter label={genre === "all" ? "All genres" : genreLabel(genre)} selected={genre !== "all"} onPress={() => setFiltersOpen(true)} /> : null}
          <CompactFilter label={availability === "installed" ? "Installed" : "Installed"} selected={availability === "installed"} onPress={() => setAvailability((current) => current === "installed" ? "all" : "installed")} />
          {updateCount > 0 ? <CompactFilter label={`Updates ${updateCount}`} selected={availability === "updates"} onPress={() => setAvailability((current) => current === "updates" ? "all" : "updates")} /> : null}
          <CompactFilter label="Approved" selected={trust === "approved"} onPress={() => setTrust((current) => current === "approved" ? "all" : "approved")} />
          <CompactFilter label={sort === "recent" ? "Recent" : sort === "name" ? "A–Z" : "Trust"} selected={sort !== "recent"} icon="sort" onPress={() => setFiltersOpen(true)} />
          <CompactFilter label={activeFilterCount ? `Filters ${activeFilterCount}` : "Filters"} selected={activeFilterCount > 0} icon="tune" onPress={() => setFiltersOpen(true)} />
        </ScrollView>

        <View className="mb-4 mt-7 flex-row items-end justify-between">
          <View><Text className="text-[25px] font-bold text-ink">{results.length} {results.length === 1 ? "game" : category === "games" ? "games" : results.length === 1 ? "app" : "apps"}</Text><Text className="mt-1 text-xs text-muted">Available for this category</Text></View>
          {activeFilterCount || query ? <Pressable onPress={clearFilters}><Text className="font-semibold text-mint">Clear</Text></Pressable> : null}
        </View>

        {loading ? <ActivityIndicator className="my-12" color="#77A7FF" /> : null}
        {error ? <View className="mb-4 flex-row rounded-2xl border border-warning bg-surface p-4"><HubSymbol name="info" size={20} color="#FFD58A" /><Text className="ml-3 flex-1 text-warning">{error}</Text></View> : null}
        {!loading ? results.map((app) => <AppCard key={app.id} app={app} localStatus={localStatusForApp(app, installedByPackage)} showCategory={category === "all"} />) : null}

        {!loading && !error && results.length === 0 ? (
          <View className="items-center rounded-[26px] border border-dashed border-line bg-surface px-7 py-12">
            <HubSymbol name="filter_alt_off" size={38} color="#95A5B7" />
            <Text className="mt-4 text-lg font-bold text-ink">{activeFilterCount || query ? "Nothing matches yet" : "No apps here yet"}</Text>
            <Text className="mt-2 text-center leading-5 text-muted">{activeFilterCount || query ? "Clear one filter to see more apps." : "This category will fill up as more publishers join the Hub."}</Text>
            {activeFilterCount || query ? <Pressable className="mt-6 rounded-full bg-mint px-5 py-3" onPress={clearFilters}><Text className="font-bold text-canvas">Clear filters</Text></Pressable> : null}
          </View>
        ) : null}
      </ScrollView>

      <FilterSheet
        visible={filtersOpen}
        isGames={isGames}
        genre={genre}
        availability={availability}
        trust={trust}
        sort={sort}
        onGenre={setGenre}
        onAvailability={setAvailability}
        onTrust={setTrust}
        onSort={setSort}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </SafeAreaView>
  );
}

function CompactFilter({ label, selected, icon, onPress }: { label: string; selected: boolean; icon?: "sort" | "tune"; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} className={selected ? "mr-2 h-12 flex-row items-center rounded-full bg-mint px-4" : "mr-2 h-12 flex-row items-center rounded-full border border-line bg-surface px-4"} onPress={onPress}>
    {icon ? <HubSymbol name={icon} size={17} color={selected ? "#091018" : "#95A5B7"} /> : null}
    <Text className={selected ? `${icon ? "ml-2 " : ""}text-sm font-bold text-canvas` : `${icon ? "ml-2 " : ""}text-sm font-semibold text-ink`}>{label}</Text>
  </Pressable>;
}

function FilterSheet(props: {
  visible: boolean;
  isGames: boolean;
  genre: GenreFilter;
  availability: AvailabilityFilter;
  trust: TrustFilter;
  sort: BrowseSort;
  onGenre: (value: GenreFilter) => void;
  onAvailability: (value: AvailabilityFilter) => void;
  onTrust: (value: TrustFilter) => void;
  onSort: (value: BrowseSort) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
    <Pressable className="flex-1 justify-end bg-black/60" onPress={props.onClose}>
      <Pressable className="max-h-[86%] rounded-t-[30px] border border-line bg-surface px-5 pb-8 pt-4" onPress={() => undefined}>
        <View className="mb-4 h-1 w-12 self-center rounded-full bg-line" />
        <View className="flex-row items-center justify-between"><Text className="text-[28px] font-bold text-ink">Filters</Text><Pressable className="h-12 w-12 items-center justify-center rounded-full bg-raised" onPress={props.onClose}><HubSymbol name="close" size={22} /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {props.isGames ? <FilterGroup title="Genre"><FilterOptions options={[{ id: "all" as const, label: "All genres" }, ...GAME_GENRES.map((id) => ({ id, label: genreLabel(id) }))]} value={props.genre} onChange={props.onGenre} /></FilterGroup> : null}
          <FilterGroup title="On this phone"><FilterOptions options={AVAILABILITY_FILTERS} value={props.availability} onChange={props.onAvailability} /></FilterGroup>
          <FilterGroup title="Release"><FilterOptions options={TRUST_FILTERS} value={props.trust} onChange={props.onTrust} /></FilterGroup>
          <FilterGroup title="Sort"><FilterOptions options={SORTS} value={props.sort} onChange={props.onSort} /></FilterGroup>
        </ScrollView>
        <View className="mt-5 flex-row gap-3"><Pressable className="h-14 flex-1 items-center justify-center rounded-full border border-line bg-raised" onPress={props.onClear}><Text className="font-bold text-ink">Clear</Text></Pressable><Pressable className="h-14 flex-[1.4] items-center justify-center rounded-full bg-mint" onPress={props.onClose}><Text className="font-bold text-canvas">Show results</Text></Pressable></View>
      </Pressable>
    </Pressable>
  </Modal>;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View className="mt-6"><Text className="mb-3 text-xs font-bold uppercase tracking-[1.5px] text-muted">{title}</Text>{children}</View>;
}

function FilterOptions<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View className="flex-row flex-wrap gap-2">{options.map((option) => <Pressable key={option.id} accessibilityState={{ selected: option.id === value }} className={option.id === value ? "min-h-12 justify-center rounded-full bg-mint px-4" : "min-h-12 justify-center rounded-full border border-line bg-raised px-4"} onPress={() => onChange(option.id)}><Text className={option.id === value ? "font-bold text-canvas" : "font-semibold text-ink"}>{option.label}</Text></Pressable>)}</View>;
}

function genreLabel(genre: GameGenre): string {
  return genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`;
}

import { GAME_GENRES, type CatalogAppDto } from "@hub/api-client";
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
  type BrowseSort,
  type GenreFilter
} from "@/features/catalog/discovery";
import { loadCatalog } from "@/features/catalog/api";
import { listInstalledApps, type LocalInstallRecord } from "@/storage/database";

const SORTS: readonly { id: BrowseSort; label: string }[] = [
  { id: "recent", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "name-asc", label: "Name A–Z" },
  { id: "name-desc", label: "Name Z–A" }
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
    availability: "all",
    trust: "all",
    sort,
    genre: isGames ? genre : "all",
    installedByPackage
  }), [apps, category, genre, installedByPackage, isGames, query, sort]);
  const categoryAppCount = useMemo(
    () => filterAndSortApps({ apps, category, query: "", availability: "all", trust: "all", sort: "recent", genre: "all", installedByPackage }).length,
    [apps, category, installedByPackage]
  );
  const hasActiveFilters = sort !== "recent" || (isGames && genre !== "all");

  const clearFilters = () => {
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
          <Pressable accessibilityLabel="Open settings" className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface active:bg-raised" onPress={() => router.push("/settings")}>
            <HubSymbol name="settings" size={22} />
          </Pressable>
        </View>

        <View className="mt-7 flex-row items-end">
          <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-raised">
            <HubSymbol name={definition.icon} size={30} color={definition.accent} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-[36px] font-bold leading-[40px] tracking-[-1px] text-ink">{definition.label}</Text>
            <Text className="mt-1 text-sm text-muted">{isGames ? "Find the kind of game you want to play" : definition.description}</Text>
          </View>
        </View>

        <View className="mt-6 flex-row items-center rounded-[20px] border border-line bg-surface px-4 py-1">
          <HubSymbol name="search" size={22} color="#95A5B7" />
          <TextInput
            accessibilityLabel={`Search ${definition.label}`}
            className="ml-3 h-14 flex-1 text-base text-ink"
            placeholder={isGames ? "Search games" : `Search ${definition.label.toLocaleLowerCase()}`}
            placeholderTextColor="#718399"
            selectionColor="#77A7FF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? <Pressable accessibilityLabel="Clear search" className="p-2" onPress={() => setQuery("")}><HubSymbol name="close" size={20} color="#95A5B7" /></Pressable> : null}
        </View>

        {isGames ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-4 pr-4">
            <GenreChip genre="all" selected={genre === "all"} onPress={setGenre} />
            {GAME_GENRES.map((item) => <GenreChip key={item} genre={item} selected={genre === item} onPress={setGenre} />)}
          </ScrollView>
        ) : null}

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-sm text-muted">{categoryAppCount} {categoryAppCount === 1 ? "app" : "apps"} in this category</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sort and filter apps"
            className={hasActiveFilters ? "h-12 flex-row items-center rounded-full bg-mint px-4" : "h-12 flex-row items-center rounded-full border border-line bg-surface px-4"}
            onPress={() => setFiltersOpen(true)}
          >
            <HubSymbol name={isGames ? "tune" : "sort"} size={18} color={hasActiveFilters ? "#091018" : "#95A5B7"} />
            <Text className={hasActiveFilters ? "ml-2 text-sm font-bold text-canvas" : "ml-2 text-sm font-semibold text-ink"}>
              {isGames ? "Filters & sort" : sortLabel(sort)}
            </Text>
          </Pressable>
        </View>

        <View className="mb-4 mt-7 flex-row items-end justify-between">
          <View>
            <Text className="text-[25px] font-bold text-ink">{results.length} {results.length === 1 ? (isGames ? "game" : "app") : (isGames ? "games" : "apps")}</Text>
            <Text className="mt-1 text-xs text-muted">Sorted by {sortLabel(sort).toLocaleLowerCase()}</Text>
          </View>
          {hasActiveFilters || query ? <Pressable onPress={clearFilters}><Text className="font-semibold text-mint">Clear</Text></Pressable> : null}
        </View>

        {loading ? <ActivityIndicator className="my-12" color="#77A7FF" /> : null}
        {error ? <View className="mb-4 flex-row rounded-2xl border border-warning bg-surface p-4"><HubSymbol name="info" size={20} color="#FFD58A" /><Text className="ml-3 flex-1 text-warning">{error}</Text></View> : null}
        {!loading ? results.map((app) => <AppCard key={app.id} app={app} localStatus={localStatusForApp(app, installedByPackage)} showCategory={category === "all"} />) : null}

        {!loading && !error && results.length === 0 ? (
          <View className="items-center rounded-[26px] border border-dashed border-line bg-surface px-7 py-12">
            <HubSymbol name="filter_alt_off" size={38} color="#95A5B7" />
            <Text className="mt-4 text-lg font-bold text-ink">{hasActiveFilters || query ? "Nothing matches yet" : "No apps here yet"}</Text>
            <Text className="mt-2 text-center leading-5 text-muted">{hasActiveFilters || query ? "Try another genre or clear the search." : "This category will fill up as more publishers join Dapport."}</Text>
            {hasActiveFilters || query ? <Pressable className="mt-6 rounded-full bg-mint px-5 py-3" onPress={clearFilters}><Text className="font-bold text-canvas">Clear filters</Text></Pressable> : null}
          </View>
        ) : null}
      </ScrollView>

      <FilterSheet
        visible={filtersOpen}
        isGames={isGames}
        genre={genre}
        sort={sort}
        onGenre={setGenre}
        onSort={setSort}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </SafeAreaView>
  );
}

function GenreChip({ genre, selected, onPress }: { genre: GenreFilter; selected: boolean; onPress: (value: GenreFilter) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={selected ? "mr-2 h-12 items-center justify-center rounded-full bg-mint px-4" : "mr-2 h-12 items-center justify-center rounded-full border border-line bg-surface px-4"}
      onPress={() => onPress(genre)}
    >
      <Text className={selected ? "text-sm font-bold text-canvas" : "text-sm font-semibold text-ink"}>{genreLabel(genre)}</Text>
    </Pressable>
  );
}

function FilterSheet(props: {
  visible: boolean;
  isGames: boolean;
  genre: GenreFilter;
  sort: BrowseSort;
  onGenre: (value: GenreFilter) => void;
  onSort: (value: BrowseSort) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={props.onClose}>
        <Pressable className="max-h-[86%] rounded-t-[30px] border border-line bg-surface px-5 pb-8 pt-4" onPress={() => undefined}>
          <View className="mb-4 h-1 w-12 self-center rounded-full bg-line" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[28px] font-bold text-ink">{props.isGames ? "Filters & sort" : "Sort apps"}</Text>
            <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-raised" onPress={props.onClose}><HubSymbol name="close" size={22} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {props.isGames ? (
              <FilterGroup title="Genre">
                <FilterOptions options={[{ id: "all" as const, label: "All games" }, ...GAME_GENRES.map((id) => ({ id, label: genreLabel(id) }))]} value={props.genre} onChange={props.onGenre} />
              </FilterGroup>
            ) : null}
            <FilterGroup title="Sort by"><FilterOptions options={SORTS} value={props.sort} onChange={props.onSort} /></FilterGroup>
          </ScrollView>
          <View className="mt-5 flex-row gap-3">
            <Pressable className="h-14 flex-1 items-center justify-center rounded-full border border-line bg-raised" onPress={props.onClear}><Text className="font-bold text-ink">Reset</Text></Pressable>
            <Pressable className="h-14 flex-[1.4] items-center justify-center rounded-full bg-mint" onPress={props.onClose}><Text className="font-bold text-canvas">Show results</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View className="mt-6"><Text className="mb-3 text-xs font-bold uppercase tracking-[1.5px] text-muted">{title}</Text>{children}</View>;
}

function FilterOptions<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View className="flex-row flex-wrap gap-2">{options.map((option) => <Pressable key={option.id} accessibilityState={{ selected: option.id === value }} className={option.id === value ? "min-h-12 justify-center rounded-full bg-mint px-4" : "min-h-12 justify-center rounded-full border border-line bg-raised px-4"} onPress={() => onChange(option.id)}><Text className={option.id === value ? "font-bold text-canvas" : "font-semibold text-ink"}>{option.label}</Text></Pressable>)}</View>;
}

function genreLabel(genre: GenreFilter): string {
  if (genre === "all") return "All games";
  return genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`;
}

function sortLabel(sort: BrowseSort): string {
  return SORTS.find((option) => option.id === sort)?.label ?? "Newest";
}

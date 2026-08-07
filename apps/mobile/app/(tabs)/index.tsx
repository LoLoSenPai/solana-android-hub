import type { CatalogAppDto } from "@hub/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { AppCard } from "@/components/AppCard";
import { loadCatalog } from "@/features/catalog/api";
import { initializeLocalDatabase } from "@/storage/database";

export default function DiscoverScreen() {
  const [apps, setApps] = useState<readonly CatalogAppDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await initializeLocalDatabase();
      setApps(await loadCatalog());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Catalogue unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  if (loading) return <View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#9cf4c8" /></View>;
  return (
    <FlatList
      className="flex-1 bg-canvas"
      contentContainerClassName="p-4 pb-12"
      data={[...apps]}
      keyExtractor={(app) => app.id}
      renderItem={({ item }) => <AppCard app={item} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void refresh(); }} tintColor="#9cf4c8" />}
      ListHeaderComponent={
        <View className="mb-6 mt-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-mint">Standalone Android catalogue</Text>
          <Text className="mt-2 text-4xl font-bold tracking-tight text-ink">Install with the evidence visible.</Text>
          <Text className="mt-3 leading-6 text-muted">Every APK is checked again on this device before Android opens its installer.</Text>
          {error && <Text className="mt-3 rounded-xl border border-warning p-3 text-warning">{error}</Text>}
        </View>
      }
      ListEmptyComponent={<Text className="rounded-xl border border-dashed border-line p-5 text-muted">No eligible releases in this environment.</Text>}
    />
  );
}

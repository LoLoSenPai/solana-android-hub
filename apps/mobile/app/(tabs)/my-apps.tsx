import type { CatalogAppDto } from "@hub/api-client";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppArtwork } from "@/components/AppArtwork";
import { HubSymbol } from "@/components/HubSymbol";
import { loadCatalog } from "@/features/catalog/api";
import { useInstalledApps } from "@/features/installer/use-installed-apps";

export default function MyAppsScreen() {
  const { installedApps: apps, loading, error, refresh } = useInstalledApps();
  const [catalogueById, setCatalogueById] = useState<Record<string, CatalogAppDto>>({});
  const [catalogueAvailable, setCatalogueAvailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshLibrary = () => { void refresh(); setRefreshKey((value) => value + 1); };

  useFocusEffect(useCallback(() => {
    let active = true;
    setCatalogueAvailable(false);
    void loadCatalog().then((catalog) => {
      if (active) {
        setCatalogueById(Object.fromEntries(catalog.map((app) => [app.id, app])));
        setCatalogueAvailable(true);
      }
    }).catch(() => {
      if (active) setCatalogueAvailable(false);
    });
    return () => { active = false; };
  }, [refreshKey]));

  const updates = useMemo(() => Object.fromEntries(apps.flatMap((app) => {
    const release = catalogueAvailable ? catalogueById[app.appId]?.latestRelease : null;
    return release && BigInt(release.versionCode) > BigInt(app.versionCode)
      ? [[app.packageName, release]] : [];
  })), [apps, catalogueById, catalogueAvailable]);
  const updateCount = Object.keys(updates).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshLibrary} tintColor="#77A7FF" />}
      >
        <View className="mb-7 mt-4">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-mint">Installed with Dapport</Text>
          <Text className="mt-2 text-[38px] font-bold tracking-[-1px] text-ink">Library</Text>
          <Text className="mt-3 max-w-[350px] leading-6 text-muted">Find the apps you installed here and see when an update is ready.</Text>
        </View>

        {apps.length > 0 ? (
          <View className="mb-7 flex-row rounded-[24px] border border-line bg-surface p-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-raised">
              <HubSymbol name={updateCount > 0 ? "update" : "check_circle"} size={25} color={updateCount > 0 ? "#FF7A59" : "#77A7FF"} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-base font-bold text-ink">{updateCount > 0 ? `${updateCount} ${updateCount === 1 ? "update" : "updates"} ready` : catalogueAvailable ? "Everything is current" : "Your installed apps"}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{catalogueAvailable ? "Updates keep the same package and signing identity." : "Connect to check for updates."}</Text>
            </View>
          </View>
        ) : null}

        {apps.map((app) => {
          const update = updates[app.packageName];
          return (
            <Link key={app.packageName} href={{ pathname: "/apps/[slug]", params: { slug: app.slug } }} className="mb-3 overflow-hidden rounded-[24px] border border-line bg-surface p-4">
              <View className="flex-row items-center">
                <AppArtwork app={catalogueById[app.appId] ?? { iconUrl: null }} size={64} radius={19} />
                <View className="ml-4 flex-1">
                  <Text className="text-[17px] font-bold text-ink">{app.appName}</Text>
                  <Text className="mt-1 text-sm text-muted">Version {app.versionName}</Text>
                  <View className="mt-3 flex-row items-center">
                    <HubSymbol
                      name={update ? "update" : "check_circle"}
                      size={16}
                      color={update ? "#FF7A59" : "#77A7FF"}
                    />
                    <Text className={update ? "ml-2 text-xs font-bold text-coral" : "ml-2 text-xs text-muted"}>
                      {update ? `Update to ${update.versionName}` : "Installed"}
                    </Text>
                  </View>
                </View>
                <HubSymbol name="chevron_right" size={20} color="#95A5B7" />
              </View>
            </Link>
          );
        })}

        {loading ? <ActivityIndicator className="my-10" color="#77A7FF" /> : null}
        {!loading && error ? (
          <View className="items-center rounded-[28px] border border-line bg-surface px-8 py-10">
            <Text className="text-lg font-bold text-ink">Library temporarily unavailable</Text>
            <Pressable accessibilityRole="button" className="mt-5 rounded-full bg-raised px-5 py-3" onPress={refreshLibrary}>
              <Text className="font-semibold text-ink">Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && apps.length === 0 ? (
          <View className="items-center rounded-[28px] border border-dashed border-line bg-surface px-8 py-14">
            <HubSymbol name="download_for_offline" size={44} color="#95A5B7" />
            <Text className="mt-5 text-xl font-bold text-ink">Your library is empty</Text>
            <Text className="mt-2 text-center leading-5 text-muted">Apps you install through Dapport will appear here with update status.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

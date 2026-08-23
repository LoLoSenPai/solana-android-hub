import { AppInstaller } from "@hub/app-installer";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppArtwork } from "@/components/AppArtwork";
import { HubSymbol } from "@/components/HubSymbol";
import { loadCatalog } from "@/features/catalog/api";
import { listInstalledApps, type LocalInstallRecord } from "@/storage/database";

export default function MyAppsScreen() {
  const [apps, setApps] = useState<readonly LocalInstallRecord[]>([]);
  const [states, setStates] = useState<Record<string, string>>({});
  const [updates, setUpdates] = useState<Record<string, { versionCode: string; versionName: string }>>({});

  useFocusEffect(useCallback(() => {
    void Promise.all([listInstalledApps(), loadCatalog()]).then(async ([records, catalog]) => {
      setApps(records);
      const installedStates = await Promise.all(records.map(async (record) => [record.packageName, await AppInstaller.getInstalledPackageInfo(record.packageName)] as const));
      setStates(Object.fromEntries(installedStates.map(([packageName, state]) => [packageName, state.status])));
      const nextUpdates: Record<string, { versionCode: string; versionName: string }> = {};
      for (const record of records) {
        const release = catalog.find((candidate) => candidate.id === record.appId)?.latestRelease;
        const installedState = installedStates.find(([packageName]) => packageName === record.packageName)?.[1];
        const installedVersion = installedState?.status === "installed" ? installedState.versionCode : record.versionCode;
        if (release && BigInt(release.versionCode) > BigInt(installedVersion)) {
          nextUpdates[record.packageName] = { versionCode: release.versionCode, versionName: release.versionName };
        }
      }
      setUpdates(nextUpdates);
    });
  }, []));

  const updateCount = Object.keys(updates).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-36" showsVerticalScrollIndicator={false}>
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
              <Text className="text-base font-bold text-ink">{updateCount > 0 ? `${updateCount} ${updateCount === 1 ? "update" : "updates"} ready` : "Everything is current"}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">Updates keep the same package and signing identity.</Text>
            </View>
          </View>
        ) : null}

        {apps.map((app) => {
          const update = updates[app.packageName];
          const visibleState = states[app.packageName];
          return (
            <Link key={app.packageName} href={{ pathname: "/apps/[slug]", params: { slug: app.slug } }} className="mb-3 overflow-hidden rounded-[24px] border border-line bg-surface p-4">
              <View className="flex-row items-center">
                <AppArtwork app={{ iconUrl: null }} size={64} radius={19} />
                <View className="ml-4 flex-1">
                  <Text className="text-[17px] font-bold text-ink">{app.appName}</Text>
                  <Text className="mt-1 text-sm text-muted">Version {app.versionName}</Text>
                  <View className="mt-3 flex-row items-center">
                    <HubSymbol
                      name={update ? "update" : visibleState === "installed" ? "check_circle" : "visibility_off"}
                      size={16}
                      color={update ? "#FF7A59" : visibleState === "installed" ? "#77A7FF" : "#95A5B7"}
                    />
                    <Text className={update ? "ml-2 text-xs font-bold text-coral" : "ml-2 text-xs text-muted"}>
                      {update ? `Update to ${update.versionName}` : visibleState === "installed" ? "Installed" : visibleState === "visibility_unknown" ? "State unavailable" : "Local record may be stale"}
                    </Text>
                  </View>
                </View>
                <HubSymbol name="chevron_right" size={20} color="#95A5B7" />
              </View>
            </Link>
          );
        })}

        {apps.length === 0 ? (
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

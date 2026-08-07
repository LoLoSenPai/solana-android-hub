import { AppInstaller } from "@hub/app-installer";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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
  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-4 pb-12">
      <Text className="mb-2 text-3xl font-bold text-ink">My Apps</Text>
      <Text className="mb-6 leading-6 text-muted">Only apps installed through this Hub are stored here. No installed-app inventory leaves the device.</Text>
      {apps.map((app) => (
        <Link key={app.packageName} href={{ pathname: "/apps/[slug]", params: { slug: app.slug } }} className="mb-3 rounded-2xl border border-line bg-surface p-4">
          <View>
            <Text className="text-lg font-semibold text-ink">{app.appName}</Text>
            <Text className="mt-1 text-sm text-muted">v{app.versionName} ({app.versionCode})</Text>
            <Text className="mt-2 text-xs text-mint">{states[app.packageName] === "installed" ? "Installed" : states[app.packageName] === "visibility_unknown" ? "Installed state unavailable" : "Local record is stale"}</Text>
            {updates[app.packageName] ? <Text className="mt-2 text-sm font-semibold text-warning">Update available: v{updates[app.packageName]?.versionName} ({updates[app.packageName]?.versionCode})</Text> : null}
          </View>
        </Link>
      ))}
      {apps.length === 0 && <Text className="rounded-xl border border-dashed border-line p-5 text-muted">No Hub installation records yet.</Text>}
    </ScrollView>
  );
}

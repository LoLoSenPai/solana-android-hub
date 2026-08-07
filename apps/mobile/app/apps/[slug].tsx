import type { CatalogAppDto } from "@hub/api-client";
import { AppInstaller, type InstalledPackageInfo } from "@hub/app-installer";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { loadCatalogApp } from "@/features/catalog/api";
import { listInstalledApps } from "@/storage/database";

export default function AppDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [app, setApp] = useState<CatalogAppDto | null>(null);
  const [installed, setInstalled] = useState<InstalledPackageInfo | null>(null);
  const [installedPermissions, setInstalledPermissions] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    void loadCatalogApp(slug).then(async (value) => {
      if (!value) {
        setError("App is no longer eligible");
        return;
      }
      setApp(value);
      const [packageState, localRecords] = await Promise.all([
        AppInstaller.getInstalledPackageInfo(value.latestRelease.packageName),
        listInstalledApps()
      ]);
      setInstalled(packageState.status === "installed" ? packageState : null);
      setInstalledPermissions(localRecords.find((record) => record.packageName === value.latestRelease.packageName)?.permissions ?? []);
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "App unavailable");
    });
  }, [slug]);

  if (!app && !error) return <View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#9cf4c8" /></View>;
  if (!app) return <View className="flex-1 bg-canvas p-5"><Text className="text-warning">{error}</Text></View>;
  const release = app.latestRelease;
  const isUpdate = installed ? BigInt(release.versionCode) > BigInt(installed.versionCode) : false;
  const addedPermissions = isUpdate ? release.permissions.filter((permission) => !installedPermissions.includes(permission)) : [];
  const removedPermissions = isUpdate ? installedPermissions.filter((permission) => !release.permissions.includes(permission)) : [];
  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-5 pb-12">
      <View className="h-20 w-20 items-center justify-center rounded-3xl bg-mint"><Text className="text-3xl font-bold text-canvas">{app.name.slice(0, 1)}</Text></View>
      <Text className={release.previewOnly ? "mt-5 text-xs font-bold uppercase tracking-widest text-warning" : "mt-5 text-xs font-bold uppercase tracking-widest text-mint"}>
        {release.previewOnly ? "Development preview" : "Verified publisher release"}
      </Text>
      <Text className="mt-2 text-4xl font-bold text-ink">{app.name}</Text>
      <Text className="mt-3 leading-6 text-muted">{app.description ?? app.shortDescription}</Text>

      <View className="my-6 rounded-2xl border border-line bg-surface p-4">
        <TrustFact label="Publisher control" value="Verified" />
        <TrustFact label="Distribution consent" value="Active" />
        <TrustFact label="Release authenticity" value={release.trust.releaseAuthenticity.replaceAll("_", " ")} />
        <TrustFact label="Solana Mobile approval" value={release.trust.solanaMobileApproval.replaceAll("_", " ")} />
      </View>

      <Text className="text-lg font-semibold text-ink">Android release</Text>
      <Text className="mt-2 text-muted">{release.packageName}</Text>
      <Text className="text-muted">Version {release.versionName} ({release.versionCode}) · minSdk {release.minSdk}</Text>
      {isUpdate ? <Text className="mt-3 font-semibold text-warning">Update available from v{installed?.versionName ?? installed?.versionCode} to v{release.versionName}.</Text> : null}
      {addedPermissions.length > 0 ? <Text className="mt-3 text-sm leading-5 text-warning">New permissions: {addedPermissions.join(", ")}</Text> : null}
      {removedPermissions.length > 0 ? <Text className="mt-2 text-sm leading-5 text-muted">Removed permissions: {removedPermissions.join(", ")}</Text> : null}
      <Text className="mt-4 text-sm leading-5 text-muted">SHA-256, package, version, permissions, and current signing certificate must all match before PackageInstaller can open.</Text>
      <Link href={{ pathname: "/install/[slug]", params: { slug: app.slug } }} className="mt-7 overflow-hidden rounded-2xl bg-mint px-5 py-4 text-center font-bold text-canvas">
        {isUpdate ? "Validate and update" : "Continue to secure install"}
      </Link>
    </ScrollView>
  );
}

function TrustFact({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 last:mb-0">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="mt-1 capitalize text-ink">{value}</Text>
    </View>
  );
}

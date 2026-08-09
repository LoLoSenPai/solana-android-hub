import type { CatalogAppDto } from "@hub/api-client";
import { AppInstaller, type InstalledPackageInfo } from "@hub/app-installer";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppArtwork } from "@/components/AppArtwork";
import { HubSymbol } from "@/components/HubSymbol";
import { categoryDefinition } from "@/features/catalog/discovery";
import { loadCatalogApp } from "@/features/catalog/api";
import { getInstallAction, type InstallAction } from "@/features/catalog/install-action";
import { listInstalledApps } from "@/storage/database";

export default function AppDetailScreen() {
  const router = useRouter();
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

  if (!app && !error) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#77A7FF" />
      </View>
    );
  }

  if (!app) {
    return (
      <SafeAreaView className="flex-1 bg-canvas p-5">
        <Pressable className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface" onPress={() => router.back()}>
          <HubSymbol name="arrow_back" size={24} />
        </Pressable>
        <View className="mt-16 items-center rounded-[26px] border border-warning bg-surface p-8">
          <HubSymbol name="error" size={38} color="#FFC857" />
          <Text className="mt-4 text-center text-lg font-bold text-ink">App unavailable</Text>
          <Text className="mt-2 text-center leading-5 text-warning">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const release = app.latestRelease;
  const category = categoryDefinition(app.category);
  const installAction = getInstallAction(release.versionCode, installed?.versionCode);
  const isUpdate = installAction === "update";
  const addedPermissions = isUpdate ? release.permissions.filter((permission) => !installedPermissions.includes(permission)) : [];
  const removedPermissions = isUpdate ? installedPermissions.filter((permission) => !release.permissions.includes(permission)) : [];
  const coverArtwork = app.bannerUrl ?? app.featureGraphicUrl ?? app.screenshots[0];

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView className="flex-1" contentContainerClassName="pb-14" showsVerticalScrollIndicator={false}>
        {coverArtwork ? (
          <ImageBackground
            source={{ uri: coverArtwork }}
            resizeMode="cover"
            style={{ width: "100%", aspectRatio: app.bannerUrl ? 2 : 16 / 9 }}
          >
            <View className="h-full justify-between px-4 pb-4 pt-12" style={{ backgroundColor: "rgba(5, 12, 21, 0.5)" }}>
              <DetailHeader onBack={() => router.back()} preview={release.previewOnly} />
              <View className="self-start rounded-full bg-canvas px-3 py-1.5">
                <Text className="text-xs font-bold text-ink">{category.label}</Text>
              </View>
            </View>
          </ImageBackground>
        ) : (
          <View className="h-[250px] justify-between bg-raised px-4 pb-8 pt-12">
            <DetailHeader onBack={() => router.back()} preview={release.previewOnly} />
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[1.6px] text-muted">{category.label}</Text>
                <Text className="mt-2 max-w-[270px] text-[28px] font-bold leading-8 text-ink">Made for Android.</Text>
              </View>
              <HubSymbol name={category.icon} size={48} color={category.accent} />
            </View>
          </View>
        )}

        <View className="-mt-2 rounded-t-[32px] bg-canvas px-5 pt-5">
          <View className="flex-row items-end justify-between">
            <View className="-mt-14 rounded-[26px] border-4 border-canvas bg-canvas">
              <AppArtwork app={app} size={104} radius={26} />
            </View>
            <InstallButton app={app} action={installAction} compact />
          </View>

          <Text className="mt-5 text-[38px] font-bold leading-[42px] tracking-[-1px] text-ink">{app.name}</Text>
          <Text className="mt-2 text-base leading-6 text-muted">{app.shortDescription ?? "Discover this Solana app"}</Text>
          {app.genres.length ? <View className="mt-4 flex-row flex-wrap gap-2">{app.genres.map((genre) => <View className="rounded-full border border-line bg-surface px-3 py-2" key={genre}><Text className="text-xs font-semibold text-muted">{genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`}</Text></View>)}</View> : null}
          {isUpdate ? (
            <View className="mt-4 flex-row items-center self-start rounded-full bg-coral px-4 py-2">
              <HubSymbol name="update" size={17} color="#091018" />
              <Text className="ml-2 text-sm font-bold text-canvas">Update to {release.versionName}</Text>
            </View>
          ) : installed ? (
            <View className="mt-4 flex-row items-center self-start rounded-full border border-line bg-surface px-4 py-2">
              <HubSymbol name="check_circle" size={17} color="#77A7FF" />
              <Text className="ml-2 text-sm font-semibold text-ink">
                {installAction === "newer-installed" ? "Newer version installed" : "Installed"} · {installed.versionName ?? installed.versionCode}
              </Text>
            </View>
          ) : null}

          <SectionTitle title="Safety at a glance" />
          <View className="overflow-hidden rounded-[26px] border border-line bg-surface">
            <EvidenceRow icon="person_check" label="Publisher" value="Current publisher" tone="mint" />
            <EvidenceRow icon="fact_check" label="Permission to list" value="Allowed on this Hub" tone="mint" />
            <EvidenceRow
              icon={release.previewOnly ? "science" : "shield_lock"}
              label="App file"
              value={release.previewOnly ? "Early access" : "Checked release"}
              tone={release.previewOnly ? "warning" : "mint"}
            />
            <EvidenceRow
              icon="approval"
              label="Solana Mobile approval"
              value={approvalLabel(release.trust.solanaMobileApproval)}
              tone={release.trust.solanaMobileApproval === "verified_approved" ? "mint" : "muted"}
              last
            />
          </View>
          <Text className="mt-3 text-xs leading-5 text-muted">These checks stay separate so one badge never hides an important detail. This Hub is independent from Solana Mobile.</Text>

          {app.screenshots.length > 0 ? (
            <>
              <SectionTitle title="Preview" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-5">
                {app.screenshots.map((screenshot, index) => (
                  <Image
                    key={`${screenshot}-${index}`}
                    accessibilityIgnoresInvertColors
                    source={{ uri: screenshot }}
                    resizeMode="cover"
                    className="mr-3 h-[410px] w-[230px] rounded-[24px] bg-surface"
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          {(app.description || app.shortDescription) ? (
            <>
              <SectionTitle title="About this app" />
              <Text className="text-[17px] leading-7 text-ink">{app.description ?? app.shortDescription}</Text>
            </>
          ) : null}

          <SectionTitle title={isUpdate ? "Permission changes" : "Data & permissions"} />
          {addedPermissions.length > 0 ? (
            <View className="mb-3 rounded-[22px] border border-warning bg-surface p-4">
              <Text className="text-sm font-bold text-warning">New in this update</Text>
              <Text className="mt-2 text-sm leading-5 text-ink">{addedPermissions.map(humanizePermission).join(", ")}</Text>
            </View>
          ) : null}
          {removedPermissions.length > 0 ? (
            <View className="mb-3 rounded-[22px] border border-line bg-surface p-4">
              <Text className="text-sm font-bold text-mint">Removed in this update</Text>
              <Text className="mt-2 text-sm leading-5 text-muted">{removedPermissions.map(humanizePermission).join(", ")}</Text>
            </View>
          ) : null}
          <View className="overflow-hidden rounded-[26px] border border-line bg-surface">
            {release.permissions.length > 0 ? release.permissions.map((permission, index) => (
              <PermissionRow key={permission} permission={permission} last={index === release.permissions.length - 1} />
            )) : (
              <View className="flex-row items-center p-5">
                <HubSymbol name="check_circle" size={23} color="#77A7FF" />
                <Text className="ml-3 flex-1 text-sm leading-5 text-muted">No permissions are listed in this release metadata.</Text>
              </View>
            )}
          </View>

          <SectionTitle title="Details" />
          <View className="overflow-hidden rounded-[26px] border border-line bg-surface">
            <InfoRow label="Version" value={`${release.versionName} (${release.versionCode})`} />
            <InfoRow label="Android required" value={`Android API ${release.minSdk}+`} />
            <InfoRow label="Download size" value={formatBytes(release.apkSize)} />
            {release.targetSdk ? <InfoRow label="Target SDK" value={String(release.targetSdk)} /> : null}
            {app.releaseUpdatedAt ? <InfoRow label="Release updated" value={formatDate(app.releaseUpdatedAt)} /> : null}
            <InfoRow label="Package" value={release.packageName} last />
          </View>

          <View className="mt-8 rounded-[26px] bg-raised p-5">
            <View className="flex-row items-start">
              <HubSymbol name="verified_user" size={24} color="#77A7FF" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-ink">Checked again before install</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">SHA-256, package, version, permissions, and current signing certificate must all match on this device.</Text>
              </View>
            </View>
            <InstallButton app={app} action={installAction} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailHeader({ onBack, preview }: { onBack: () => void; preview: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        accessibilityLabel="Go back"
        className="h-12 w-12 items-center justify-center rounded-2xl bg-canvas active:bg-surface"
        onPress={onBack}
      >
        <HubSymbol name="arrow_back" size={24} />
      </Pressable>
      <View className={preview ? "rounded-full bg-warning px-4 py-2" : "rounded-full bg-canvas px-4 py-2"}>
        <Text className={preview ? "text-xs font-bold text-canvas" : "text-xs font-bold text-ink"}>{preview ? "Early access" : "Checked release"}</Text>
      </View>
    </View>
  );
}

function InstallButton({
  app,
  action,
  compact = false
}: {
  app: CatalogAppDto;
  action: InstallAction;
  compact?: boolean;
}) {
  const label = action === "update"
    ? "Update"
    : action === "current"
      ? "Installed"
      : action === "newer-installed"
        ? "Newer version installed"
        : "Install securely";

  if (action === "current" || action === "newer-installed") {
    return (
      <View
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        className={compact ? "rounded-full border border-line bg-surface px-5 py-3" : "mt-5 rounded-[18px] border border-line bg-surface px-5 py-4"}
      >
        <Text className={compact ? "text-sm font-bold text-muted" : "text-center text-base font-bold text-muted"}>
          {compact && action === "newer-installed" ? "Newer installed" : label}
        </Text>
      </View>
    );
  }

  return (
    <Link href={{ pathname: "/install/[slug]", params: { slug: app.slug } }} asChild>
      <Pressable className={compact ? "rounded-full bg-ink px-5 py-3 active:opacity-80" : "mt-5 rounded-[18px] bg-mint px-5 py-4 active:opacity-80"}>
        <Text className={compact ? "text-sm font-bold text-canvas" : "text-center text-base font-bold text-canvas"}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text className="mb-4 mt-9 text-[25px] font-bold tracking-[-0.5px] text-ink">{title}</Text>;
}

function EvidenceRow({
  icon,
  label,
  value,
  tone,
  last = false
}: {
  icon: Parameters<typeof HubSymbol>[0]["name"];
  label: string;
  value: string;
  tone: "mint" | "warning" | "muted";
  last?: boolean;
}) {
  const color = tone === "mint" ? "#77A7FF" : tone === "warning" ? "#FFC857" : "#95A5B7";
  return (
    <View className={last ? "flex-row items-center p-4" : "flex-row items-center border-b border-line p-4"}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-raised">
        <HubSymbol name={icon} size={21} color={color} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-xs text-muted">{label}</Text>
        <Text className="mt-0.5 text-sm font-semibold text-ink">{value}</Text>
      </View>
      <HubSymbol name="check_circle" size={19} color={color} />
    </View>
  );
}

function PermissionRow({ permission, last }: { permission: string; last: boolean }) {
  return (
    <View className={last ? "flex-row items-center p-4" : "flex-row items-center border-b border-line p-4"}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-raised">
        <HubSymbol name="key" size={21} color="#95A5B7" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-ink">{humanizePermission(permission)}</Text>
        <Text className="mt-1 text-xs text-muted" numberOfLines={1}>{permission}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={last ? "flex-row items-start justify-between p-4" : "flex-row items-start justify-between border-b border-line p-4"}>
      <Text className="mr-5 text-sm text-muted">{label}</Text>
      <Text className="max-w-[58%] text-right text-sm font-semibold text-ink" selectable>{value}</Text>
    </View>
  );
}

function approvalLabel(value: CatalogAppDto["latestRelease"]["trust"]["solanaMobileApproval"]): string {
  if (value === "verified_approved") return "Verified approved";
  if (value === "rejected") return "Rejected";
  return "Not recorded";
}

function humanizePermission(permission: string): string {
  const parts = permission.split(".");
  const value = parts[parts.length - 1] ?? permission;
  return value.toLocaleLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

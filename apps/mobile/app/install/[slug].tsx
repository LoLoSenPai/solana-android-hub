import { AppInstaller, type InstallOperation } from "@hub/app-installer";
import type { CatalogAppDto } from "@hub/api-client";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { HubSymbol } from "@/components/HubSymbol";
import { loadCatalogApp } from "@/features/catalog/api";
import { saveInstalledApp } from "@/storage/database";

type InstallStage = "loading" | "ready" | "permission" | "validating" | "submitted" | "complete" | "error";

export default function InstallScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [app, setApp] = useState<CatalogAppDto | null>(null);
  const [stage, setStage] = useState<InstallStage>("loading");
  const [detail, setDetail] = useState("Loading release evidence…");
  const operationId = useMemo(() => `install_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  const showError = useCallback((cause: unknown) => {
    setStage("error");
    setDetail(cause instanceof Error ? cause.message : "Secure installation failed");
  }, []);

  useEffect(() => {
    if (!slug) return;
    void loadCatalogApp(slug).then(async (value) => {
      if (!value) throw new Error("Release is no longer eligible");
      setApp(value);
      const capability = await AppInstaller.getInstallCapability();
      if (!capability.canRequestPackageInstalls) {
        setStage("permission");
        setDetail("Allow this Hub to request APK installation in Android settings, then return here.");
      } else {
        setStage("ready");
        setDetail("The APK will be downloaded into private temporary storage and fully validated.");
      }
    }).catch(showError);
  }, [showError, slug]);

  useFocusEffect(useCallback(() => {
    if (stage === "permission") {
      void AppInstaller.getInstallCapability().then((capability) => {
        if (!capability.canRequestPackageInstalls) return;
        setStage("ready");
        setDetail("The APK will be downloaded into private temporary storage and fully validated.");
      }).catch(showError);
    }
  }, [showError, stage]));

  const beginInstall = async () => {
    if (!app) return;
    const release = app.latestRelease;
    try {
      const installed = await AppInstaller.getInstalledPackageInfo(release.packageName);
      if (installed.status === "visibility_unknown") {
        setDetail("Another edition may already be installed. The target APK will still be fully validated; Android will enforce any signer conflict.");
      }
      setStage("validating");
      const prepared = await AppInstaller.prepareInstall(operationId, {
        downloadUrl: release.apkUrl,
        byteSize: release.apkSize,
        sha256: release.apkSha256,
        packageName: release.packageName,
        versionCode: release.versionCode,
        minSdk: release.minSdk,
        certificateSha256: release.certificateSha256,
        permissions: release.permissions
      });
      setDetail("All APK invariants match. Opening Android’s installer…");
      await AppInstaller.installPrepared(prepared.preparedId);
      setStage("submitted");
      await awaitInstallResult(app, operationId, setDetail);
      setStage("complete");
    } catch (cause) {
      showError(cause);
    }
  };

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-5 pb-14" showsVerticalScrollIndicator={false}>
      <View className="mt-2 h-14 w-14 items-center justify-center rounded-[20px] bg-raised">
        <HubSymbol name="shield_lock" size={29} color="#77A7FF" />
      </View>
      <Text className="mt-5 text-xs font-bold uppercase tracking-[1.8px] text-mint">On-device security boundary</Text>
      <Text className="mt-2 text-[34px] font-bold leading-[38px] tracking-[-0.8px] text-ink">{app?.name ?? "Secure install"}</Text>
      <Text className="mt-3 leading-6 text-muted">Nothing reaches Android’s installer until every release invariant matches.</Text>
      <View className="my-7 overflow-hidden rounded-[26px] border border-line bg-surface px-5 py-2">
        <StageRow label="Download over hardened HTTPS" active={stage === "validating"} done={["submitted", "complete"].includes(stage)} />
        <StageRow label="Verify SHA-256 and AOSP signature" active={stage === "validating"} done={["submitted", "complete"].includes(stage)} />
        <StageRow label="Match package, version, certificate, permissions" active={stage === "validating"} done={["submitted", "complete"].includes(stage)} />
        <StageRow label="Android PackageInstaller confirmation" active={stage === "submitted"} done={stage === "complete"} last />
      </View>
      <View className={stage === "error" ? "flex-row rounded-[22px] border border-warning bg-surface p-4" : "flex-row rounded-[22px] border border-line bg-raised p-4"}>
        <HubSymbol name={stage === "error" ? "error" : stage === "complete" ? "check_circle" : "info"} size={22} color={stage === "error" ? "#FFC857" : stage === "complete" ? "#77A7FF" : "#95A5B7"} />
        <Text className={stage === "error" ? "ml-3 flex-1 leading-6 text-warning" : "ml-3 flex-1 leading-6 text-muted"}>{detail}</Text>
      </View>
      {stage === "loading" || stage === "validating" || stage === "submitted" ? <ActivityIndicator className="mt-6" color="#77A7FF" /> : null}
      {stage === "permission" && (
        <Pressable className="mt-7 rounded-[18px] bg-mint p-4 active:opacity-80" onPress={() => void AppInstaller.openUnknownSourcesSettings()}>
          <Text className="text-center font-bold text-canvas">Open Android settings</Text>
        </Pressable>
      )}
      {(stage === "ready" || stage === "error") && app && (
        <Pressable className="mt-7 rounded-[18px] bg-mint p-4 active:opacity-80" onPress={() => void beginInstall()}>
          <Text className="text-center font-bold text-canvas">{stage === "error" ? "Try again" : "Validate and install"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function StageRow({ label, active, done, last = false }: { label: string; active: boolean; done: boolean; last?: boolean }) {
  return (
    <View className={last ? "flex-row items-center py-4" : "flex-row items-center border-b border-line py-4"}>
      <HubSymbol
        name={done ? "check_circle" : active ? "progress_activity" : "radio_button_unchecked"}
        size={21}
        color={done ? "#77A7FF" : active ? "#F4F7FB" : "#718399"}
      />
      <Text className={done ? "ml-3 flex-1 text-sm font-semibold text-mint" : active ? "ml-3 flex-1 text-sm font-semibold text-ink" : "ml-3 flex-1 text-sm text-muted"}>{label}</Text>
    </View>
  );
}

async function awaitInstallResult(
  app: CatalogAppDto,
  operationId: string,
  setDetail: (value: string) => void
): Promise<InstallOperation> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const operation = await AppInstaller.getInstallOperation(operationId);
    if (!operation || operation.status === "submitted") continue;
    if (operation.status !== "success") throw new Error(operation.statusMessage ?? `Android install ${operation.status}`);
    setDetail("Android confirmed installation. This Hub stored only the local installation record.");
    await saveInstalledApp({
      packageName: app.latestRelease.packageName,
      appId: app.id,
      slug: app.slug,
      appName: app.name,
      releaseId: app.latestRelease.id,
      versionCode: app.latestRelease.versionCode,
      versionName: app.latestRelease.versionName,
      certificateSha256: app.latestRelease.certificateSha256,
      permissions: app.latestRelease.permissions,
      installedAt: Date.now()
    });
    return operation;
  }
}

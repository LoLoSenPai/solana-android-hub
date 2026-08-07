import { AppInstaller, type InstallOperation } from "@hub/app-installer";
import type { CatalogAppDto } from "@hub/api-client";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
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
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-5 pb-12">
      <Text className="text-xs font-bold uppercase tracking-widest text-mint">On-device security boundary</Text>
      <Text className="mt-2 text-3xl font-bold text-ink">{app?.name ?? "Secure install"}</Text>
      <View className="my-6 rounded-2xl border border-line bg-surface p-5">
        <StageRow label="Download over hardened HTTPS" active={stage === "validating"} done={["submitted", "complete"].includes(stage)} />
        <StageRow label="Verify SHA-256 and AOSP signature" active={stage === "validating"} done={["submitted", "complete"].includes(stage)} />
        <StageRow label="Match package, version, certificate, permissions" active={stage === "validating"} done={["submitted", "complete"].includes(stage)} />
        <StageRow label="Android PackageInstaller confirmation" active={stage === "submitted"} done={stage === "complete"} />
      </View>
      <Text className={stage === "error" ? "leading-6 text-warning" : "leading-6 text-muted"}>{detail}</Text>
      {stage === "loading" || stage === "validating" || stage === "submitted" ? <ActivityIndicator className="mt-6" color="#9cf4c8" /> : null}
      {stage === "permission" && (
        <Pressable className="mt-7 rounded-2xl bg-mint p-4" onPress={() => void AppInstaller.openUnknownSourcesSettings()}>
          <Text className="text-center font-bold text-canvas">Open Android settings</Text>
        </Pressable>
      )}
      {(stage === "ready" || stage === "error") && app && (
        <Pressable className="mt-7 rounded-2xl bg-mint p-4" onPress={() => void beginInstall()}>
          <Text className="text-center font-bold text-canvas">{stage === "error" ? "Try again" : "Validate and install"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function StageRow({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return <Text className={`mb-3 ${done ? "text-mint" : active ? "text-ink" : "text-muted"}`}>{done ? "✓" : active ? "●" : "○"}  {label}</Text>;
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

import { AppInstaller, type InstallOperation } from "@hub/app-installer";
import type { CatalogAppDto } from "@hub/api-client";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from "react-native";
import { HubSymbol } from "@/components/HubSymbol";
import { loadCatalogApp } from "@/features/catalog/api";
import { installErrorMessage } from "@/features/installer/errors";
import { InstallProgress } from "@/features/installer/InstallProgress";
import { saveInstalledApp } from "@/storage/database";

type InstallStage = "loading" | "ready" | "permission" | "downloading" | "checking" | "submitted" | "complete" | "error";

export default function InstallScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [app, setApp] = useState<CatalogAppDto | null>(null);
  const [stage, setStage] = useState<InstallStage>("loading");
  const [detail, setDetail] = useState("Loading app…");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const operationId = useMemo(() => `install_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  const showError = useCallback((cause: unknown) => {
    setStage("error");
    setDetail(installErrorMessage(cause));
  }, []);

  useEffect(() => {
    if (!slug) return;
    void loadCatalogApp(slug).then(async (value) => {
      if (!value) throw new Error("Release is no longer eligible");
      setApp(value);
      const capability = await AppInstaller.getInstallCapability();
      if (!capability.canRequestPackageInstalls) {
        setStage("permission");
        setDetail("Allow installs from Dapport once, then return here.");
      } else {
        setStage("ready");
        setDetail("Ready to download.");
      }
    }).catch(showError);
  }, [showError, slug]);

  useEffect(() => {
    if (stage !== "permission") return;
    const refreshPermission = () => {
      void AppInstaller.getInstallCapability().then((capability) => {
        if (!capability.canRequestPackageInstalls) return;
        setStage("ready");
        setDetail("Ready to download.");
      }).catch(showError);
    };
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refreshPermission();
    });
    refreshPermission();
    return () => subscription.remove();
  }, [showError, stage]);

  useEffect(() => {
    const subscription = AppInstaller.addListener("onDownloadProgress", (event) => {
      if (event.operationId !== operationId) return;
      setDownloadProgress(event.fraction);
      if (event.fraction >= 1) {
        setStage("checking");
        setDetail("Download complete. Checking the app…");
      }
    });
    return () => subscription.remove();
  }, [operationId]);

  const beginInstall = async () => {
    if (!app) return;
    const release = app.latestRelease;
    try {
      const installed = await AppInstaller.getInstalledPackageInfo(release.packageName);
      if (installed.status === "visibility_unknown") {
        setDetail("Downloading app…");
      }
      setStage("downloading");
      setDownloadProgress(0);
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
      setStage("checking");
      setDetail("App is ready. Opening Android…");
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
        <HubSymbol name="download" size={29} color="#77A7FF" />
      </View>
      <Text className="mt-5 text-xs font-bold uppercase tracking-[1.8px] text-mint">Install from Dapport</Text>
      <Text className="mt-2 text-[34px] font-bold leading-[38px] tracking-[-0.8px] text-ink">{app?.name ?? "Install app"}</Text>
      <Text className="mt-3 leading-6 text-muted">Dapport downloads the app, checks it, then Android asks you to confirm.</Text>

      {stage === "downloading" || stage === "checking" ? (
        <InstallProgress
          fraction={downloadProgress}
          label={stage === "checking" ? "Checking app" : "Downloading"}
        />
      ) : null}

      <View className={stage === "error" ? "mt-5 flex-row rounded-[22px] border border-warning bg-surface p-4" : "mt-5 flex-row rounded-[22px] border border-line bg-raised p-4"}>
        <HubSymbol name={stage === "error" ? "error" : stage === "complete" ? "check_circle" : "info"} size={22} color={stage === "error" ? "#FFC857" : stage === "complete" ? "#77A7FF" : "#95A5B7"} />
        <Text className={stage === "error" ? "ml-3 flex-1 leading-6 text-warning" : "ml-3 flex-1 leading-6 text-muted"}>{detail}</Text>
      </View>
      {stage === "loading" || stage === "submitted" ? <ActivityIndicator className="mt-6" color="#77A7FF" /> : null}
      {stage === "permission" && (
        <Pressable className="mt-7 rounded-[18px] bg-mint p-4 active:opacity-80" onPress={() => void AppInstaller.openUnknownSourcesSettings()}>
          <Text className="text-center font-bold text-canvas">Open Android settings</Text>
        </Pressable>
      )}
      {(stage === "ready" || stage === "error") && app && (
        <Pressable className="mt-7 rounded-[18px] bg-mint p-4 active:opacity-80" onPress={() => void beginInstall()}>
          <Text className="text-center font-bold text-canvas">{stage === "error" ? "Try again" : "Install"}</Text>
        </Pressable>
      )}
    </ScrollView>
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
    setDetail(`${app.name} is installed.`);
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

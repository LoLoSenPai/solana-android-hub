import { AppInstaller } from "@hub/app-installer";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { HubSymbol } from "@/components/HubSymbol";
import { type HubReleaseManifest } from "@/features/hub-update/model";
import { checkForHubUpdate, expectedHubUpdateRelease } from "@/features/hub-update/service";

type UpdateStage = "checking" | "current" | "permission" | "ready" | "downloading" | "submitted" | "complete" | "error";

export default function HubUpdateScreen() {
  const [stage, setStage] = useState<UpdateStage>("checking");
  const [manifest, setManifest] = useState<HubReleaseManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState("—");
  const [detail, setDetail] = useState("Checking the latest signed Dapport release…");
  const operationId = useMemo(() => `hub_update_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  const load = useCallback(async () => {
    setStage("checking");
    const result = await checkForHubUpdate({ force: true });
    if (result.status === "disabled") {
      setStage("error");
      setDetail("Integrated Dapport updates are available in production builds.");
      return;
    }
    if (result.status === "error") {
      setStage("error");
      setCurrentVersion(result.current?.versionName ?? result.current?.versionCode ?? "—");
      setDetail(result.message);
      return;
    }
    setCurrentVersion(result.current.versionName ?? result.current.versionCode);
    setManifest(result.manifest);
    if (result.status === "current") {
      setStage("current");
      setDetail(`Version ${result.current.versionName ?? result.current.versionCode} is up to date.`);
      return;
    }
    const capability = await AppInstaller.getInstallCapability();
    if (!capability.canRequestPackageInstalls) {
      setStage("permission");
      setDetail("Allow Dapport to install its signed update, then return here.");
    } else {
      setStage("ready");
      setDetail(`Version ${result.manifest.versionName} is ready to download and verify.`);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useFocusEffect(useCallback(() => {
    if (stage !== "permission") return;
    void AppInstaller.getInstallCapability().then((capability) => {
      if (!capability.canRequestPackageInstalls) return;
      setStage("ready");
      setDetail(`Version ${manifest?.versionName ?? ""} is ready to download and verify.`);
    });
  }, [manifest?.versionName, stage]));

  useEffect(() => {
    if (stage !== "submitted") return;
    let active = true;
    const poll = async () => {
      while (active) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const result = await AppInstaller.getInstallOperation(operationId);
        if (!active || !result || result.status === "submitted") continue;
        if (result.status === "success") {
          setStage("complete");
          setDetail("Android installed the Dapport update.");
        } else {
          setStage("error");
          setDetail(result.statusMessage ?? `Android update ${result.status}.`);
        }
        break;
      }
    };
    void poll();
    return () => { active = false; };
  }, [operationId, stage]);

  const install = async () => {
    if (!manifest) return;
    try {
      setStage("downloading");
      setDetail("Downloading into private storage and checking every release invariant…");
      const prepared = await AppInstaller.prepareInstall(operationId, expectedHubUpdateRelease(manifest));
      setDetail("Package, version, SHA-256 and signing certificate match. Opening Android’s updater…");
      await AppInstaller.installPrepared(prepared.preparedId);
      setStage("submitted");
    } catch (cause) {
      setStage("error");
      setDetail(cause instanceof Error ? cause.message : "The Dapport update could not be installed.");
    }
  };

  const cancel = async () => {
    await AppInstaller.cancel(operationId);
    setStage("ready");
    setDetail(`Version ${manifest?.versionName ?? ""} is ready when you are.`);
  };

  const busy = stage === "checking" || stage === "downloading" || stage === "submitted";

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-5 pb-14" showsVerticalScrollIndicator={false}>
      <View className="mt-2 h-14 w-14 items-center justify-center rounded-[20px] bg-raised">
        <HubSymbol name="system_update" size={29} color="#77A7FF" />
      </View>
      <Text className="mt-5 text-xs font-bold uppercase tracking-[1.8px] text-mint">Dapport</Text>
      <Text className="mt-2 text-[34px] font-bold leading-[38px] tracking-[-0.8px] text-ink">Keep Dapport current.</Text>
      <Text className="mt-3 leading-6 text-muted">Updates use the same permanent signing identity and Android’s supported installer.</Text>

      <View className="mt-7 overflow-hidden rounded-[26px] border border-line bg-surface">
        <VersionRow label="Installed" value={currentVersion} />
        <VersionRow label="Available" value={manifest?.versionName ?? "—"} last />
      </View>

      {manifest?.releaseNotes.length ? (
        <View className="mt-5 rounded-[24px] border border-line bg-surface p-5">
          <Text className="text-base font-bold text-ink">What’s new</Text>
          {manifest.releaseNotes.map((note) => (
            <View key={note} className="mt-3 flex-row items-start">
              <View className="mt-2 h-1.5 w-1.5 rounded-full bg-mint" />
              <Text className="ml-3 flex-1 leading-6 text-muted">{note}</Text>
            </View>
          ))}
          <Text className="mt-4 text-xs text-muted">Download size: {formatBytes(manifest.apkSize)}</Text>
        </View>
      ) : null}

      <View className={stage === "error" ? "mt-5 flex-row rounded-[22px] border border-warning bg-surface p-4" : "mt-5 flex-row rounded-[22px] border border-line bg-raised p-4"}>
        <HubSymbol name={stage === "error" ? "error" : stage === "current" || stage === "complete" ? "check_circle" : "info"} size={22} color={stage === "error" ? "#FFC857" : "#77A7FF"} />
        <Text className={stage === "error" ? "ml-3 flex-1 leading-6 text-warning" : "ml-3 flex-1 leading-6 text-muted"}>{detail}</Text>
      </View>

      {busy ? <ActivityIndicator className="mt-6" color="#77A7FF" /> : null}
      {stage === "permission" ? (
        <Pressable className="mt-7 rounded-[18px] bg-mint p-4 active:opacity-80" onPress={() => void AppInstaller.openUnknownSourcesSettings()}>
          <Text className="text-center font-bold text-canvas">Allow Dapport updates</Text>
        </Pressable>
      ) : null}
      {stage === "ready" ? (
        <Pressable className="mt-7 rounded-[18px] bg-mint p-4 active:opacity-80" onPress={() => void install()}>
          <Text className="text-center font-bold text-canvas">Download and update</Text>
        </Pressable>
      ) : null}
      {stage === "downloading" ? (
        <Pressable className="mt-4 rounded-[18px] border border-line p-4 active:bg-surface" onPress={() => void cancel()}>
          <Text className="text-center font-bold text-ink">Cancel download</Text>
        </Pressable>
      ) : null}
      {stage === "error" ? (
        <Pressable className="mt-7 rounded-[18px] border border-line p-4 active:bg-surface" onPress={() => void load()}>
          <Text className="text-center font-bold text-ink">Try again</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function VersionRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={last ? "flex-row items-center justify-between px-5 py-4" : "flex-row items-center justify-between border-b border-line px-5 py-4"}>
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-bold text-ink">{value}</Text>
    </View>
  );
}

function formatBytes(value: number): string {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

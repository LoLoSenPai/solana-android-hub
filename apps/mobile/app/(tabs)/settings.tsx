import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HubSymbol } from "@/components/HubSymbol";
import { hubOrigin } from "@/features/catalog/api";
import { checkForHubUpdate, type HubUpdateCheck } from "@/features/hub-update/service";
import { getCatalogChannel, setCatalogChannel, type CatalogChannel } from "@/storage/database";

export default function SettingsScreen() {
  const router = useRouter();
  const [channel, setChannel] = useState<CatalogChannel>("trusted");
  const [update, setUpdate] = useState<HubUpdateCheck | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(true);
  useFocusEffect(useCallback(() => {
    void getCatalogChannel().then(setChannel);
    setCheckingUpdate(true);
    void checkForHubUpdate().then(setUpdate).finally(() => setCheckingUpdate(false));
  }, []));

  const selectChannel = async (value: CatalogChannel) => {
    await setCatalogChannel(value);
    setChannel(value);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-36" showsVerticalScrollIndicator={false}>
        <View className="mb-7 mt-4">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-mint">Your experience</Text>
          <Text className="mt-2 text-[38px] font-bold tracking-[-1px] text-ink">Settings</Text>
        </View>

        <Text className="mb-3 text-xs font-bold uppercase tracking-[1.6px] text-muted">Hub updates</Text>
        <View className="mb-7 rounded-[24px] border border-line bg-surface p-5">
          <View className="flex-row items-center">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-raised">
              <HubSymbol name="system_update" size={23} color="#77A7FF" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-base font-bold text-ink">{updateTitle(update)}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{updateDetail(update)}</Text>
            </View>
            {checkingUpdate ? <ActivityIndicator color="#77A7FF" /> : null}
          </View>
          {!checkingUpdate ? (
            <Pressable
              className={update?.status === "available" ? "mt-5 rounded-[16px] bg-mint p-3.5 active:opacity-80" : "mt-5 rounded-[16px] border border-line p-3.5 active:bg-raised"}
              onPress={() => update?.status === "available" ? router.push("/hub-update" as Href) : void checkNow(setUpdate, setCheckingUpdate)}
            >
              <Text className={update?.status === "available" ? "text-center font-bold text-canvas" : "text-center font-bold text-ink"}>
                {update?.status === "available" ? "Update now" : "Check for updates"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="mb-3 text-xs font-bold uppercase tracking-[1.6px] text-muted">Catalogue channel</Text>
        <ChannelButton
          icon="verified_user"
          label="Trusted"
          description="Publisher authority, consent, authenticity, and publication gates."
          selected={channel === "trusted"}
          onPress={() => void selectChannel("trusted")}
        />
        <ChannelButton
          icon="approval"
          label="Mobile approved"
          description="Every trusted gate, plus independently recorded Solana Mobile approval."
          selected={channel === "approved"}
          onPress={() => void selectChannel("approved")}
        />
        <Text className="mt-2 text-xs leading-5 text-muted">Changing channel never downgrades an installed app.</Text>

        <Text className="mb-3 mt-8 text-xs font-bold uppercase tracking-[1.6px] text-muted">Privacy & security</Text>
        <SettingsFact icon="visibility_off" title="No app inventory" detail="The Hub uses only local records for apps it installed. It does not request broad package visibility." />
        <SettingsFact icon="shield_lock" title="On-device verification" detail="Every APK is checked locally before PackageInstaller can open." />
        <SettingsFact icon="link" title="Catalogue origin" detail={hubOrigin} selectable />

        <Text className="mb-3 mt-8 text-xs font-bold uppercase tracking-[1.6px] text-muted">Independence</Text>
        <View className="rounded-[24px] border border-line bg-surface p-5">
          <View className="flex-row items-start">
            <HubSymbol name="info" size={22} color="#95A5B7" />
            <Text className="ml-3 flex-1 text-sm leading-6 text-muted">This independent catalogue is not affiliated with Solana Mobile. Approval appears only as a separate evidence fact.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function checkNow(
  setUpdate: (value: HubUpdateCheck) => void,
  setChecking: (value: boolean) => void
): Promise<void> {
  setChecking(true);
  try {
    setUpdate(await checkForHubUpdate({ force: true }));
  } finally {
    setChecking(false);
  }
}

function updateTitle(update: HubUpdateCheck | null): string {
  if (!update) return "Checking for updates";
  if (update.status === "available") return `Version ${update.manifest.versionName} available`;
  if (update.status === "current") return "The Hub is up to date";
  if (update.status === "disabled") return "Updates unavailable in this build";
  return "Couldn’t check for updates";
}

function updateDetail(update: HubUpdateCheck | null): string {
  if (!update) return "Looking for the latest signed release.";
  if (update.status === "available") return `Installed ${update.current.versionName ?? update.current.versionCode} · ${formatMegabytes(update.manifest.apkSize)}`;
  if (update.status === "current") return `Installed version ${update.current.versionName ?? update.current.versionCode}`;
  if (update.status === "disabled") return "Integrated updates are enabled in the production Hub.";
  return update.message;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ChannelButton({
  icon,
  label,
  description,
  selected,
  onPress
}: {
  icon: Parameters<typeof HubSymbol>[0]["name"];
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={selected ? "mb-3 flex-row rounded-[24px] border border-mint bg-raised p-5" : "mb-3 flex-row rounded-[24px] border border-line bg-surface p-5"}
      onPress={onPress}
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
        <HubSymbol name={icon} size={23} color={selected ? "#77A7FF" : "#95A5B7"} />
      </View>
      <View className="ml-4 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-ink">{label}</Text>
          <HubSymbol name={selected ? "radio_button_checked" : "radio_button_unchecked"} size={21} color={selected ? "#77A7FF" : "#718399"} />
        </View>
        <Text className="mt-2 text-sm leading-5 text-muted">{description}</Text>
      </View>
    </Pressable>
  );
}

function SettingsFact({ icon, title, detail, selectable = false }: {
  icon: Parameters<typeof HubSymbol>[0]["name"];
  title: string;
  detail: string;
  selectable?: boolean;
}) {
  return (
    <View className="mb-3 flex-row rounded-[24px] border border-line bg-surface p-5">
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-raised">
        <HubSymbol name={icon} size={23} color="#77A7FF" />
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-base font-bold text-ink">{title}</Text>
        <Text className="mt-1 text-sm leading-5 text-muted" selectable={selectable}>{detail}</Text>
      </View>
    </View>
  );
}

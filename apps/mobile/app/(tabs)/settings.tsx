import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HubSymbol } from "@/components/HubSymbol";
import { hubOrigin } from "@/features/catalog/api";
import { getCatalogChannel, setCatalogChannel, type CatalogChannel } from "@/storage/database";

export default function SettingsScreen() {
  const [channel, setChannel] = useState<CatalogChannel>("trusted");
  useFocusEffect(useCallback(() => { void getCatalogChannel().then(setChannel); }, []));

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

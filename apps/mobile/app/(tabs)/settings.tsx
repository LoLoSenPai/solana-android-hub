import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
    <View className="flex-1 bg-canvas p-5">
      <Text className="text-3xl font-bold text-ink">Settings</Text>
      <Text className="mt-6 text-xs uppercase tracking-widest text-mint">Catalogue channel</Text>
      <View className="mt-3 flex-row gap-3">
        <ChannelButton label="Trusted" selected={channel === "trusted"} onPress={() => void selectChannel("trusted")} />
        <ChannelButton label="Approved" selected={channel === "approved"} onPress={() => void selectChannel("approved")} />
      </View>
      <Text className="mt-3 leading-6 text-muted">
        {channel === "trusted"
          ? "Current publisher authority, consent, authenticity, and publication gates apply."
          : "Every trusted gate applies, plus independently recorded Solana Mobile approval. Selecting this channel never downgrades an installed app."}
      </Text>
      <Text className="mt-7 text-xs uppercase tracking-widest text-mint">Catalogue origin</Text>
      <Text className="mt-2 text-muted">{hubOrigin}</Text>
      <Text className="mt-7 text-xs uppercase tracking-widest text-mint">Package visibility</Text>
      <Text className="mt-2 leading-6 text-muted">Least-privileged. The Hub does not request broad package inventory access and never uploads installed-app data.</Text>
      <Text className="mt-7 text-xs uppercase tracking-widest text-mint">Independence</Text>
      <Text className="mt-2 leading-6 text-muted">This independent catalogue is not affiliated with Solana Mobile. Approval is displayed only as a separate evidence fact.</Text>
    </View>
  );
}

function ChannelButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable className={selected ? "flex-1 rounded-xl bg-mint p-3" : "flex-1 rounded-xl border border-line bg-surface p-3"} onPress={onPress}>
      <Text className={selected ? "text-center font-bold text-canvas" : "text-center font-bold text-ink"}>{label}</Text>
    </Pressable>
  );
}

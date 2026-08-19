import { Text, View } from "react-native";

export function InstallProgress({ fraction, label }: { fraction: number; label: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  return (
    <View className="mt-5 rounded-[22px] border border-line bg-surface p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-ink">{label}</Text>
        <Text className="font-bold text-mint">{percent}%</Text>
      </View>
      <View className="mt-4 h-2 overflow-hidden rounded-full bg-raised">
        <View className="h-full rounded-full bg-mint" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}

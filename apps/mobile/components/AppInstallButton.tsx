import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { useAppInstall } from "@/features/installer/use-app-install";

type Installation = ReturnType<typeof useAppInstall>;

export function AppInstallButton({ installation, compact = false }: { installation: Installation; compact?: boolean }) {
  const { action, stage, busy, fraction, visibility } = installation;
  const opensApp = action === "current" || action === "newer-installed";
  const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  const loading = visibility === "loading";
  const downloading = stage === "downloading";
  const label = downloading ? `Downloading ${percent}%`
    : stage === "cancelling" ? "Cancelling…"
      : stage === "checking" ? "Checking…"
      : stage === "submitted" ? "Installing…"
        : loading ? "Checking…"
          : stage === "permission" ? "Allow installs"
            : opensApp ? "Open"
              : action === "update" ? "Update"
                : stage === "error" ? "Try again" : "Install";
  const disabled = busy || loading;

  return (
    <View className={compact ? "flex-row items-center gap-2" : "mt-5 flex-row items-center gap-3"}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      className={compact ? "flex-row items-center justify-center rounded-full bg-ink px-5 py-3 active:opacity-80" : "flex-1 flex-row items-center justify-center rounded-[18px] bg-mint px-5 py-4 active:opacity-80"}
      onPress={() => void (opensApp ? installation.open() : installation.install())}
    >
      {downloading ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Download progress"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          className="mr-2"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={9} fill="none" stroke="#010213" strokeOpacity={0.2} strokeWidth={3} />
            <Circle cx={12} cy={12} r={9} fill="none" stroke="#010213" strokeWidth={3} strokeLinecap="round" strokeDasharray={Math.PI * 18} strokeDashoffset={Math.PI * 18 * (1 - percent / 100)} rotation={-90} origin="12, 12" />
          </Svg>
        </View>
      ) : disabled ? <ActivityIndicator size="small" color="#010213" style={{ marginRight: 8 }} /> : null}
      <Text className={compact ? "text-sm font-bold text-canvas" : "text-center text-base font-bold text-canvas"}>{compact && downloading ? `${percent}%` : label}</Text>
    </Pressable>
      {downloading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel download"
          className={compact ? "items-center justify-center rounded-full border border-line bg-surface px-3 py-3 active:opacity-80" : "items-center justify-center rounded-[18px] border border-line bg-surface px-4 py-4 active:opacity-80"}
          onPress={() => void installation.cancel()}
        >
          <Text className="text-sm font-semibold text-ink">Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

import type { BrowseCategory } from "@/features/catalog/discovery";
import { categoryDefinition } from "@/features/catalog/discovery";
import { Pressable, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { HubSymbol } from "./HubSymbol";

interface CategoryTileProps {
  category: BrowseCategory;
  onPress: () => void;
}

interface CategoryVisual {
  gradient: string;
  icon: string;
}

const CATEGORY_VISUALS: Partial<Record<BrowseCategory, CategoryVisual>> = {
  all: {
    gradient: "linear-gradient(145deg, #173969 0%, #102541 56%, #0A1628 100%)",
    icon: "#8DB6FF"
  },
  games: {
    gradient: "linear-gradient(145deg, #173E73 0%, #172A4D 58%, #0B1729 100%)",
    icon: "#FFC857"
  },
  defi: {
    gradient: "linear-gradient(145deg, #42306E 0%, #282348 58%, #11172B 100%)",
    icon: "#8CB2FF"
  },
  depin: {
    gradient: "linear-gradient(145deg, #4A3329 0%, #2B292D 58%, #141922 100%)",
    icon: "#FF9A72"
  },
  wallets: {
    gradient: "linear-gradient(145deg, #0F4A58 0%, #12313F 58%, #0A1925 100%)",
    icon: "#78E1F2"
  },
  "social-identity": {
    gradient: "linear-gradient(145deg, #5B294F 0%, #33243E 58%, #151725 100%)",
    icon: "#FF9BC6"
  },
  "ai-agents": {
    gradient: "linear-gradient(145deg, #3A365F 0%, #242642 58%, #121727 100%)",
    icon: "#B3A8FF"
  },
  "privacy-security": {
    gradient: "linear-gradient(145deg, #184A44 0%, #193331 58%, #0C1B22 100%)",
    icon: "#86E4CF"
  },
  nfts: {
    gradient: "linear-gradient(145deg, #51316B 0%, #302442 58%, #151625 100%)",
    icon: "#D6A3FF"
  },
  "content-streaming": {
    gradient: "linear-gradient(145deg, #5A304D 0%, #362337 58%, #171622 100%)",
    icon: "#FF9FBC"
  },
  productivity: {
    gradient: "linear-gradient(145deg, #243E78 0%, #242A52 58%, #10172B 100%)",
    icon: "#9B9BFF"
  },
  lifestyle: {
    gradient: "linear-gradient(145deg, #594227 0%, #322C2A 58%, #171A22 100%)",
    icon: "#FFD580"
  }
};

const DEFAULT_VISUAL: CategoryVisual = {
  gradient: "linear-gradient(145deg, #20344F 0%, #19283B 58%, #0D1826 100%)",
  icon: "#95A5B7"
};

export function CategoryTile({ category, onPress }: CategoryTileProps) {
  const definition = categoryDefinition(category);
  const visual = CATEGORY_VISUALS[category] ?? DEFAULT_VISUAL;
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.018 }],
    opacity: 1 - pressed.value * 0.08
  }));

  return (
    <Animated.View style={[{ width: "48.5%", height: 92, marginBottom: 11 }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Browse ${definition.label}`}
        onPress={onPress}
        onPressIn={() => { pressed.value = withTiming(1, { duration: 110 }); }}
        onPressOut={() => { pressed.value = withTiming(0, { duration: 180 }); }}
        style={{
          flex: 1,
          overflow: "hidden",
          borderRadius: 21,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: "rgba(139, 174, 222, 0.25)",
          paddingHorizontal: 16,
          paddingVertical: 14,
          justifyContent: "flex-end",
          experimental_backgroundImage: visual.gradient
        }}
      >
        <HubSymbol
          name={definition.icon}
          size={27}
          color={visual.icon}
          style={{ position: "absolute", right: 15, top: 13 }}
        />
        <Text className="pr-7 text-[15px] font-bold text-white" numberOfLines={2}>{definition.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

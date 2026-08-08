import { SymbolView, type AndroidSymbol } from "expo-symbols";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";

interface HubSymbolProps {
  name: AndroidSymbol;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

export function HubSymbol({ name, size = 24, color = "#F5F7F2", style }: HubSymbolProps) {
  return (
    <SymbolView
      name={{ android: name }}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
    />
  );
}

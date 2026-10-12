import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: "#010213" },
        headerTintColor: "#F7F8FC",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#010213" }
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="categories/[category]" options={{ headerShown: false }} />
        <Stack.Screen name="apps/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="install/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="hub-update" options={{ title: "Dapport update", presentation: "modal" }} />
      </Stack>
    </>
  );
}

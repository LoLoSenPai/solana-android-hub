import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: "#061311" },
        headerTintColor: "#F5F7F2",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#061311" }
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="categories/[category]" options={{ headerShown: false }} />
        <Stack.Screen name="apps/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="install/[slug]" options={{ title: "Secure install", presentation: "modal" }} />
      </Stack>
    </>
  );
}

import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: "#080b0e" },
        headerTintColor: "#f2f6f7",
        contentStyle: { backgroundColor: "#080b0e" }
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="apps/[slug]" options={{ title: "App details" }} />
        <Stack.Screen name="install/[slug]" options={{ title: "Install securely", presentation: "modal" }} />
      </Stack>
    </>
  );
}

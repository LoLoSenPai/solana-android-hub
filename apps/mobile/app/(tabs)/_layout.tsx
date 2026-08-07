import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: "#080b0e" },
      headerTintColor: "#f2f6f7",
      tabBarStyle: { backgroundColor: "#10151a", borderTopColor: "#29343d" },
      tabBarActiveTintColor: "#9cf4c8",
      tabBarInactiveTintColor: "#9bacb7"
    }}>
      <Tabs.Screen name="index" options={{ title: "Discover" }} />
      <Tabs.Screen name="my-apps" options={{ title: "My Apps" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

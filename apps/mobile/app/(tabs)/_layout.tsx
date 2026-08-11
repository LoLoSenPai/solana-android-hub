import { Tabs } from "expo-router";
import { HubSymbol } from "@/components/HubSymbol";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 18,
          height: 76,
          borderRadius: 26,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: "#26384D",
          backgroundColor: "#0D1A29",
          paddingTop: 8,
          paddingBottom: 9,
          elevation: 10
        },
        tabBarActiveTintColor: "#77A7FF",
        tabBarInactiveTintColor: "#718399",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarItemStyle: { borderRadius: 20 },
        tabBarHideOnKeyboard: true
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => <HubSymbol name={focused ? "explore" : "search"} size={25} color={color} />
        }}
      />
      <Tabs.Screen
        name="my-apps"
        options={{
          title: "My Apps",
          tabBarIcon: ({ color, focused }) => <HubSymbol name={focused ? "apps" : "download_for_offline"} size={25} color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <HubSymbol name="settings" size={25} color={color} />
        }}
      />
    </Tabs>
  );
}

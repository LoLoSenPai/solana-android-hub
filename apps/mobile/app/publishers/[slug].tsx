import type { PublicPublisherProfileDto } from "@hub/api-client";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppCard } from "@/components/AppCard";
import { HubSymbol } from "@/components/HubSymbol";
import { hubOrigin } from "@/features/catalog/api";
import { localStatusForApp } from "@/features/catalog/discovery";
import { loadPublicPublisherProfile } from "@/features/publishers/api";
import { useInstalledApps } from "@/features/installer/use-installed-apps";

export default function PublisherProfileScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [data, setData] = useState<PublicPublisherProfileDto | null>(null);
  const { installedApps, refresh: refreshInstalledApps } = useInstalledApps();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => { setRefreshKey((value) => value + 1); void refreshInstalledApps(); };

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setData(null);
    if (!slug) {
      setError(true);
      setLoading(false);
      return () => { active = false; };
    }
    void loadPublicPublisherProfile(slug).then((profile) => {
      if (!active) return;
      setData(profile);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug, refreshKey]));

  const installedByPackage = useMemo(
    () => new Map(installedApps.map((app) => [app.packageName, app])),
    [installedApps],
  );
  const profile = data?.profile;
  const name = profile?.displayName ?? profile?.slug ?? "Publisher";
  const links = profile ? [
    { label: "Portfolio", url: profile.portfolioUrl, icon: "work" as const },
    { label: "Website", url: profile.links.website, icon: "public" as const },
    { label: "X", url: profile.links.x, icon: "alternate_email" as const },
    { label: "Discord", url: profile.links.discord, icon: "forum" as const },
    { label: "Telegram", url: profile.links.telegram, icon: "send" as const },
  ].flatMap((link) => link.url ? [{ ...link, url: link.url }] : []) : [];

  const share = async () => {
    if (!profile) return;
    const url = new URL(`/publishers/${encodeURIComponent(profile.slug)}`, hubOrigin).toString();
    try {
      await Share.share({ title: `${name} on Dapport`, message: url, url });
    } catch {
      Alert.alert("Sharing unavailable", "Please try sharing this profile again.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-12 w-12 items-center justify-center rounded-2xl bg-raised active:opacity-75"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
        >
          <HubSymbol name="arrow_back" size={24} />
        </Pressable>
        <Text className="mx-3 flex-1 text-center text-base font-semibold text-ink">Publisher profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share publisher profile"
          accessibilityState={{ disabled: !profile }}
          disabled={!profile}
          className="h-12 w-12 items-center justify-center rounded-2xl bg-raised active:opacity-75"
          onPress={() => void share()}
        >
          <HubSymbol name="share" size={23} color={profile ? "#77A7FF" : "#95A5B7"} />
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#77A7FF" />}
      >
        {loading ? (
          <View className="items-center rounded-[26px] border border-line bg-surface px-5 py-12">
            <ActivityIndicator color="#77A7FF" />
            <Text className="mt-4 text-sm text-muted">Loading publisher profile…</Text>
          </View>
        ) : error || !data || !profile ? (
          <View className="items-center rounded-[26px] border border-line bg-surface p-6">
            <HubSymbol name="cloud_off" size={34} color="#95A5B7" />
            <Text className="mt-4 text-lg font-bold text-ink">Profile unavailable</Text>
            <Text className="mt-2 text-center leading-6 text-muted">This profile could not be loaded. Check your connection and try again.</Text>
            <Pressable accessibilityRole="button" className="mt-5 rounded-full bg-mint px-6 py-3 active:opacity-75" onPress={refresh}>
              <Text className="font-bold text-canvas">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="rounded-[28px] border border-line bg-surface p-6">
              <PublisherAvatar key={profile.avatarUrl ?? "fallback"} uri={profile.avatarUrl} name={name} />
              <Text className="mt-5 text-xs font-bold uppercase tracking-[1.8px] text-mint">Publisher</Text>
              <Text className="mt-2 text-[30px] font-bold leading-[36px] text-ink">{name}</Text>
              {profile.bio ? <Text className="mt-4 text-base leading-6 text-muted">{profile.bio}</Text> : null}
            </View>

            {links.length ? (
              <View className="mt-5 overflow-hidden rounded-[24px] border border-line bg-surface">
                {links.map((link, index) => (
                  <Pressable
                    key={link.label}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${link.label}`}
                    className={`flex-row items-center px-5 py-4 active:bg-raised${index < links.length - 1 ? " border-b border-line" : ""}`}
                    onPress={() => {
                      void Linking.openURL(link.url).catch(() => Alert.alert("Link unavailable", "This link could not be opened. Please try again."));
                    }}
                  >
                    <HubSymbol name={link.icon} size={22} color="#77A7FF" />
                    <Text className="ml-3 flex-1 text-base font-semibold text-ink">{link.label}</Text>
                    <HubSymbol name="open_in_new" size={19} color="#95A5B7" />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="mb-4 mt-8 flex-row items-center justify-between">
              <Text className="text-[25px] font-bold text-ink">Apps</Text>
              <Text className="text-sm text-muted">{data.apps.length}</Text>
            </View>
            {data.apps.length ? data.apps.map((app) => (
              <AppCard key={app.id} app={app} localStatus={localStatusForApp(app, installedByPackage)} />
            )) : (
              <View className="rounded-[24px] border border-line bg-surface p-6">
                <Text className="text-base font-semibold text-ink">No apps available yet</Text>
                <Text className="mt-2 leading-6 text-muted">This publisher has no apps available in your current catalogue.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PublisherAvatar({ uri, name }: { uri: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-raised">
      {uri && !failed ? (
        <Image accessibilityLabel={`${name} avatar`} source={{ uri }} style={{ width: 96, height: 96 }} onError={() => setFailed(true)} />
      ) : <HubSymbol name="person" size={45} color="#77A7FF" />}
    </View>
  );
}

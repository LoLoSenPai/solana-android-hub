import type { CatalogAppDto } from "@hub/api-client";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppArtwork } from "@/components/AppArtwork";
import { AppInstallButton } from "@/components/AppInstallButton";
import { HubSymbol } from "@/components/HubSymbol";
import { SolanaMobileRating } from "@/components/SolanaMobileRating";
import { categoryDefinition } from "@/features/catalog/discovery";
import { loadCatalogApp } from "@/features/catalog/api";
import { approvalLabel, humanizePermission, permissionSummary, releaseBadgeLabel } from "@/features/catalog/release-presentation";
import { useAppInstall } from "@/features/installer/use-app-install";

export default function AppDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [app, setApp] = useState<CatalogAppDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionsExpanded, setPermissionsExpanded] = useState(false);
  const [technicalNamesExpanded, setTechnicalNamesExpanded] = useState(false);
  const [verificationExpanded, setVerificationExpanded] = useState(false);
  const installation = useAppInstall(app);
  const installed = installation.installedPackage;
  const installedPermissions = installation.installedPermissions ?? [];
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setApp(null);
    setError(null);
    void loadCatalogApp(slug).then((value) => {
      if (!active) return;
      if (!value) {
        setError("App is no longer eligible");
        return;
      }
      setApp(value);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "App unavailable");
    });
    return () => { active = false; };
  }, [slug]);

  if (!app && !error) {
    return (
      <SafeAreaView className="flex-1 bg-canvas p-5">
        <Pressable accessibilityLabel="Go back" className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface" onPress={goBack}>
          <HubSymbol name="arrow_back" size={24} />
        </Pressable>
        <ActivityIndicator className="mt-16" color="#77A7FF" />
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView className="flex-1 bg-canvas p-5">
        <Pressable accessibilityLabel="Go back" className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface" onPress={goBack}>
          <HubSymbol name="arrow_back" size={24} />
        </Pressable>
        <View className="mt-16 items-center rounded-[26px] border border-warning bg-surface p-8">
          <HubSymbol name="error" size={38} color="#FFC857" />
          <Text className="mt-4 text-center text-lg font-bold text-ink">App unavailable</Text>
          <Text className="mt-2 text-center leading-5 text-warning">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const release = app.latestRelease;
  const category = categoryDefinition(app.category);
  const installAction = installation.action;
  const isUpdate = installAction === "update";
  const addedPermissions = isUpdate && installation.installedPermissions ? release.permissions.filter((permission) => !installedPermissions.includes(permission)) : [];
  const removedPermissions = isUpdate && installation.installedPermissions ? installedPermissions.filter((permission) => !release.permissions.includes(permission)) : [];
  const coverArtwork = app.bannerUrl ?? app.featureGraphicUrl ?? app.screenshots[0];
  const badgeLabel = releaseBadgeLabel(release.previewOnly, release.trust.solanaMobileApproval);
  const publisherLinks = [
    { label: "Website", url: app.publisherLinks.website, icon: "public" as const },
    { label: "X", url: app.publisherLinks.x, icon: "alternate_email" as const },
    { label: "Discord", url: app.publisherLinks.discord, icon: "forum" as const },
    { label: "Telegram", url: app.publisherLinks.telegram, icon: "send" as const }
  ].flatMap((link) => link.url ? [{ ...link, url: link.url }] : []);
  const expandedHeroHeight = viewportWidth / 2;
  const collapsedHeroHeight = insets.top + 76;
  const collapseDistance = 120;
  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeroHeight, collapsedHeroHeight],
    extrapolate: "clamp"
  });
  const sharpHeroOpacity = scrollY.interpolate({
    inputRange: [0, 72],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });
  const blurredHeroOpacity = scrollY.interpolate({
    inputRange: [6, 72],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const heroShadeOpacity = scrollY.interpolate({
    inputRange: [0, 105],
    outputRange: [0.16, 0.72],
    extrapolate: "clamp"
  });
  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [52, 100],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const compactHeaderTranslateY = scrollY.interpolate({
    inputRange: [52, 100],
    outputRange: [8, 0],
    extrapolate: "clamp"
  });
  const iconScale = scrollY.interpolate({
    inputRange: [0, 82, collapseDistance],
    outputRange: [1, 0.62, 0.26],
    extrapolate: "clamp"
  });
  const iconOpacity = scrollY.interpolate({
    inputRange: [0, 82, collapseDistance],
    outputRange: [1, 0.72, 0],
    extrapolate: "clamp"
  });
  const iconTranslateX = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, -52],
    extrapolate: "clamp"
  });
  const iconTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, -98],
    extrapolate: "clamp"
  });
  const expandedButtonTop = expandedHeroHeight + 38;
  const collapsedButtonTop = insets.top + 16;
  const actionTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, collapsedButtonTop - expandedButtonTop],
    extrapolate: "clamp"
  });
  const expandedBadgeOpacity = scrollY.interpolate({
    inputRange: [0, 48],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });

  return (
    <View className="flex-1 bg-canvas">
      <Animated.ScrollView
        className="flex-1"
        contentContainerClassName="pb-14"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: expandedHeroHeight }} />

        <View className="bg-canvas px-5" style={{ paddingTop: 108 }}>
          <Text className="text-[32px] font-bold leading-[37px] tracking-[-0.7px] text-ink">{app.name}</Text>
          {app.publisher ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View ${app.publisher.displayName ?? "publisher"} profile`}
              className="mt-3 flex-row items-center self-start rounded-full border border-line bg-surface px-4 py-2"
              onPress={() => {
                if (app.publisher) router.push(`/publishers/${encodeURIComponent(app.publisher.slug)}` as Href);
              }}
            >
              <HubSymbol name="person" size={18} color="#77A7FF" />
              <Text className="ml-2 text-sm font-semibold text-ink">{app.publisher.displayName ?? "View publisher profile"}</Text>
              <HubSymbol name="chevron_right" size={16} color="#77A7FF" />
            </Pressable>
          ) : null}
          <Text className="mt-2 text-base leading-6 text-muted">{app.shortDescription ?? "Discover this Solana app"}</Text>
          {installation.stage !== "idle" && installation.detail ? (
            <Text accessibilityLiveRegion="polite" className={installation.stage === "error" ? "mt-3 text-sm leading-5 text-warning" : "mt-3 text-sm leading-5 text-muted"}>
              {installation.detail}
            </Text>
          ) : null}
          <SolanaMobileRating rating={app.solanaMobileRating} detail />
          {app.genres.length ? <View className="mt-4 flex-row flex-wrap gap-2">{app.genres.map((genre) => <View className="rounded-full border border-line bg-surface px-3 py-2" key={genre}><Text className="text-xs font-semibold text-muted">{genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`}</Text></View>)}</View> : null}
          {isUpdate ? (
            <View className="mt-4 flex-row items-center self-start rounded-full bg-coral px-4 py-2">
              <HubSymbol name="update" size={17} color="#091018" />
              <Text className="ml-2 text-sm font-bold text-canvas">Update to {release.versionName}</Text>
            </View>
          ) : installed ? (
            <View className="mt-4 flex-row items-center self-start rounded-full border border-line bg-surface px-4 py-2">
              <HubSymbol name="check_circle" size={17} color="#77A7FF" />
              <Text className="ml-2 text-sm font-semibold text-ink">
                {installAction === "newer-installed" ? "Newer version installed" : "Installed"} · {installed.versionName ?? installed.versionCode}
              </Text>
            </View>
          ) : null}

          {app.screenshots.length > 0 ? (
            <>
              <SectionTitle title="Preview" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-5">
                {app.screenshots.map((screenshot, index) => (
                  <Image
                    key={`${screenshot}-${index}`}
                    accessibilityIgnoresInvertColors
                    source={{ uri: screenshot }}
                    resizeMode="cover"
                    className="mr-3 h-[410px] w-[230px] rounded-[24px] bg-surface"
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          {(app.description || app.shortDescription) ? (
            <>
              <SectionTitle title="About this app" />
              <Text className="text-[17px] leading-7 text-ink">{app.description ?? app.shortDescription}</Text>
            </>
          ) : null}

          {publisherLinks.length > 0 ? (
            <>
              <SectionTitle title="Follow & support" />
              <View className="overflow-hidden rounded-[26px] border border-line bg-surface">
                {publisherLinks.map((link, index) => (
                  <Pressable
                    accessibilityRole="link"
                    className={`flex-row items-center px-5 py-4 active:bg-raised${index < publisherLinks.length - 1 ? " border-b border-line" : ""}`}
                    key={link.label}
                    onPress={() => void Linking.openURL(link.url)}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-raised">
                      <HubSymbol name={link.icon} size={21} color="#77A7FF" />
                    </View>
                    <Text className="ml-3 flex-1 text-base font-semibold text-ink">{link.label}</Text>
                    <HubSymbol name="open_in_new" size={19} color="#95A5B7" />
                  </Pressable>
                ))}
              </View>
              <Text className="mt-3 text-xs leading-5 text-muted">Links provided by the current publisher.</Text>
            </>
          ) : null}

          {isUpdate ? <SectionTitle title="Permission changes" /> : null}
          {addedPermissions.length > 0 ? (
            <View className="mb-3 rounded-[22px] border border-warning bg-surface p-4">
              <Text className="text-sm font-bold text-warning">New in this update</Text>
              <Text className="mt-2 text-sm leading-5 text-ink">{addedPermissions.map(humanizePermission).join(", ")}</Text>
            </View>
          ) : null}
          {removedPermissions.length > 0 ? (
            <View className="mb-3 rounded-[22px] border border-line bg-surface p-4">
              <Text className="text-sm font-bold text-mint">Removed in this update</Text>
              <Text className="mt-2 text-sm leading-5 text-muted">{removedPermissions.map(humanizePermission).join(", ")}</Text>
            </View>
          ) : null}

          <DisclosureSection
            expanded={permissionsExpanded}
            icon="privacy_tip"
            onPress={() => setPermissionsExpanded((current) => !current)}
            summary={permissionSummary(release.permissions)}
            title="Data & permissions"
          >
            <View className="overflow-hidden rounded-[22px] border border-line bg-canvas">
              {release.permissions.length > 0 ? release.permissions.map((permission, index) => (
                <PermissionRow
                  key={permission}
                  permission={permission}
                  showTechnicalName={technicalNamesExpanded}
                  last={index === release.permissions.length - 1}
                />
              )) : (
                <View className="flex-row items-center p-5">
                  <HubSymbol name="check_circle" size={23} color="#77A7FF" />
                  <Text className="ml-3 flex-1 text-sm leading-5 text-muted">No permissions are listed in this release metadata.</Text>
                </View>
              )}
            </View>
            {release.permissions.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                className="mt-4 flex-row items-center self-start rounded-full border border-line px-4 py-3 active:bg-raised"
                onPress={() => setTechnicalNamesExpanded((current) => !current)}
              >
                <Text className="text-sm font-semibold text-muted">{technicalNamesExpanded ? "Hide technical names" : "Show technical names"}</Text>
                <HubSymbol name={technicalNamesExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down"} size={18} color="#95A5B7" style={{ marginLeft: 6 }} />
              </Pressable>
            ) : null}
          </DisclosureSection>

          <DisclosureSection
            expanded={verificationExpanded}
            icon="verified_user"
            onPress={() => setVerificationExpanded((current) => !current)}
            summary="Publisher permission, app-file checks and Solana Mobile status"
            title="Verification details"
          >
            <View className="overflow-hidden rounded-[22px] border border-line bg-canvas">
              <EvidenceRow icon="person_check" label="Publisher permission" value="Confirmed" tone="mint" />
              <EvidenceRow icon="fact_check" label="Dapport listing consent" value="Confirmed" tone="mint" />
              <EvidenceRow
                icon={release.previewOnly ? "science" : "shield_lock"}
                label="App file"
                value={release.previewOnly ? "Preview release" : "Validated release"}
                tone={release.previewOnly ? "warning" : "mint"}
              />
              <EvidenceRow
                icon="approval"
                label="Solana Mobile status"
                value={approvalLabel(release.trust.solanaMobileApproval)}
                tone={release.trust.solanaMobileApproval === "verified_approved" ? "mint" : "muted"}
                last
              />
            </View>
            <Text className="mt-3 text-xs leading-5 text-muted">This status is shown only when the package and version match the release currently visible on Solana Mobile.</Text>
          </DisclosureSection>

          <SectionTitle title="Details" />
          <View className="overflow-hidden rounded-[26px] border border-line bg-surface">
            <InfoRow label="Version" value={`${release.versionName} (${release.versionCode})`} />
            <InfoRow label="Android required" value={`Android API ${release.minSdk}+`} />
            <InfoRow label="Download size" value={formatBytes(release.apkSize)} />
            {release.targetSdk ? <InfoRow label="Target SDK" value={String(release.targetSdk)} /> : null}
            {app.releaseUpdatedAt ? <InfoRow label="Release updated" value={formatDate(app.releaseUpdatedAt)} /> : null}
            <InfoRow label="Package" value={release.packageName} last />
          </View>

          <View className="mt-8 rounded-[26px] bg-raised p-5">
            <View className="flex-row items-start">
              <HubSymbol name="verified_user" size={24} color="#77A7FF" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-ink">Ready when you are</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">Dapport checks the app file on your phone before handing it to Android.</Text>
              </View>
            </View>
            <AppInstallButton installation={installation} />
          </View>
        </View>
      </Animated.ScrollView>

      <CollapsingDetailHero
        app={app}
        artwork={coverArtwork}
        badgeLabel={badgeLabel}
        blurredArtworkOpacity={blurredHeroOpacity}
        categoryIcon={category.icon}
        categoryTone={category.accent}
        contentOpacity={compactHeaderOpacity}
        contentTranslateY={compactHeaderTranslateY}
        expandedBadgeOpacity={expandedBadgeOpacity}
        heroHeight={heroHeight}
        shadeOpacity={heroShadeOpacity}
        sharpArtworkOpacity={sharpHeroOpacity}
        onBack={goBack}
        actionWidth={installation.busy || installation.visibility === "loading" ? 202 : 118}
        safeTop={insets.top}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          left: 20,
          opacity: iconOpacity,
          position: "absolute",
          top: expandedHeroHeight - 24,
          transform: [{ translateX: iconTranslateX }, { translateY: iconTranslateY }, { scale: iconScale }],
          zIndex: 45
        }}
      >
        <View className="rounded-[30px] border-4 border-canvas bg-canvas">
          <AppArtwork app={app} size={120} radius={30} />
        </View>
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          right: 20,
          top: expandedButtonTop,
          transform: [{ translateY: actionTranslateY }],
          zIndex: 50
        }}
      >
        <AppInstallButton installation={installation} compact />
      </Animated.View>
    </View>
  );
}

function ReleaseBadge({ statusLabel }: { statusLabel: string | null }) {
  if (!statusLabel) return null;
  const preview = statusLabel === "Preview release";
  return (
    <View className={preview ? "rounded-full bg-warning px-3 py-1.5" : "rounded-full bg-canvas px-3 py-1.5"}>
      <Text className={preview ? "text-xs font-bold text-canvas" : "text-xs font-bold text-ink"}>{statusLabel}</Text>
    </View>
  );
}

function CollapsingDetailHero({
  app,
  artwork,
  badgeLabel,
  blurredArtworkOpacity,
  categoryIcon,
  categoryTone,
  contentOpacity,
  contentTranslateY,
  expandedBadgeOpacity,
  heroHeight,
  shadeOpacity,
  sharpArtworkOpacity,
  onBack,
  safeTop,
  actionWidth
}: {
  app: CatalogAppDto;
  artwork: string | undefined;
  badgeLabel: string | null;
  blurredArtworkOpacity: Animated.AnimatedInterpolation<number>;
  categoryIcon: Parameters<typeof HubSymbol>[0]["name"];
  categoryTone: string;
  contentOpacity: Animated.AnimatedInterpolation<number>;
  contentTranslateY: Animated.AnimatedInterpolation<number>;
  expandedBadgeOpacity: Animated.AnimatedInterpolation<number>;
  heroHeight: Animated.AnimatedInterpolation<number>;
  shadeOpacity: Animated.AnimatedInterpolation<number>;
  sharpArtworkOpacity: Animated.AnimatedInterpolation<number>;
  onBack: () => void;
  safeTop: number;
  actionWidth: number;
}) {
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        backgroundColor: "#101A2A",
        height: heroHeight,
        left: 0,
        overflow: "hidden",
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 40
      }}
    >
      {artwork ? (
        <>
          <Animated.View pointerEvents="none" style={{ bottom: 0, left: 0, opacity: sharpArtworkOpacity, position: "absolute", right: 0, top: 0 }}>
            <Image resizeMode="cover" source={{ uri: artwork }} style={{ height: "100%", width: "100%" }} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ bottom: 0, left: 0, opacity: blurredArtworkOpacity, position: "absolute", right: 0, top: 0 }}>
            <Image blurRadius={14} resizeMode="cover" source={{ uri: artwork }} style={{ height: "100%", width: "100%" }} />
          </Animated.View>
        </>
      ) : (
        <View className="h-full w-full items-end justify-end bg-raised p-6">
          <HubSymbol name={categoryIcon} size={52} color={categoryTone} />
        </View>
      )}
      <Animated.View
        pointerEvents="none"
        style={{ backgroundColor: "#010213", bottom: 0, left: 0, opacity: shadeOpacity, position: "absolute", right: 0, top: 0 }}
      />

      <Animated.View pointerEvents="none" style={{ bottom: 14, opacity: expandedBadgeOpacity, position: "absolute", right: 16 }}>
        <ReleaseBadge statusLabel={badgeLabel} />
      </Animated.View>

      <View className="flex-row items-center px-4" style={{ height: 64, marginTop: safeTop + 8 }}>
        <Pressable
          accessibilityLabel="Go back"
          className="h-12 w-12 items-center justify-center rounded-2xl bg-canvas active:bg-surface"
          onPress={onBack}
        >
          <HubSymbol name="arrow_back" size={24} />
        </Pressable>

        <Animated.View
          pointerEvents="none"
          style={{ flex: 1, marginLeft: 12, marginRight: actionWidth, opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}
        >
          <Text className="text-base font-bold text-ink" numberOfLines={1}>{app.name}</Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>{app.shortDescription ?? "Discover this Solana app"}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text className="mb-4 mt-9 text-[25px] font-bold tracking-[-0.5px] text-ink">{title}</Text>;
}

function DisclosureSection({
  children,
  expanded,
  icon,
  onPress,
  summary,
  title
}: {
  children: ReactNode;
  expanded: boolean;
  icon: Parameters<typeof HubSymbol>[0]["name"];
  onPress: () => void;
  summary: string;
  title: string;
}) {
  return (
    <View className="mt-8 overflow-hidden rounded-[26px] border border-line bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center p-5 active:bg-raised"
        onPress={onPress}
      >
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-raised">
          <HubSymbol name={icon} size={23} color="#77A7FF" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-bold text-ink">{title}</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">{summary}</Text>
        </View>
        <HubSymbol name={expanded ? "keyboard_arrow_up" : "keyboard_arrow_down"} size={24} color="#95A5B7" />
      </Pressable>
      {expanded ? <View className="border-t border-line p-4">{children}</View> : null}
    </View>
  );
}

function EvidenceRow({
  icon,
  label,
  value,
  tone,
  last = false
}: {
  icon: Parameters<typeof HubSymbol>[0]["name"];
  label: string;
  value: string;
  tone: "mint" | "warning" | "muted";
  last?: boolean;
}) {
  const color = tone === "mint" ? "#77A7FF" : tone === "warning" ? "#FFC857" : "#95A5B7";
  return (
    <View className={last ? "flex-row items-center p-4" : "flex-row items-center border-b border-line p-4"}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-raised">
        <HubSymbol name={icon} size={21} color={color} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-xs text-muted">{label}</Text>
        <Text className="mt-0.5 text-sm font-semibold text-ink">{value}</Text>
      </View>
      <HubSymbol name={tone === "mint" ? "check_circle" : "info"} size={19} color={color} />
    </View>
  );
}

function PermissionRow({ permission, last, showTechnicalName }: { permission: string; last: boolean; showTechnicalName: boolean }) {
  return (
    <View className={last ? "flex-row items-center p-4" : "flex-row items-center border-b border-line p-4"}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-raised">
        <HubSymbol name="key" size={21} color="#95A5B7" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-ink">{humanizePermission(permission)}</Text>
        {showTechnicalName ? <Text className="mt-1 text-xs text-muted" selectable>{permission}</Text> : null}
      </View>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={last ? "flex-row items-start justify-between p-4" : "flex-row items-start justify-between border-b border-line p-4"}>
      <Text className="mr-5 text-sm text-muted">{label}</Text>
      <Text className="max-w-[58%] text-right text-sm font-semibold text-ink" selectable>{value}</Text>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

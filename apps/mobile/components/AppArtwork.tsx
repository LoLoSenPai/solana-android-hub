import type { CatalogAppDto } from "@hub/api-client";
import { useEffect, useState } from "react";
import { Image } from "react-native";
import FALLBACK_ARTWORK from "../assets/hub-app-fallback.png";

interface AppArtworkProps {
  app: Pick<CatalogAppDto, "iconUrl">;
  size?: number;
  radius?: number;
}

export function AppArtwork({ app, size = 64, radius = 18 }: AppArtworkProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    setRemoteFailed(false);
  }, [app.iconUrl]);

  if (app.iconUrl && !remoteFailed) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: app.iconUrl }}
        onError={() => setRemoteFailed(true)}
        resizeMode="cover"
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#132320" }}
      />
    );
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      source={FALLBACK_ARTWORK}
      resizeMode="cover"
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#132320" }}
    />
  );
}

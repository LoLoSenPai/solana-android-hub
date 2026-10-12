import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import type { ConfirmedInstalledApp } from "./installed-apps";
import { loadConfirmedInstalledApps } from "./installed-apps-native";

export function useInstalledApps() {
  const [installedApps, setInstalledApps] = useState<readonly ConfirmedInstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!active.current) return;
    const request = ++generation.current;
    setInstalledApps([]);
    setLoading(true);
    setError(false);
    try {
      const confirmed = await loadConfirmedInstalledApps();
      if (active.current && request === generation.current) setInstalledApps(confirmed);
    } catch {
      if (active.current && request === generation.current) setError(true);
    } finally {
      if (active.current && request === generation.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void refresh();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => {
      active.current = false;
      generation.current += 1;
      subscription.remove();
    };
  }, [refresh]));
  return { installedApps, loading, error, refresh };
}

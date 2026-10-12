import { AppInstaller } from "@hub/app-installer";
import type { CatalogAppDto } from "@hub/api-client";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { getInstallAction } from "../catalog/install-action";
import { listInstalledApps, saveInstalledApp } from "../../storage/database";
import { createInstallController, emptyInstallState } from "./install-controller";

const controllers = new Map<string, ReturnType<typeof createInstallController>>();
function controllerFor(packageName: string) {
  let controller = controllers.get(packageName);
  if (!controller) {
    controller = createInstallController(packageName, {
      getInstallCapability: () => AppInstaller.getInstallCapability(),
      getInstalledPackageInfo: (name) => AppInstaller.getInstalledPackageInfo(name),
      openUnknownSourcesSettings: () => AppInstaller.openUnknownSourcesSettings(),
      openInstalledApp: async (name) => {
        if (!AppInstaller.openInstalledApp) throw Object.assign(new Error("App launch unavailable"), { code: "APP_LAUNCH_UNAVAILABLE" });
        await AppInstaller.openInstalledApp(name);
      },
      prepareInstall: (id, release) => AppInstaller.prepareInstall(id, release),
      installPrepared: (id) => AppInstaller.installPrepared(id),
      getInstallOperation: (id) => AppInstaller.getInstallOperation(id),
      discardPrepared: (id) => AppInstaller.discardPrepared(id),
      cancel: (id) => AppInstaller.cancel(id),
      addListener: (event, listener) => AppInstaller.addListener(event, listener),
      listInstalledApps, saveInstalledApp, now: Date.now,
      wait: () => new Promise((resolve) => setTimeout(resolve, 1000)),
    });
    controllers.set(packageName, controller);
  }
  return controller;
}
const noRefresh = () => Promise.resolve();
const emptyController = {
  subscribe: () => () => undefined,
  getSnapshot: () => emptyInstallState,
  refresh: noRefresh,
  install: noRefresh,
  open: noRefresh,
  cancel: noRefresh,
};

export function useAppInstall(app: CatalogAppDto | null) {
  const controller = app ? controllerFor(app.latestRelease.packageName) : emptyController;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const refresh = app ? controller.refresh : noRefresh;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  return {
    ...state,
    action: getInstallAction(app?.latestRelease.versionCode ?? "0", state.installedPackage?.versionCode),
    refresh,
    install: () => app ? controller.install(app) : Promise.resolve(),
    open: () => app ? controller.open() : Promise.resolve(),
    cancel: () => app ? controller.cancel() : Promise.resolve(),
  };
}

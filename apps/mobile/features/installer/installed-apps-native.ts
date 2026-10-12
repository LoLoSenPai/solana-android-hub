import { AppInstaller } from "@hub/app-installer";
import { listInstalledApps } from "../../storage/database";
import { reconcileInstalledApps } from "./installed-apps";

export async function loadConfirmedInstalledApps() {
  return reconcileInstalledApps(await listInstalledApps(), (name) => AppInstaller.getInstalledPackageInfo(name));
}

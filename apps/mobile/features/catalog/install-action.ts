export type InstallAction = "install" | "update" | "current" | "newer-installed";

export function getInstallAction(targetVersionCode: string, installedVersionCode?: string): InstallAction {
  if (installedVersionCode === undefined) return "install";
  const target = BigInt(targetVersionCode);
  const installed = BigInt(installedVersionCode);
  if (target > installed) return "update";
  if (target === installed) return "current";
  return "newer-installed";
}

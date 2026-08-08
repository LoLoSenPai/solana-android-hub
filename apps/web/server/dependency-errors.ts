export type ExternalDependencyFailure = "authentication" | "capacity" | "network" | "rpc" | "unknown";

export function classifyExternalDependencyFailure(error: unknown): ExternalDependencyFailure {
  if (!(error instanceof Error)) return "unknown";
  const message = error.message.toLowerCase();
  if (/api[- ]?key|unauthori[sz]ed|forbidden|\b401\b|\b403\b/u.test(message)) return "authentication";
  if (/rate.?limit|credits?|quota|\b429\b/u.test(message)) return "capacity";
  if (/fetch failed|network|timeout|timed out|abort|econn|enotfound|socket/u.test(message)) return "network";
  if (/rpc error/u.test(message)) return "rpc";
  return "unknown";
}

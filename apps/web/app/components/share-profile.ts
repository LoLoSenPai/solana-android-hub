type ShareTarget = {
  share?: (data: { title: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export async function shareProfileLink(target: ShareTarget, data: { title: string; url: string }): Promise<"shared" | "copied" | "manual" | "cancelled"> {
  if (typeof target.share === "function") {
    try {
      await target.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (!target.clipboard?.writeText) return "manual";
    await target.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "manual";
  }
}

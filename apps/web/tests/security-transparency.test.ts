import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public security and transparency surface", () => {
  it("states the security boundary and its limits without a generic safety promise", async () => {
    const page = await readFile(new URL("../app/security/page.tsx", import.meta.url), "utf8");

    expect(page).toContain("no root access, wallet, seed phrase or wallet transaction");
    expect(page).toContain("Android asks for your confirmation before every Dapport installation or update");
    expect(page).toContain("public Solana Mobile publishing format");
    expect(page).toContain("do not audit an app’s code, guarantee its safety, assess an investment or indicate Solana Mobile approval");
    expect(page).toContain("QUERY_ALL_PACKAGES");
    expect(page).toContain("installed-app inventory stays on your device");
  });

  it("is discoverable from navigation, download, publisher landing, and the site footer", async () => {
    const [navigation, download, publisher, layout] = await Promise.all([
      readFile(new URL("../app/components/SiteNavigation.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/download/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/publisher/PublisherLanding.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8")
    ]);

    expect(navigation).toContain('href="/security"');
    expect(download).toContain('href="/security#android-permission"');
    expect(publisher).toContain('href="/security"');
    expect(layout).toContain('href="/security"');
  });
});

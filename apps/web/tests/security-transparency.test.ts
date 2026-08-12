import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public security and transparency surface", () => {
  it("states the security boundary and its limits without a generic safety promise", async () => {
    const page = await readFile(new URL("../app/security/page.tsx", import.meta.url), "utf8");

    expect(page).toContain("No root access, no silent installation, no seed phrase");
    expect(page).toContain("public Solana Mobile publishing format");
    expect(page).toContain("Identity is not a security audit.");
    expect(page).toContain("not a blanket “safe” badge");
    expect(page).toContain("QUERY_ALL_PACKAGES");
    expect(page).toContain("installed-app inventory never leaves the device");
  });

  it("is discoverable from trust, download, and the site footer", async () => {
    const files = await Promise.all([
      readFile(new URL("../app/components/CatalogueExperience.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/download/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/publisher/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8")
    ]);

    for (const source of files) expect(source).toContain('href="/security"');
  });
});

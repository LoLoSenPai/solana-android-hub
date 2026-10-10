import { describe, expect, it, vi } from "vitest";
import { shareProfileLink } from "../app/components/share-profile";

const data = { title: "Publisher on Dapport", url: "https://dapport.app/publishers/example" };

describe("profile sharing", () => {
  it("uses native sharing without copying when it succeeds", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareProfileLink({ share, clipboard: { writeText } }, data)).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("leaves cancellation silent without copying", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Dismissed", "AbortError"));
    const writeText = vi.fn();
    expect(await shareProfileLink({ share, clipboard: { writeText } }, data)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the canonical URL when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareProfileLink({ clipboard: { writeText } }, data)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("falls back to copying if native sharing fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Permission denied"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareProfileLink({ share, clipboard: { writeText } }, data)).toBe("copied");
  });

  it("requests a selectable URL when clipboard access fails or is absent", async () => {
    expect(await shareProfileLink({}, data)).toBe("manual");
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    expect(await shareProfileLink({ clipboard: { writeText } }, data)).toBe("manual");
  });
});

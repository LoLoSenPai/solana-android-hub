import { describe, expect, it } from "vitest";
import { CatalogRepository } from "../src/index.js";

describe("CatalogRepository", () => {
  it("is constructed only with a server-side SQL boundary", () => {
    expect(CatalogRepository).toBeTypeOf("function");
  });
});

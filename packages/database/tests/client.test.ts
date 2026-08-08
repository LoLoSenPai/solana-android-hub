import { beforeEach, describe, expect, it, vi } from "vitest";

const { postgresMock } = vi.hoisted(() => ({
  postgresMock: vi.fn(() => ({ client: "mock" }))
}));

vi.mock("postgres", () => ({
  default: postgresMock
}));

import { connectDatabase } from "../src/client.js";

describe("connectDatabase", () => {
  beforeEach(() => {
    postgresMock.mockClear();
  });

  it("uses a bounded pool suitable for warm serverless instances", () => {
    connectDatabase("postgres://hub@example.test/hub");

    expect(postgresMock).toHaveBeenCalledWith(
      "postgres://hub@example.test/hub",
      expect.objectContaining({
        max: 3,
        idle_timeout: 10,
        connect_timeout: 10,
        max_lifetime: 300,
        prepare: false
      })
    );
  });
});

import { generateKeyPairSigner, getAddressEncoder, signBytes } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { verifyWalletSignature } from "../src/index.js";

describe("wallet signature verification", () => {
  it("verifies canonical UTF-8 signed bytes", async () => {
    const signer = await generateKeyPairSigner();
    const message = "Solana Android Hub Authentication\nVersion: 1";
    const signature = await signBytes(signer.keyPair.privateKey, new TextEncoder().encode(message));
    expect(verifyWalletSignature({
      wallet: signer.address,
      message,
      signatureBase64Url: Buffer.from(signature).toString("base64url")
    })).toBe(true);
    expect(getAddressEncoder().encode(signer.address)).toHaveLength(32);
  });

  it("rejects modified messages", async () => {
    const signer = await generateKeyPairSigner();
    const signature = await signBytes(signer.keyPair.privateKey, new TextEncoder().encode("expected"));
    expect(verifyWalletSignature({
      wallet: signer.address,
      message: "modified",
      signatureBase64Url: Buffer.from(signature).toString("base64url")
    })).toBe(false);
  });
});

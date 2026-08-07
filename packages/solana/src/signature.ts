import { address, getAddressEncoder } from "@solana/kit";
import nacl from "tweetnacl";

export function verifyWalletSignature(input: {
  wallet: string;
  message: string;
  signatureBase64Url: string;
}): boolean {
  const signature = decodeCanonicalBase64Url(input.signatureBase64Url);
  if (signature.length !== nacl.sign.signatureLength) return false;

  const publicKey = Uint8Array.from(getAddressEncoder().encode(address(input.wallet)));
  return nacl.sign.detached.verify(new TextEncoder().encode(input.message), signature, publicKey);
}

export function normalizeSolanaAddress(value: string): string {
  return address(value);
}

function decodeCanonicalBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return new Uint8Array();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) return new Uint8Array();
  return decoded;
}

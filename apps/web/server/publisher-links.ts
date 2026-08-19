import { isIP } from "node:net";
import { EMPTY_PUBLISHER_LINKS, type PublisherLinks } from "@hub/domain";
import { z } from "zod";

const nullableLink = z.string().trim().max(2048).nullable().optional();

export const publisherLinksInputSchema = z.object({
  website: nullableLink,
  x: nullableLink,
  discord: nullableLink,
  telegram: nullableLink
}).strict();

export class PublisherLinkValidationError extends Error {}

export function normalizePublisherLinks(input: z.infer<typeof publisherLinksInputSchema>): PublisherLinks {
  return {
    website: normalizeWebsite(input.website),
    x: normalizeX(input.x),
    discord: normalizeDiscord(input.discord),
    telegram: normalizeTelegram(input.telegram)
  };
}

function normalizeWebsite(value: string | null | undefined): string | null {
  const url = parseHttps(value, "Website");
  if (!url) return null;
  const hostname = url.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
      !hostname.includes(".") || isIP(hostname) !== 0) {
    throw new PublisherLinkValidationError("Website must use a public domain name.");
  }
  url.hash = "";
  return url.toString();
}

function normalizeX(value: string | null | undefined): string | null {
  const url = parseHttps(value, "X");
  if (!url) return null;
  requireHost(url, ["x.com", "www.x.com", "twitter.com", "www.twitter.com"], "X");
  const [handle, extra] = pathParts(url);
  if (!handle || extra || !/^[A-Za-z0-9_]{1,15}$/u.test(handle)) {
    throw new PublisherLinkValidationError("X link must point to a profile, for example https://x.com/dapportapp.");
  }
  return `https://x.com/${handle}`;
}

function normalizeDiscord(value: string | null | undefined): string | null {
  const url = parseHttps(value, "Discord");
  if (!url) return null;
  requireHost(url, ["discord.gg", "www.discord.gg", "discord.com", "www.discord.com"], "Discord");
  const parts = pathParts(url);
  const invite = url.hostname.toLowerCase().endsWith("discord.com") ? (parts[0] === "invite" ? parts[1] : undefined) : parts[0];
  if (!invite || parts.length !== (url.hostname.toLowerCase().endsWith("discord.com") ? 2 : 1) || !/^[A-Za-z0-9-]{2,64}$/u.test(invite)) {
    throw new PublisherLinkValidationError("Discord link must be a discord.gg or discord.com/invite link.");
  }
  return `https://discord.gg/${invite}`;
}

function normalizeTelegram(value: string | null | undefined): string | null {
  const url = parseHttps(value, "Telegram");
  if (!url) return null;
  requireHost(url, ["t.me", "www.t.me", "telegram.me", "www.telegram.me"], "Telegram");
  const [handle, extra] = pathParts(url);
  if (!handle || extra || !/^[A-Za-z0-9_]{5,32}$/u.test(handle)) {
    throw new PublisherLinkValidationError("Telegram link must point to a public t.me username.");
  }
  return `https://t.me/${handle}`;
}

function parseHttps(value: string | null | undefined, label: string): URL | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PublisherLinkValidationError(`${label} link is not a valid URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new PublisherLinkValidationError(`${label} link must use HTTPS without embedded credentials.`);
  }
  if (url.search || url.hash) throw new PublisherLinkValidationError(`${label} link cannot contain query parameters or a fragment.`);
  return url;
}

function requireHost(url: URL, allowed: readonly string[], label: string): void {
  if (!allowed.includes(url.hostname.toLowerCase())) {
    throw new PublisherLinkValidationError(`${label} link must use an official ${label} domain.`);
  }
}

function pathParts(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

export function emptyPublisherLinks(): PublisherLinks {
  return { ...EMPTY_PUBLISHER_LINKS };
}

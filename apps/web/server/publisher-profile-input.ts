import { z } from "zod";
import type { PublisherProfileUpdate } from "@hub/database";
import { normalizePublisherLinks, publisherLinksInputSchema } from "./publisher-links";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const publisherProfileInputSchema = z.object({
  slug: optionalText(48).transform((value) => value?.toLowerCase() || null)
    .refine((value) => value === null || (/^[a-z][a-z0-9-]{2,47}$/u.test(value) &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value)),
    "Slug must contain 3–48 lowercase letters, digits or hyphens, start with a letter, and cannot be a UUID."),
  displayName: optionalText(120),
  bio: optionalText(1000),
  avatarUrl: optionalText(2048),
  portfolioUrl: optionalText(2048),
  links: publisherLinksInputSchema.optional()
}).strict();

export function normalizePublisherProfile(input: z.infer<typeof publisherProfileInputSchema>): PublisherProfileUpdate {
  return {
    slug: input.slug,
    displayName: input.displayName || null,
    bio: input.bio || null,
    // Reuse the public-domain HTTPS validator used by publisher websites.
    avatarUrl: normalizePublisherLinks({ website: input.avatarUrl }).website,
    portfolioUrl: normalizePublisherLinks({ website: input.portfolioUrl }).website,
    links: normalizePublisherLinks(input.links ?? {})
  };
}

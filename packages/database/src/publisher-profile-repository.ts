import type { PublisherLinks } from "@hub/domain";
import type { HubSql } from "./client";

export interface PublisherProfileRecord {
  id: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  portfolioUrl: string | null;
  links: PublisherLinks;
}

export interface PublisherProfileUpdate {
  slug: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  portfolioUrl: string | null;
  links: PublisherLinks;
}

interface ProfileRow {
  id: string;
  profile_slug: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  portfolio_url: string | null;
  profile_links: unknown;
}

export class PublisherProfileSlugConflictError extends Error {}

export class PublisherProfileRepository {
  public constructor(private readonly sql: HubSql) {}

  public async getById(publisherId: string): Promise<PublisherProfileRecord | null> {
    const [row] = await this.sql<ProfileRow[]>`
      select id, profile_slug, display_name, bio, avatar_url, portfolio_url, profile_links
      from hub.publishers where id = ${publisherId} and status = 'active'
    `;
    return row ? mapProfile(row) : null;
  }

  public async getPublicBySlug(slug: string): Promise<PublisherProfileRecord | null> {
    // Compare text so arbitrary public path input never reaches a UUID cast.
    const [row] = await this.sql<ProfileRow[]>`
      select id, profile_slug, display_name, bio, avatar_url, portfolio_url, profile_links
      from hub.publishers where status = 'active' and (profile_slug = ${slug} or id::text = ${slug})
    `;
    return row ? mapProfile(row) : null;
  }

  public async update(publisherId: string, input: PublisherProfileUpdate): Promise<PublisherProfileRecord | null> {
    try {
      const [row] = await this.sql<ProfileRow[]>`
        update hub.publishers set profile_slug = ${input.slug}, display_name = ${input.displayName},
          bio = ${input.bio}, avatar_url = ${input.avatarUrl}, portfolio_url = ${input.portfolioUrl},
          profile_links = ${this.sql.json({ ...input.links })}, updated_at = now()
        where id = ${publisherId} and status = 'active'
        returning id, profile_slug, display_name, bio, avatar_url, portfolio_url, profile_links
      `;
      return row ? mapProfile(row) : null;
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error && error.code === "23505" &&
          "constraint_name" in error && error.constraint_name === "publishers_profile_slug_unique") {
        throw new PublisherProfileSlugConflictError("This publisher slug is already in use.");
      }
      throw error;
    }
  }
}

function mapProfile(row: ProfileRow): PublisherProfileRecord {
  const links = row.profile_links !== null && typeof row.profile_links === "object"
    ? row.profile_links as Record<string, unknown> : {};
  const link = (key: keyof PublisherLinks) => typeof links[key] === "string" ? links[key] : null;
  return {
    id: row.id, slug: row.profile_slug ?? row.id, displayName: row.display_name, bio: row.bio,
    avatarUrl: row.avatar_url, portfolioUrl: row.portfolio_url,
    links: { website: link("website"), x: link("x"), discord: link("discord"), telegram: link("telegram") }
  };
}

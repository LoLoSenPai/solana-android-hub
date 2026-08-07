import type { HubSql } from "./client";

export class SecurityRepository {
  public constructor(private readonly sql: HubSql) {}

  public async consumeRateLimit(input: {
    subjectHash: Buffer;
    routeClass: string;
    bucketStart: Date;
    expiresAt: Date;
    limit: number;
  }): Promise<{ allowed: boolean; remaining: number }> {
    const [row] = await this.sql<{ request_count: number }[]>`
      insert into hub.security_rate_buckets (subject_hash, route_class, bucket_start, request_count, expires_at)
      values (${input.subjectHash}, ${input.routeClass}, ${input.bucketStart}, 1, ${input.expiresAt})
      on conflict (subject_hash, route_class, bucket_start) do update set
        request_count = hub.security_rate_buckets.request_count + 1,
        expires_at = excluded.expires_at
      where hub.security_rate_buckets.request_count < ${input.limit}
      returning request_count
    `;
    return row
      ? { allowed: true, remaining: Math.max(0, input.limit - row.request_count) }
      : { allowed: false, remaining: 0 };
  }
}

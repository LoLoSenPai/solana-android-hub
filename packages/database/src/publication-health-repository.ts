import type { AppEnvironment } from "@hub/domain";
import type { HubSql } from "./client";

export interface PublicationHealthIssue {
  app: string;
  code: string;
  version: string | null;
  validationId: string | null;
}

export class PublicationHealthRepository {
  public constructor(private readonly sql: HubSql) {}

  public async read(environment: AppEnvironment): Promise<{ issues: PublicationHealthIssue[]; truncated: boolean }> {
    const issueLimit = 25;
    const rows = await this.sql<{ app: string; code: string; version: string | null; validation_id: string | null }[]>`
      with eligible_apps as (
        select a.id, a.slug, a.release_policy, dc.verified_at as consented_at
        from hub.apps a
        join hub.distribution_consents dc on dc.app_id = a.id
          and dc.environment = ${environment}::hub.app_environment and dc.status = 'active' and dc.superseded_at is null
        where a.claim_status = 'verified' and a.distribution_enabled and a.suspended_at is null and a.revoked_at is null
          and exists (select 1 from hub.app_claims c where c.app_id = a.id and c.status = 'verified' and c.superseded_at is null)
      ), validation_issues as (
        select a.slug as app, r.version_code::text as version, v.correlation_id as validation_id,
          case
            when v.status = 'failed' and 'VALIDATOR_DISPATCH_FAILED' = any(v.failure_codes) then
              case when v.observed->>'detail' ~ '^VALIDATOR_DISPATCH_HTTP_[1-5][0-9]{2}$'
                then v.observed->>'detail' else 'VALIDATOR_DISPATCH_FAILED' end
            when v.status = 'failed' and 'VALIDATOR_TIMEOUT' = any(v.failure_codes) then 'VALIDATOR_TIMEOUT'
            when v.status = 'failed' and 'VALIDATOR_RUNNER_FAILED' = any(v.failure_codes) then 'VALIDATOR_RUNNER_FAILED'
            when v.status = 'failed' and 'MANIFEST_INVALID' = any(v.failure_codes) then 'MANIFEST_INVALID'
            when v.status = 'queued' and (v.created_at < now() - interval '45 minutes' or previous.timed_out)
              then 'VALIDATOR_OVERDUE'
            when v.status = 'running' and coalesce(v.started_at, v.created_at) < now() - interval '45 minutes'
              then 'VALIDATOR_OVERDUE'
            when a.release_policy = 'automatic' and greatest(a.consented_at, r.discovered_at) < now() - interval '1 hour' then
              case when r.validation_status = 'server_binary_valid' then 'AUTOMATIC_PUBLICATION_PENDING'
                when v.correlation_id is null then 'VALIDATOR_NOT_STARTED' end
          end as code
        from eligible_apps a
        join lateral (
          select id, validation_status, publication_status, version_code, discovered_at
          from hub.releases
          where app_id = a.id and publication_status in ('unpublished', 'published') and quarantine_code is null
            and validation_status in ('metadata_valid', 'validating_binary', 'server_binary_valid')
          order by version_code desc, publication_status = 'published' desc, discovered_at desc, id desc limit 1
        ) r on r.publication_status = 'unpublished'
        left join lateral (
          select id, correlation_id, status, observed, failure_codes, created_at, started_at
          from hub.release_validation_runs
          where release_id = r.id and stage = 'binary' and provider = 'github_actions_ephemeral'
          order by created_at desc, id desc limit 1
        ) v on true
        left join lateral (
          select status = 'failed' and 'VALIDATOR_TIMEOUT' = any(failure_codes) as timed_out
          from hub.release_validation_runs
          where v.status = 'queued' and release_id = r.id and stage = 'binary' and provider = 'github_actions_ephemeral'
            and (created_at, id) < (v.created_at, v.id)
          order by created_at desc, id desc limit 1
        ) previous on true
      ), sync_issues as (
        select a.slug as app, null::text as version, null::uuid as validation_id,
          case when s.completed_at is null or s.completed_at < now() - interval '2 hours'
            then 'SCHEDULED_SYNC_OVERDUE'
            when s.status = 'failed' and s.error_code <> 'SYNC_INCOMPLETE'
              and coalesce(state.last_success_at, a.consented_at) < now() - interval '2 hours'
              then 'RELEASE_SYNC_FAILED'
          end as code
        from eligible_apps a
        left join hub.sync_state state on state.app_id = a.id
        left join lateral (
          select status, completed_at, error_code
          from hub.sync_jobs
          where app_id = a.id and kind = 'scheduled' and completed_at is not null
          order by created_at desc, id desc limit 1
        ) s on true
        where a.consented_at < now() - interval '2 hours'
      )
      select app, code, version, validation_id from (
        select * from validation_issues union all select * from sync_issues
      ) issues
      where code is not null
      order by (code like 'VALIDATOR_DISPATCH_%') desc, app, code
      limit ${issueLimit + 1}
    `;
    return {
      issues: rows.slice(0, issueLimit).map((row) => ({
        app: row.app, code: row.code, version: row.version, validationId: row.validation_id
      })),
      truncated: rows.length > issueLimit
    };
  }
}

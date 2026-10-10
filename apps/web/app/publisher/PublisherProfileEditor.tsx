"use client";

import type { PublisherProfileDto } from "@hub/api-client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ShareProfileButton } from "../components/ShareProfileButton";
import styles from "./PublisherProfileEditor.module.css";

export interface ProfileResponse {
  profile: PublisherProfileDto;
  publicUrl: string;
  requestId: string;
}

export type ProfileInput = Omit<PublisherProfileDto, "id" | "slug"> & { slug: string | null };

type Draft = Record<"slug" | "displayName" | "bio" | "avatarUrl" | "portfolioUrl" | "website" | "x" | "discord" | "telegram", string>;

function draftOf(profile: PublisherProfileDto): Draft {
  return {
    slug: profile.slug === profile.id ? "" : profile.slug,
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    portfolioUrl: profile.portfolioUrl ?? "",
    website: profile.links.website ?? "",
    x: profile.links.x ?? "",
    discord: profile.links.discord ?? "",
    telegram: profile.links.telegram ?? ""
  };
}

export function PublisherProfileEditor({ hidden, disabled, load, save }: {
  hidden: boolean;
  disabled: boolean;
  load: () => Promise<ProfileResponse>;
  save: (input: ProfileInput) => Promise<ProfileResponse | null>;
}) {
  const [saved, setSaved] = useState<ProfileResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    void load().then((response) => {
      if (generation.current !== request) return;
      setSaved(response);
      setDraft(draftOf(response.profile));
    }).catch((cause: unknown) => {
      if (generation.current === request) setError(cause instanceof Error ? cause.message : "Your profile could not be loaded.");
    }).finally(() => {
      if (generation.current === request) setLoading(false);
    });
    return () => { generation.current += 1; };
  }, [load, retry]);

  const pending = loading || saving || disabled;
  const change = (field: keyof Draft, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setConfirmation(null);
    setError(null);
  };

  async function submit() {
    if (!draft || pending) return;
    const nullable = (value: string) => value.trim() || null;
    const request = generation.current;
    setSaving(true);
    setError(null);
    setConfirmation(null);
    try {
      const response = await save({
        slug: nullable(draft.slug), displayName: nullable(draft.displayName), bio: nullable(draft.bio),
        avatarUrl: nullable(draft.avatarUrl), portfolioUrl: nullable(draft.portfolioUrl),
        links: { website: nullable(draft.website), x: nullable(draft.x), discord: nullable(draft.discord), telegram: nullable(draft.telegram) }
      });
      if (generation.current !== request) return;
      if (response) {
        setSaved(response);
        setDraft(draftOf(response.profile));
        setConfirmation("Your public profile is saved.");
      } else setError("Your changes were not saved. Review the error and try again.");
    } catch (cause: unknown) {
      if (generation.current === request) setError(cause instanceof Error ? cause.message : "Your changes could not be saved.");
    } finally {
      if (generation.current === request) setSaving(false);
    }
  }

  const urlFields = [
    ["avatarUrl", "Avatar image URL", "https://example.com/avatar.png"],
    ["portfolioUrl", "Portfolio", "https://yourportfolio.com"],
    ["website", "Website", "https://yourwebsite.com"],
    ["x", "X", "https://x.com/yourname"],
    ["discord", "Discord", "https://discord.gg/yourcommunity"],
    ["telegram", "Telegram", "https://t.me/yourname"]
  ] as const;

  return (
    <section hidden={hidden} className={`publisher-tab-panel panel ${styles.editor}`} role="tabpanel" aria-labelledby="publisher-profile-tab" aria-busy={pending}>
      <div className="publisher-panel-heading">
        <div><p className="step-label">Your publisher identity</p><h2>My profile</h2><p>A public page for your published apps. Every profile field is optional.</p></div>
      </div>
      {loading ? <p role="status">Loading your profile…</p> : null}
      {!loading && !draft ? <div><p role="alert">{error}</p><button type="button" className="secondary" disabled={pending} onClick={() => setRetry((value) => value + 1)}>Retry loading</button></div> : null}
      {draft ? <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className={styles.form}>
        <div className={styles.identity}>
          <div className={styles.avatar}>
            {draft.avatarUrl && /^https:\/\//i.test(draft.avatarUrl) && brokenAvatar !== draft.avatarUrl
              ? <Image src={draft.avatarUrl} alt="" width={72} height={72} unoptimized onError={() => setBrokenAvatar(draft.avatarUrl)} />
              : <span aria-hidden="true">{(draft.displayName.trim() || "Publisher").slice(0, 1).toUpperCase()}</span>}
          </div>
          <p><strong>{draft.displayName.trim() || "Your publisher profile"}</strong><small>Avatar preview</small></p>
        </div>
        <div className={styles.fields}>
          <label>Display name<input maxLength={120} value={draft.displayName} disabled={pending} onChange={(event) => change("displayName", event.target.value)} autoComplete="name" /></label>
          <label>Custom profile URL<input aria-label="Custom profile URL" maxLength={48} minLength={3} pattern="[a-z][a-z0-9-]{2,47}" autoCapitalize="none" spellCheck={false} value={draft.slug} disabled={pending} onChange={(event) => change("slug", event.target.value)} placeholder="your-studio" aria-describedby="profile-slug-help" /><small id="profile-slug-help">3–48 lowercase letters, numbers or hyphens; start with a letter. Leave empty to use your default URL. Changing it replaces your previous custom address.</small></label>
          <label className={styles.bio}>Bio<textarea aria-label="Bio" aria-describedby="profile-bio-count" maxLength={1000} rows={5} value={draft.bio} disabled={pending} onChange={(event) => change("bio", event.target.value)} /><small id="profile-bio-count">{draft.bio.length}/1000 characters</small></label>
          {urlFields.map(([field, label, placeholder]) => <label key={field}>{label}<input aria-label={label} aria-describedby={`profile-${field}-help`} type="url" inputMode="url" pattern="https://.+" maxLength={2048} placeholder={placeholder} value={draft[field]} disabled={pending} onChange={(event) => change(field, event.target.value)} /><small id={`profile-${field}-help`}>{field === "discord" ? "Optional invitation link." : field === "x" || field === "telegram" ? "Optional public profile link." : "Optional HTTPS URL on a public domain."}</small></label>)}
        </div>
        <div className={styles.actions}><button type="submit" disabled={pending}>{saving ? "Saving…" : "Save profile"}</button>{confirmation ? <span role="status">{confirmation}</span> : null}</div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </form> : null}
      {saved ? <div className={styles.publicLink}><div><strong>Saved public profile</strong><a href={saved.publicUrl} target="_blank" rel="noreferrer">View public profile ↗</a><small>{saved.publicUrl}</small></div><ShareProfileButton url={saved.publicUrl} title={saved.profile.displayName || "Publisher profile on Dapport"} /></div> : null}
    </section>
  );
}

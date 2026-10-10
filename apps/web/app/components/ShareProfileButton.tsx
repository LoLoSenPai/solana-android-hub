"use client";

import { useId, useState } from "react";
import { shareProfileLink } from "./share-profile";
import styles from "./ShareProfileButton.module.css";

export function ShareProfileButton({ url, title }: { url: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const inputId = useId();

  async function share() {
    setBusy(true);
    setMessage("");
    setShowUrl(false);
    try {
      const result = await shareProfileLink(navigator, { title, url });
      if (result === "shared") setMessage("Profile shared.");
      if (result === "copied") setMessage("Profile link copied.");
      if (result === "manual") {
        setShowUrl(true);
        setMessage("Copy the profile link below to share it.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.share}>
      <button className={styles.button} type="button" onClick={() => { void share(); }} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M12 16V3m-5 5 5-5 5 5M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
        </svg>
        {busy ? "Sharing…" : "Share profile"}
      </button>
      <p className={styles.feedback} role="status" aria-live="polite">{message}</p>
      {showUrl && (
        <div className={styles.fallback}>
          <label htmlFor={inputId}>Profile link</label>
          <input id={inputId} type="url" value={url} readOnly autoFocus onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}

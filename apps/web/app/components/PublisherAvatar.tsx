"use client";

import { useState } from "react";

export function PublisherAvatar({ name, url, className }: { name: string; url: string | null; className?: string | undefined }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && failedUrl !== url) {
    return <img className={className} src={url} alt={`${name} avatar`} width={104} height={104} onError={() => setFailedUrl(url)} referrerPolicy="no-referrer" />;
  }
  return <span className={className} role="img" aria-label={`${name} avatar`}>{Array.from(name.trim())[0]?.toUpperCase() ?? "P"}</span>;
}

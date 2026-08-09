"use client";

import { CATALOG_CATEGORIES, GAME_GENRES, type CatalogCategory, type GameGenre } from "@hub/api-client";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount, WalletWithFeatures } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type CompatibleWallet = WalletWithFeatures<StandardConnectFeature & SolanaSignMessageFeature>;
type ReleasePolicy = "automatic" | "manual";

interface DiscoveredApp {
  appMint: string;
  publisherCollectionMint: string | null;
  name: string;
  packageName: string;
  authorityPath: string;
}

interface ClaimedApp extends DiscoveredApp {
  id: string;
  consented?: boolean;
  category?: CatalogCategory;
  genres?: readonly GameGenre[];
}

export function PublisherClient() {
  const registry = useMemo(getWallets, []);
  const [wallets, setWallets] = useState<readonly CompatibleWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<CompatibleWallet | null>(null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [apps, setApps] = useState<readonly DiscoveredApp[]>([]);
  const [claims, setClaims] = useState<Record<string, ClaimedApp>>({});
  const [manualMint, setManualMint] = useState("");
  const [policy, setPolicy] = useState<ReleasePolicy>("manual");
  const [status, setStatus] = useState("Connect a Wallet Standard wallet that supports Ed25519 message signing.");
  const [busy, setBusy] = useState(false);
  const walletPickerTrigger = useRef<HTMLButtonElement>(null);
  const walletPickerDialog = useRef<HTMLElement>(null);
  const firstWalletOption = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => {
      const compatible = registry.get().filter(isCompatibleWallet);
      setWallets(compatible);
    };
    update();
    const offRegister = registry.on("register", update);
    const offUnregister = registry.on("unregister", update);
    return () => { offRegister(); offUnregister(); };
  }, [registry]);

  useEffect(() => {
    if (!walletPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstWalletOption.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWalletPicker();
      if (event.key !== "Tab") return;
      const focusable = walletPickerDialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [walletPickerOpen]);

  const connect = (wallet: CompatibleWallet) => run(async () => {
    closeWalletPicker();
    const connected = await wallet.features[StandardConnect].connect();
    const nextAccount = connected.accounts.find((candidate) => candidate.chains.includes("solana:mainnet")) ?? connected.accounts[0];
    if (!nextAccount) throw new Error("The wallet returned no Solana account.");
    const challenge = await api<{ challengeId: string; message: string }>("/api/v1/auth/challenge", {
      method: "POST",
      body: JSON.stringify({ wallet: nextAccount.address })
    });
    const signature = await signExact(wallet, nextAccount, challenge.message);
    await api("/api/v1/auth/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId: challenge.challengeId, signature })
    });
    const existing = await api<{ apps: readonly {
      id: string;
      appMint: string;
      name: string;
      packageName: string;
      consentStatus: string | null;
      category: CatalogCategory;
      genres: readonly GameGenre[];
    }[] }>("/api/v1/publisher/apps");
    setClaims(Object.fromEntries(existing.apps.map((app) => [app.appMint, {
      id: app.id,
      appMint: app.appMint,
      publisherCollectionMint: null,
      name: app.name,
      packageName: app.packageName,
      authorityPath: "finalized verification",
      consented: app.consentStatus === "active",
      category: app.category,
      genres: app.genres
    }])));
    setActiveWallet(wallet);
    setAccount(nextAccount);
    setStatus(`Authenticated with ${wallet.name} as ${shortAddress(nextAccount.address)}. ${existing.apps.length} claimed app${existing.apps.length === 1 ? "" : "s"} loaded.`);
  });

  const requestConnection = () => {
    const [onlyWallet] = wallets;
    if (wallets.length === 1 && onlyWallet) {
      void connect(onlyWallet);
      return;
    }
    if (wallets.length > 1) {
      setWalletPickerOpen(true);
      return;
    }
    setStatus("No compatible wallet was detected. Install or unlock a Wallet Standard wallet, then retry.");
  };

  function closeWalletPicker() {
    setWalletPickerOpen(false);
    requestAnimationFrame(() => walletPickerTrigger.current?.focus());
  }

  const discover = () => run(async () => {
    const response = await api<{ apps: readonly DiscoveredApp[] }>("/api/v1/publisher/discover-apps");
    setApps(response.apps);
    setStatus(response.apps.length === 0
      ? "No authorized App NFT was found yet. If you just minted one in the Solana Mobile Publisher Portal, wait a few seconds and retry."
      : `Discovered ${response.apps.length} authorized App NFT(s).`);
  });

  const claim = (candidate: DiscoveredApp) => run(async () => {
    const response = await api<{ app: { id: string; appMint: string } }>(`/api/v1/publisher/apps/${candidate.appMint}/claim`, mutation());
    setClaims((current) => ({ ...current, [candidate.appMint]: { ...candidate, id: response.app.id } }));
    setStatus(`${candidate.name} is claimed. Distribution is still disabled until a separate consent message is signed.`);
  });

  const claimMint = async () => {
    const mint = manualMint.trim();
    if (!mint) return;
    await claim({ appMint: mint, publisherCollectionMint: null, name: `App ${shortAddress(mint)}`, packageName: "Pending finalized verification", authorityPath: "finalized verification" });
  };

  const consent = (candidate: ClaimedApp) => run(async () => {
    if (!activeWallet || !account) throw new Error("Reconnect the signing wallet.");
    const challenge = await api<{ challengeId: string; message: string }>(`/api/v1/publisher/apps/${candidate.id}/consent/challenge`, mutation({ releasePolicy: policy }));
    const signature = await signExact(activeWallet, account, challenge.message);
    await api(`/api/v1/publisher/apps/${candidate.id}/consent`, mutation({
      challengeId: challenge.challengeId,
      signature,
      releasePolicy: policy
    }));
    setClaims((current) => ({ ...current, [candidate.appMint]: { ...candidate, consented: true } }));
    setStatus(`Environment-bound ${policy} distribution consent is active for ${candidate.name}.`);
  });

  const sync = (candidate: ClaimedApp) => run(async () => {
    const result = await api<{ releases: readonly { releaseMint: string }[] }>(`/api/v1/publisher/apps/${candidate.id}/sync`, mutation());
    setStatus(`Release synchronization completed with ${result.releases.length} normalized Release NFT(s).`);
  });

  const classify = (candidate: ClaimedApp, category: CatalogCategory, genres: readonly GameGenre[]) => run(async () => {
    await api(`/api/v1/publisher/apps/${candidate.id}/classification`, mutation({ category, genres }));
    setClaims((current) => ({ ...current, [candidate.appMint]: { ...candidate, category, genres } }));
    setStatus(`${candidate.name} will appear in ${categoryLabel(category)}${genres.length ? ` · ${genres.map(genreLabel).join(", ")}` : ""}.`);
  });

  function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    return action().catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Publisher operation failed."))
      .finally(() => setBusy(false));
  }

  const claimList = Object.values(claims);
  return (
    <section className="publisher-workspace" aria-busy={busy}>
      <details className="panel publisher-first-app">
        <summary>Publishing your first App NFT?</summary>
        <p>Use the official Solana Mobile Publisher Portal, then return here with the same publisher wallet. A generic NFT or ownership alone cannot qualify as publisher authority.</p>
        <div className="publisher-resource-links">
          <a href="https://publish.solanamobile.com" target="_blank" rel="noreferrer">Open Publisher Portal</a>
          <a href="https://docs.solanamobile.com/dapp-store/submit-new-app" target="_blank" rel="noreferrer">Read the official walkthrough</a>
        </div>
      </details>
      <div className="panel">
        <p className="step-label">1 · Publisher authentication</p>
        <div className="publisher-auth-row">
          <button
            ref={walletPickerTrigger}
            type="button"
            className="publisher-connect-button"
            onClick={requestConnection}
            disabled={busy || account !== null || wallets.length === 0}
          >
            {account ? "Authenticated" : "Connect and sign in"}
          </button>
          <div className="publisher-auth-copy">
            <strong>{account && activeWallet ? activeWallet.name : "Choose your wallet in the next step"}</strong>
            <span>{account ? shortAddress(account.address) : "One-time authentication message · no transaction"}</span>
          </div>
        </div>
        {wallets.length === 0 && <p className="wallet-unavailable-note">No compatible wallet detected. Install or unlock Phantom, Solflare, Backpack, or another Wallet Standard wallet.</p>}
      </div>

      {walletPickerOpen && (
        <div
          className="wallet-picker-backdrop"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeWalletPicker(); }}
        >
          <section ref={walletPickerDialog} className="wallet-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="wallet-picker-title">
            <div className="wallet-picker-heading">
              <div>
                <p className="step-label">Wallet connection</p>
                <h2 id="wallet-picker-title">Choose your wallet</h2>
                <p>You will review and sign a one-time authentication message. This does not submit a transaction.</p>
              </div>
              <button type="button" className="wallet-picker-cancel secondary" onClick={closeWalletPicker}>Cancel</button>
            </div>
            <div className="wallet-option-list">
              {wallets.map((wallet, index) => (
                <button
                  key={wallet.name}
                  ref={index === 0 ? firstWalletOption : undefined}
                  type="button"
                  className="wallet-option secondary"
                  onClick={() => void connect(wallet)}
                  disabled={busy}
                >
                  <span className="wallet-option-identity">
                    <Image className="wallet-option-icon" src={wallet.icon} width={42} height={42} alt="" unoptimized />
                    <span><strong>{wallet.name}</strong><small>Wallet Standard · Ed25519 signing</small></span>
                  </span>
                  <span className="wallet-option-action">Continue</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="panel">
        <p className="step-label">2 · Finalized App authority</p>
        <div className="control-row">
          <button type="button" onClick={() => void discover()} disabled={busy || !account}>Discover authorized Apps</button>
          <span className="muted">Ownership alone is never accepted.</span>
        </div>
        <div className="control-row">
          <input aria-label="App mint" placeholder="Or enter an App mint" value={manualMint} onChange={(event) => setManualMint(event.target.value)} />
          <button type="button" className="secondary" onClick={() => void claimMint()} disabled={busy || !account || manualMint.trim().length < 32}>Verify and claim</button>
        </div>
        <div className="operation-list">
          {apps.map((candidate) => (
            <div key={candidate.appMint} className="operation-row">
              <div><strong>{candidate.name}</strong><small>{candidate.packageName} · {candidate.authorityPath.replaceAll("_", " ")}</small></div>
              <button type="button" className="secondary" onClick={() => void claim(candidate)} disabled={busy || Boolean(claims[candidate.appMint])}>Claim</button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="step-label">3 · Separate distribution consent</p>
        <label>Release policy
          <select value={policy} onChange={(event) => setPolicy(event.target.value as ReleasePolicy)} disabled={busy}>
            <option value="manual">Manual publication</option>
            <option value="automatic">Automatic after all gates</option>
          </select>
        </label>
        <div className="operation-list">
          {claimList.map((candidate) => (
            <div key={candidate.id} className="operation-row">
              <div><strong>{candidate.name}</strong><small>{candidate.consented ? "Consent active in this environment" : "Claimed; distribution disabled"}</small></div>
              <div className="control-row compact">
                <button type="button" className="secondary" onClick={() => void consent(candidate)} disabled={busy || candidate.consented}>Review and sign consent</button>
                <button type="button" className="secondary" onClick={() => void sync(candidate)} disabled={busy || !candidate.consented}>Sync Releases</button>
              </div>
            </div>
          ))}
          {claimList.length === 0 && <p className="muted">Claim an App before consent can be created.</p>}
        </div>
      </div>
      <div className="panel">
        <p className="step-label">4 · Storefront classification</p>
        <p className="muted">The NFT standard identifies a dApp, but does not carry the consumer category used by the store. Choose how people should discover your app here.</p>
        <div className="operation-list">
          {claimList.map((candidate) => (
            <ClassificationEditor
              key={candidate.id}
              app={candidate}
              disabled={busy}
              onSave={(category, genres) => void classify(candidate, category, genres)}
            />
          ))}
          {claimList.length === 0 && <p className="muted">Claim an App before choosing its category.</p>}
        </div>
      </div>
      <p className="status-line" role="status">{busy ? "Waiting for verified operation…" : status}</p>
    </section>
  );
}

function ClassificationEditor({
  app,
  disabled,
  onSave
}: {
  app: ClaimedApp;
  disabled: boolean;
  onSave: (category: CatalogCategory, genres: readonly GameGenre[]) => void;
}) {
  const [category, setCategory] = useState<CatalogCategory>(app.category ?? "other");
  const [genres, setGenres] = useState<readonly GameGenre[]>(app.genres ?? []);
  const toggleGenre = (genre: GameGenre) => setGenres((current) => current.includes(genre)
    ? current.filter((item) => item !== genre)
    : current.length < 4 ? [...current, genre] : current);

  return (
    <div className="classification-editor">
      <div><strong>{app.name}</strong><small>{app.packageName}</small></div>
      <label>Primary category
        <select
          value={category}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value as CatalogCategory;
            setCategory(next);
            if (next !== "games") setGenres([]);
          }}
        >
          {CATALOG_CATEGORIES.map((item) => <option value={item} key={item}>{categoryLabel(item)}</option>)}
        </select>
      </label>
      {category === "games" ? (
        <fieldset className="genre-picker">
          <legend>Game genres · choose up to 4</legend>
          <div>
            {GAME_GENRES.map((genre) => (
              <button
                type="button"
                className={genres.includes(genre) ? "is-selected" : "secondary"}
                aria-pressed={genres.includes(genre)}
                disabled={disabled || (!genres.includes(genre) && genres.length >= 4)}
                onClick={() => toggleGenre(genre)}
                key={genre}
              >{genreLabel(genre)}</button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <button type="button" onClick={() => onSave(category, genres)} disabled={disabled}>Save storefront</button>
    </div>
  );
}

function isCompatibleWallet(wallet: Wallet): wallet is CompatibleWallet {
  return StandardConnect in wallet.features && SolanaSignMessage in wallet.features;
}

async function signExact(wallet: CompatibleWallet, account: WalletAccount, message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const [output] = await wallet.features[SolanaSignMessage].signMessage({ account, message: bytes });
  if (!output || output.signature.length !== 64 || !equalBytes(output.signedMessage, bytes)) {
    throw new Error("Wallet must return an exact Ed25519 signature over the canonical message bytes.");
  }
  return base64Url(output.signature);
}

function mutation(body?: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "x-csrf-token": readCookie("hub_csrf") },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  };
}

async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init.headers },
    cache: "no-store"
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error
      ? String(body.error.message) : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

function readCookie(name: string): string {
  const entry = document.cookie.split("; ").find((value) => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function categoryLabel(category: CatalogCategory): string {
  const labels: Record<CatalogCategory, string> = {
    "ai-agents": "AI & agents",
    "content-streaming": "Content & streaming",
    defi: "DeFi & trading",
    depin: "DePIN",
    games: "Games",
    lifestyle: "Lifestyle",
    nfts: "NFTs",
    "privacy-security": "Privacy & security",
    productivity: "Productivity",
    "social-identity": "Social & identity",
    wallets: "Wallets",
    other: "Other"
  };
  return labels[category];
}

function genreLabel(genre: GameGenre): string {
  return genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

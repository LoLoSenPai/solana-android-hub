"use client";

import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount, WalletWithFeatures } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { useEffect, useMemo, useState } from "react";

type CompatibleWallet = WalletWithFeatures<StandardConnectFeature & SolanaSignMessageFeature>;
type ReleasePolicy = "automatic" | "manual";

interface DiscoveredApp {
  appMint: string;
  publisherMint: string;
  name: string;
  packageName: string;
  authorityPath: string;
}

interface ClaimedApp extends DiscoveredApp {
  id: string;
  consented?: boolean;
}

export function PublisherClient() {
  const registry = useMemo(getWallets, []);
  const [wallets, setWallets] = useState<readonly CompatibleWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [apps, setApps] = useState<readonly DiscoveredApp[]>([]);
  const [claims, setClaims] = useState<Record<string, ClaimedApp>>({});
  const [manualMint, setManualMint] = useState("");
  const [policy, setPolicy] = useState<ReleasePolicy>("manual");
  const [status, setStatus] = useState("Connect a Wallet Standard wallet that supports Ed25519 message signing.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => {
      const compatible = registry.get().filter(isCompatibleWallet);
      setWallets(compatible);
      setSelectedWallet((current) => current || compatible[0]?.name || "");
    };
    update();
    const offRegister = registry.on("register", update);
    const offUnregister = registry.on("unregister", update);
    return () => { offRegister(); offUnregister(); };
  }, [registry]);

  const connect = () => run(async () => {
    const wallet = wallets.find((candidate) => candidate.name === selectedWallet);
    if (!wallet) throw new Error("No compatible Wallet Standard wallet is available.");
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
    setAccount(nextAccount);
    setStatus(`Authenticated as ${shortAddress(nextAccount.address)}. Authentication is not distribution consent.`);
  });

  const discover = () => run(async () => {
    const response = await api<{ apps: readonly DiscoveredApp[] }>("/api/v1/publisher/discover-apps");
    setApps(response.apps);
    setStatus(response.apps.length === 0 ? "No currently authorized App NFTs were discovered." : `Discovered ${response.apps.length} authorized App NFT(s).`);
  });

  const claim = (candidate: DiscoveredApp) => run(async () => {
    const response = await api<{ app: { id: string; appMint: string } }>(`/api/v1/publisher/apps/${candidate.appMint}/claim`, mutation());
    setClaims((current) => ({ ...current, [candidate.appMint]: { ...candidate, id: response.app.id } }));
    setStatus(`${candidate.name} is claimed. Distribution is still disabled until a separate consent message is signed.`);
  });

  const claimMint = async () => {
    const mint = manualMint.trim();
    if (!mint) return;
    await claim({ appMint: mint, publisherMint: "", name: `App ${shortAddress(mint)}`, packageName: "Pending finalized verification", authorityPath: "finalized verification" });
  };

  const consent = (candidate: ClaimedApp) => run(async () => {
    const wallet = wallets.find((item) => item.name === selectedWallet);
    if (!wallet || !account) throw new Error("Reconnect the signing wallet.");
    const challenge = await api<{ challengeId: string; message: string }>(`/api/v1/publisher/apps/${candidate.id}/consent/challenge`, mutation({ releasePolicy: policy }));
    const signature = await signExact(wallet, account, challenge.message);
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

  function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    return action().catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Publisher operation failed."))
      .finally(() => setBusy(false));
  }

  const claimList = Object.values(claims);
  return (
    <section className="publisher-workspace" aria-busy={busy}>
      <div className="panel">
        <p className="step-label">1 · Publisher authentication</p>
        <div className="control-row">
          <select aria-label="Wallet" value={selectedWallet} onChange={(event) => setSelectedWallet(event.target.value)} disabled={busy || account !== null}>
            {wallets.length === 0 && <option value="">No compatible wallet found</option>}
            {wallets.map((wallet) => <option key={wallet.name}>{wallet.name}</option>)}
          </select>
          <button type="button" onClick={() => void connect()} disabled={busy || account !== null || !selectedWallet}>{account ? "Authenticated" : "Connect and sign in"}</button>
        </div>
      </div>

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
      <p className="status-line" role="status">{busy ? "Waiting for verified operation…" : status}</p>
    </section>
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

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

"use client";

import { CATALOG_CATEGORIES, GAME_GENRES, type CatalogCategory, type GameGenre } from "@hub/api-client";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount, WalletWithFeatures } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { AppWindow } from "@phosphor-icons/react/dist/csr/AppWindow";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CloudArrowUp } from "@phosphor-icons/react/dist/csr/CloudArrowUp";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { ListChecks } from "@phosphor-icons/react/dist/csr/ListChecks";
import { PlusCircle } from "@phosphor-icons/react/dist/csr/PlusCircle";
import { Storefront } from "@phosphor-icons/react/dist/csr/Storefront";
import { TrashSimple } from "@phosphor-icons/react/dist/csr/TrashSimple";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type CompatibleWallet = WalletWithFeatures<StandardConnectFeature & SolanaSignMessageFeature>;
type ReleasePolicy = "automatic" | "manual";
type WorkspaceTab = "setup" | "apps";

interface DiscoveredApp {
  appMint: string;
  publisherCollectionMint: string | null;
  name: string;
  packageName: string;
  authorityPath: string;
}

interface ClaimedApp extends DiscoveredApp {
  id: string;
  slug: string;
  consented?: boolean;
  consentStatus?: string | null;
  distributionEnabled?: boolean;
  releasePolicy?: ReleasePolicy;
  releaseCount?: number;
  category?: CatalogCategory;
  genres?: readonly GameGenre[];
}

interface PublisherRelease {
  id: string;
  release_mint: string;
  version_name: string;
  version_code: string;
  validation_status: "discovered" | "metadata_valid" | "validating_binary" | "server_binary_valid" | "quarantined";
  publication_status: "preview" | "unpublished" | "published" | "ignored" | "withdrawn";
  quarantine_code: string | null;
  validation_failure_codes?: readonly string[];
}

export function PublisherClient({ termsVersion }: { termsVersion: string }) {
  const registry = useMemo(getWallets, []);
  const [wallets, setWallets] = useState<readonly CompatibleWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<CompatibleWallet | null>(null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [apps, setApps] = useState<readonly DiscoveredApp[]>([]);
  const [claims, setClaims] = useState<Record<string, ClaimedApp>>({});
  const [releases, setReleases] = useState<Record<string, readonly PublisherRelease[]>>({});
  const [manualMint, setManualMint] = useState("");
  const [policy, setPolicy] = useState<ReleasePolicy>("manual");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("setup");
  const [revokingAppMint, setRevokingAppMint] = useState<string | null>(null);
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

  const validatingAppIds = useMemo(() => Object.entries(releases)
    .filter(([, appReleases]) => appReleases.some((release) => release.validation_status === "validating_binary"))
    .map(([appId]) => appId)
    .sort()
    .join(","), [releases]);

  useEffect(() => {
    if (!validatingAppIds) return;
    const appIds = validatingAppIds.split(",");
    const timer = window.setInterval(() => {
      void Promise.all(appIds.map(async (appId) => {
        const response = await api<{ releases: readonly PublisherRelease[] }>(`/api/v1/publisher/apps/${appId}/releases`);
        return [appId, response.releases] as const;
      })).then((entries) => {
        setReleases((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }).catch(() => undefined);
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [validatingAppIds]);

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
      slug: string;
      name: string;
      packageName: string;
      distributionEnabled: boolean;
      releasePolicy: ReleasePolicy;
      releaseCount: string;
      consentStatus: string | null;
      category: CatalogCategory;
      genres: readonly GameGenre[];
    }[] }>("/api/v1/publisher/apps");
    setClaims(Object.fromEntries(existing.apps.map((app) => [app.appMint, {
      id: app.id,
      appMint: app.appMint,
      slug: app.slug,
      publisherCollectionMint: null,
      name: app.name,
      packageName: app.packageName,
      authorityPath: "finalized verification",
      consented: app.consentStatus === "active",
      consentStatus: app.consentStatus,
      distributionEnabled: app.distributionEnabled,
      releasePolicy: app.releasePolicy,
      releaseCount: Number(app.releaseCount),
      category: app.category,
      genres: app.genres
    }])));
    const releaseEntries = await Promise.all(existing.apps.map(async (app) => {
      const response = await api<{ releases: readonly PublisherRelease[] }>(`/api/v1/publisher/apps/${app.id}/releases`);
      return [app.id, response.releases] as const;
    }));
    setReleases(Object.fromEntries(releaseEntries));
    setActiveWallet(wallet);
    setAccount(nextAccount);
    setWorkspaceTab(existing.apps.length > 0 ? "apps" : "setup");
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
    setClaims((current) => ({ ...current, [candidate.appMint]: {
      ...candidate,
      id: response.app.id,
      slug: "",
      consentStatus: null,
      distributionEnabled: false,
      releasePolicy: policy,
      releaseCount: 0
    } }));
    setStatus(`${candidate.name} is claimed. Distribution is still disabled until a separate consent message is signed.`);
  });

  const claimMint = async () => {
    const mint = manualMint.trim();
    if (!mint) return;
    await claim({ appMint: mint, publisherCollectionMint: null, name: `App ${shortAddress(mint)}`, packageName: "Pending finalized verification", authorityPath: "finalized verification" });
  };

  const consent = (candidate: ClaimedApp, consentPolicy: ReleasePolicy = policy) => run(async () => {
    if (!activeWallet || !account) throw new Error("Reconnect the signing wallet.");
    const wasRevoked = candidate.consentStatus === "revoked";
    const challenge = await api<{ challengeId: string; message: string }>(`/api/v1/publisher/apps/${candidate.id}/consent/challenge`, mutation({ releasePolicy: consentPolicy }));
    const signature = await signExact(activeWallet, account, challenge.message);
    await api(`/api/v1/publisher/apps/${candidate.id}/consent`, mutation({
      challengeId: challenge.challengeId,
      signature,
      releasePolicy: consentPolicy
    }));
    setClaims((current) => ({ ...current, [candidate.appMint]: {
      ...candidate,
      consented: true,
      consentStatus: "active",
      distributionEnabled: true,
      releasePolicy: consentPolicy
    } }));
    await refreshReleases(candidate.id);
    setStatus(wasRevoked
      ? `${candidate.name} is available on Dapport again.`
      : `Environment-bound ${consentPolicy} distribution consent is active for ${candidate.name}.`);
  });

  const sync = (candidate: ClaimedApp) => run(async () => {
    const result = await api<{ releases: readonly { releaseMint: string }[] }>(`/api/v1/publisher/apps/${candidate.id}/sync`, mutation());
    await refreshReleases(candidate.id);
    setStatus(`Release synchronization completed with ${result.releases.length} normalized Release NFT(s).`);
  });

  const validateOrPublish = (candidate: ClaimedApp, release: PublisherRelease) => run(async () => {
    const result = await api<{ status: "validating_binary" | "published" }>(`/api/v1/publisher/releases/${release.id}/publish`, mutation());
    await refreshReleases(candidate.id);
    setStatus(result.status === "published"
      ? `${candidate.name} ${release.version_name} is published.`
      : `Dapport is checking ${candidate.name} ${release.version_name}. This page updates automatically.`);
  });

  const revoke = (candidate: ClaimedApp) => run(async () => {
    await api(`/api/v1/publisher/apps/${candidate.id}/revoke`, mutation());
    setClaims((current) => ({ ...current, [candidate.appMint]: {
      ...candidate,
      consented: false,
      consentStatus: "revoked",
      distributionEnabled: false
    } }));
    setReleases((current) => ({
      ...current,
      [candidate.id]: (current[candidate.id] ?? []).map((release) => ({ ...release, publication_status: "withdrawn" }))
    }));
    setRevokingAppMint(null);
    setStatus(`${candidate.name} has been removed from Dapport. Existing installations are not affected.`);
  });

  async function refreshReleases(appId: string): Promise<void> {
    const response = await api<{ releases: readonly PublisherRelease[] }>(`/api/v1/publisher/apps/${appId}/releases`);
    setReleases((current) => ({ ...current, [appId]: response.releases }));
  }

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
  const activeClaims = claimList.filter((candidate) => candidate.consentStatus !== "revoked");
  const publishedCount = claimList.filter((candidate) => (releases[candidate.id] ?? [])
    .some((release) => release.publication_status === "published")).length;
  const progressSteps = [
    { label: "Wallet connected", complete: Boolean(account), icon: CheckCircle },
    { label: "App claimed", complete: claimList.length > 0, icon: AppWindow },
    { label: "Distribution allowed", complete: activeClaims.some((candidate) => candidate.consented), icon: ListChecks },
    { label: "Live in catalogue", complete: publishedCount > 0, icon: Storefront }
  ];
  const currentProgressIndex = progressSteps.findIndex((step) => !step.complete);
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

      {account ? (
        <div className="publisher-tabs" role="tablist" aria-label="Publisher workspace">
          <button type="button" role="tab" aria-selected={workspaceTab === "setup"} onClick={() => setWorkspaceTab("setup")}>
            <PlusCircle aria-hidden="true" /> Add an app
          </button>
          <button type="button" role="tab" aria-selected={workspaceTab === "apps"} onClick={() => setWorkspaceTab("apps")}>
            <AppWindow aria-hidden="true" /> My apps <span>{claimList.length}</span>
          </button>
        </div>
      ) : null}

      {account && workspaceTab === "setup" ? (
        <div className="publisher-tab-panel" role="tabpanel">
          <section className="publisher-journey" aria-labelledby="publisher-journey-title">
            <div>
              <p className="step-label">Your publication path</p>
              <h2 id="publisher-journey-title">From App NFT to Android catalogue.</h2>
            </div>
            <ol>
              {progressSteps.map((step, index) => {
                const Icon = step.icon;
                const state = step.complete ? "complete" : index === currentProgressIndex ? "current" : "upcoming";
                return (
                  <li className={state} key={step.label}>
                    <Icon aria-hidden="true" />
                    <span><small>Step {index + 1}</small><strong>{step.label}</strong></span>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="panel publisher-step-panel">
            <div className="publisher-step-heading">
              <span>01</span><div><p className="step-label">Find your app</p><h2>Discover the App NFTs this wallet can publish.</h2></div>
            </div>
            <p className="muted">Dapport checks the publishing authority recorded on Solana. Holding an NFT alone is not enough.</p>
            <div className="control-row">
              <button type="button" onClick={() => void discover()} disabled={busy}>Discover my apps</button>
            </div>
            <div className="control-row">
              <input aria-label="App mint" placeholder="Or paste an App mint" value={manualMint} onChange={(event) => setManualMint(event.target.value)} />
              <button type="button" className="secondary" onClick={() => void claimMint()} disabled={busy || manualMint.trim().length < 32}>Verify and add</button>
            </div>
            <div className="operation-list">
              {apps.map((candidate) => (
                <div key={candidate.appMint} className="operation-row">
                  <div><strong>{candidate.name}</strong><small>{candidate.packageName}</small></div>
                  <button type="button" className="secondary" onClick={() => void claim(candidate)} disabled={busy || Boolean(claims[candidate.appMint])}>
                    {claims[candidate.appMint] ? "Added" : "Add to Dapport"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel publisher-step-panel">
            <div className="publisher-step-heading">
              <span>02</span><div><p className="step-label">Allow distribution</p><h2>Choose how releases reach Dapport.</h2></div>
            </div>
            <p className="muted">Review the <a href="/publisher/distribution-terms" target="_blank" rel="noreferrer">distribution terms</a>, then sign a separate consent message. No transaction is sent.</p>
            <small className="publisher-terms-version">Current terms: {termsVersion}</small>
            <label>Release policy
              <select value={policy} onChange={(event) => setPolicy(event.target.value as ReleasePolicy)} disabled={busy}>
                <option value="manual">I publish each release manually</option>
                <option value="automatic">Publish automatically after checks pass</option>
              </select>
            </label>
            <div className="operation-list">
              {claimList.map((candidate) => (
                <div key={candidate.id} className="operation-row">
                  <div><strong>{candidate.name}</strong><small>{candidate.consented ? "Distribution allowed" : candidate.consentStatus === "revoked" ? "Removed — sign again to restore it" : "Waiting for your consent"}</small></div>
                  <div className="control-row compact">
                    <button type="button" className="secondary" onClick={() => void consent(candidate)} disabled={busy || candidate.consented}>{candidate.consentStatus === "revoked" ? "Review and reauthorize" : "Review and sign"}</button>
                    <button type="button" className="secondary" onClick={() => void sync(candidate)} disabled={busy || !candidate.consented}>Find releases</button>
                  </div>
                </div>
              ))}
              {claimList.length === 0 && <p className="muted">Add an app first, then its consent controls will appear here.</p>}
            </div>
          </div>

          <div className="panel publisher-step-panel">
            <div className="publisher-step-heading">
              <span>03</span><div><p className="step-label">Store appearance</p><h2>Help people find the right app.</h2></div>
            </div>
            <p className="muted">Choose the consumer category used by Dapport. Games can include up to four useful genre filters.</p>
            <div className="operation-list">
              {claimList.map((candidate) => (
                <ClassificationEditor key={candidate.id} app={candidate} disabled={busy} onSave={(category, genres) => void classify(candidate, category, genres)} />
              ))}
              {claimList.length === 0 && <p className="muted">Your storefront controls appear after an app is added.</p>}
            </div>
          </div>

          <div className="panel publisher-step-panel">
            <div className="publisher-step-heading">
              <span>04</span><div><p className="step-label">Check and publish</p><h2>Confirm the downloadable file, then go live.</h2></div>
            </div>
            <p className="muted">Dapport downloads the APK referenced by the Release NFT and checks that its hash, package, version and signing certificate still match what was published on-chain.</p>
            <div className="operation-list">
              {activeClaims.flatMap((candidate) => (releases[candidate.id] ?? []).map((release) => (
                <div className="operation-row" key={release.id}>
                  <div><strong>{candidate.name} {release.version_name}</strong><small>{releaseStatusLabel(release)}</small></div>
                  <div className="control-row compact">
                    {release.validation_status === "validating_binary" ? <span className="validation-live"><i />Updating automatically</span> : null}
                    {releaseActionLabel(release) ? (
                      <button type="button" onClick={() => void validateOrPublish(candidate, release)} disabled={busy || Boolean(release.quarantine_code)}>{releaseActionLabel(release)}</button>
                    ) : null}
                  </div>
                </div>
              )))}
              {activeClaims.length > 0 && activeClaims.every((candidate) => (releases[candidate.id] ?? []).length === 0) ? <p className="muted">Use “Find releases” above to load the Release NFTs for your app.</p> : null}
              {activeClaims.length === 0 ? <p className="muted">Add an app and allow distribution before publishing a release.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {account && workspaceTab === "apps" ? (
        <section className="publisher-tab-panel publisher-apps-panel" role="tabpanel" aria-labelledby="publisher-apps-title">
          <div className="publisher-panel-heading">
            <div><p className="step-label">Your catalogue</p><h2 id="publisher-apps-title">My apps</h2><p>See what is live, continue an incomplete setup, or remove an app from Dapport.</p></div>
            <button type="button" onClick={() => setWorkspaceTab("setup")}><PlusCircle aria-hidden="true" /> Add another app</button>
          </div>
          <div className="publisher-app-grid">
            {claimList.map((candidate) => {
              const appReleases = releases[candidate.id] ?? [];
              const latest = appReleases[0];
              const liveRelease = appReleases.find((release) => release.publication_status === "published");
              const revoked = candidate.consentStatus === "revoked";
              return (
                <article className="publisher-app-card" key={candidate.id}>
                  <header>
                    <div className="publisher-app-symbol"><AppWindow aria-hidden="true" /></div>
                    <div><span className={`publisher-app-state ${liveRelease ? "live" : revoked ? "revoked" : "pending"}`}>{liveRelease ? "Live" : revoked ? "Removed" : "Setup in progress"}</span><h3>{candidate.name}</h3><p>{candidate.packageName}</p></div>
                  </header>
                  <dl>
                    <div><dt>Latest release</dt><dd>{latest ? `v${latest.version_name}` : "Not synced"}</dd></div>
                    <div><dt>Category</dt><dd>{categoryLabel(candidate.category ?? "other")}</dd></div>
                    <div><dt>Publication</dt><dd>{latest ? releaseStatusLabel(latest) : "No release found"}</dd></div>
                    <div><dt>Release policy</dt><dd>{candidate.releasePolicy === "automatic" ? "Automatic" : "Manual"}</dd></div>
                  </dl>
                  <div className="publisher-app-actions">
                    {revoked ? (
                      <button type="button" onClick={() => void consent(candidate, candidate.releasePolicy ?? policy)} disabled={busy}><CheckCircle aria-hidden="true" /> Reauthorize app</button>
                    ) : (
                      <button type="button" className="secondary" onClick={() => setWorkspaceTab("setup")}><GearSix aria-hidden="true" /> Manage setup</button>
                    )}
                    {liveRelease && candidate.slug ? <Link href={`/apps/${candidate.slug}`}>View store page <ArrowSquareOut aria-hidden="true" /></Link> : null}
                    {!revoked && candidate.consented ? <button type="button" className="danger-quiet" onClick={() => setRevokingAppMint(candidate.appMint)}><TrashSimple aria-hidden="true" /> Remove from Dapport</button> : null}
                  </div>
                  {revokingAppMint === candidate.appMint ? (
                    <div className="publisher-revoke-confirm">
                      <strong>Remove {candidate.name} from Dapport?</strong>
                      <p>Its catalogue listing and future Dapport updates stop immediately. Apps already installed on phones are not removed.</p>
                      <div className="control-row compact">
                        <button type="button" className="danger" disabled={busy} onClick={() => void revoke(candidate)} autoFocus>Confirm removal</button>
                        <button type="button" className="secondary" onClick={() => setRevokingAppMint(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {claimList.length === 0 ? (
              <div className="publisher-empty-apps"><CloudArrowUp aria-hidden="true" /><h3>No apps here yet.</h3><p>Start with the App NFT published from your wallet.</p><button type="button" onClick={() => setWorkspaceTab("setup")}>Add your first app</button></div>
            ) : null}
          </div>
        </section>
      ) : null}
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

function releaseActionLabel(release: PublisherRelease): string | null {
  if (release.quarantine_code || release.publication_status === "published" || release.publication_status === "withdrawn" || release.publication_status === "ignored") return null;
  if (release.validation_status === "metadata_valid") return "Run Dapport checks";
  if (release.validation_status === "server_binary_valid") return "Publish release";
  return null;
}

function releaseStatusLabel(release: PublisherRelease): string {
  if (release.quarantine_code) return `Blocked · ${release.quarantine_code.replaceAll("_", " ")}`;
  if (release.publication_status === "withdrawn") return "Removed from the catalogue";
  if (release.publication_status === "ignored") return "Ignored by publisher";
  if (release.publication_status === "published") return "Published in the production catalogue";
  if (release.validation_status === "validating_binary") return "Dapport checks in progress";
  if (release.validation_status === "server_binary_valid") return "Dapport checks passed · ready to publish";
  if (release.validation_status === "metadata_valid" && release.validation_failure_codes?.length) {
    return `Checks need attention · ${validationFailureLabel(release.validation_failure_codes[0] ?? "VALIDATION_FAILED")}`;
  }
  if (release.validation_status === "metadata_valid") return "Ready for Dapport checks";
  return `${release.validation_status.replaceAll("_", " ")} · ${release.publication_status.replaceAll("_", " ")}`;
}

function validationFailureLabel(code: string): string {
  const labels: Record<string, string> = {
    APK_ADDRESS_UNSAFE: "download address is not public",
    APK_CERTIFICATE_MISMATCH: "signing certificate does not match",
    APK_DOWNLOAD_HTTP: "APK could not be downloaded",
    APK_HASH_MISMATCH: "file hash does not match",
    APK_MANIFEST_INVALID: "Android manifest could not be read",
    APK_PACKAGE_MISMATCH: "package name does not match",
    APK_PERMISSIONS_MISMATCH: "permissions do not match",
    APK_SIGNATURE_INVALID: "APK signature is invalid",
    APK_SIZE_MISMATCH: "file size does not match",
    APK_VERSION_MISMATCH: "version does not match",
    MANIFEST_INVALID: "release check could not start",
    VALIDATOR_INTERNAL_ERROR: "temporary validation error"
  };
  return labels[code] ?? code.toLowerCase().replaceAll("_", " ");
}

function genreLabel(genre: GameGenre): string {
  return genre === "rpg" ? "RPG" : `${genre.charAt(0).toUpperCase()}${genre.slice(1)}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

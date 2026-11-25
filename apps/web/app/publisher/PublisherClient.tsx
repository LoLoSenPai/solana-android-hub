"use client";

import { CATALOG_CATEGORIES, EMPTY_PUBLISHER_LINKS, GAME_GENRES, type CatalogCategory, type GameGenre, type PublisherLinks } from "@hub/api-client";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount, WalletWithFeatures } from "@wallet-standard/base";
import { StandardConnect, StandardEvents, type StandardConnectFeature, type StandardEventsFeature } from "@wallet-standard/features";
import { AppWindow } from "@phosphor-icons/react/dist/csr/AppWindow";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { Cube } from "@phosphor-icons/react/dist/csr/Cube";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Stack } from "@phosphor-icons/react/dist/csr/Stack";
import { TrashSimple } from "@phosphor-icons/react/dist/csr/TrashSimple";
import { User } from "@phosphor-icons/react/dist/csr/User";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PublisherAvatar } from "../components/PublisherAvatar";
import { PublisherLanding } from "./PublisherLanding";
import { PublisherProfileEditor, type ProfileInput, type ProfileResponse } from "./PublisherProfileEditor";
import styles from "./PublisherStudio.module.css";

type CompatibleWallet = WalletWithFeatures<StandardConnectFeature & SolanaSignMessageFeature>;
type ReleasePolicy = "automatic" | "manual";
type WorkspaceView = "setup" | "apps" | "manage" | "profile";
type NoticeTone = "success" | "error" | "info";

interface DiscoveredApp {
  appMint: string;
  name: string;
  packageName: string;
  iconUrl: string | null;
}

interface ClaimedApp extends DiscoveredApp {
  id: string;
  slug: string;
  claimStatus: string;
  consented?: boolean;
  consentStatus?: string | null;
  distributionEnabled?: boolean;
  releasePolicy?: ReleasePolicy;
  releaseCount?: number;
  category?: CatalogCategory;
  genres?: readonly GameGenre[];
  publisherLinks?: PublisherLinks;
}

interface PublisherRelease {
  id: string;
  release_mint: string;
  version_name: string;
  version_code: string;
  validation_status: "discovered" | "metadata_valid" | "validating_binary" | "server_binary_valid" | "quarantined";
  publication_status: "preview" | "unpublished" | "published" | "ignored" | "withdrawn";
  quarantine_code: string | null;
  validation_run_status?: string | null;
  validation_failure_codes?: readonly string[];
  created_at: string;
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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("apps");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [selectedAppMint, setSelectedAppMint] = useState<string | null>(null);
  const [revokingAppMint, setRevokingAppMint] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [busy, setBusy] = useState(false);
  const walletPickerTrigger = useRef<HTMLButtonElement>(null);
  const restoreWalletFocus = useRef(false);
  const walletPickerDialog = useRef<HTMLElement>(null);
  const firstWalletOption = useRef<HTMLButtonElement>(null);
  const authenticationGeneration = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (account) headingRef.current?.focus();
  }, [account, workspaceView, selectedAppMint]);

  useEffect(() => {
    if (busy || walletPickerOpen || !restoreWalletFocus.current) return;
    restoreWalletFocus.current = false;
    if (!account) walletPickerTrigger.current?.focus();
  }, [account, busy, walletPickerOpen]);

  useEffect(() => {
    if (!activeWallet || !account || !(StandardEvents in activeWallet.features)) return;
    const events = (activeWallet as WalletWithFeatures<StandardEventsFeature & StandardConnectFeature & SolanaSignMessageFeature>).features[StandardEvents];
    return events.on("change", (properties) => {
      if (!properties.accounts) return;
      const nextAccount = properties.accounts.find((candidate) => candidate.chains.includes("solana:mainnet")) ?? properties.accounts[0];
      if (nextAccount?.address === account.address) return;
      authenticationGeneration.current += 1;
      setAccount(null);
      setActiveWallet(null);
      setApps([]);
      setClaims({});
      setReleases({});
      setProfile(null);
      setSelectedAppMint(null);
      setRevokingAppMint(null);
      setManualMint("");
      setWorkspaceView("apps");
      setStatus("Your wallet account changed. Connect and sign in again.");
      setNoticeTone("info");
    });
  }, [activeWallet, account]);

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

  useEffect(() => {
    if (!status || busy) return;
    const timer = window.setTimeout(() => setStatus(null), noticeTone === "error" ? 10_000 : 5_000);
    return () => window.clearTimeout(timer);
  }, [busy, noticeTone, status]);

  const notify = (message: string, tone: NoticeTone = "success") => {
    setNoticeTone(tone);
    setStatus(message);
  };

  const validatingAppIds = useMemo(() => Object.entries(releases)
    .filter(([, appReleases]) => appReleases.some((release) => release.validation_status === "validating_binary"))
    .map(([appId]) => appId)
    .sort()
    .join(","), [releases]);

  useEffect(() => {
    if (!validatingAppIds) return;
    const appIds = validatingAppIds.split(",");
    let active = true;
    const timer = window.setInterval(() => {
      void Promise.all(appIds.map(async (appId) => {
        const response = await api<{ releases: readonly PublisherRelease[] }>(`/api/v1/publisher/apps/${appId}/releases`);
        return [appId, response.releases] as const;
      })).then((entries) => {
        if (active) setReleases((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }).catch(() => undefined);
    }, 6_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
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
      iconUrl: string | null;
      claimStatus: string;
      distributionEnabled: boolean;
      releasePolicy: ReleasePolicy;
      releaseCount: string;
      consentStatus: string | null;
      category: CatalogCategory;
      genres: readonly GameGenre[];
      publisherLinks: PublisherLinks;
    }[] }>("/api/v1/publisher/apps");
    setClaims(Object.fromEntries(existing.apps.map((app) => [app.appMint, {
      id: app.id,
      appMint: app.appMint,
      slug: app.slug,
      name: app.name,
      packageName: app.packageName,
      iconUrl: app.iconUrl,
      claimStatus: app.claimStatus,
      consented: app.consentStatus === "active",
      consentStatus: app.consentStatus,
      distributionEnabled: app.distributionEnabled,
      releasePolicy: app.releasePolicy,
      releaseCount: Number(app.releaseCount),
      category: app.category,
      genres: app.genres,
      publisherLinks: app.publisherLinks
    }])));
    const releaseEntries = await Promise.all(existing.apps.map(async (app) => {
      const response = await api<{ releases: readonly PublisherRelease[] }>(`/api/v1/publisher/apps/${app.id}/releases`);
      return [app.id, response.releases] as const;
    }));
    setReleases(Object.fromEntries(releaseEntries));
    setActiveWallet(wallet);
    setAccount(nextAccount);
    setWorkspaceView(existing.apps.length ? "apps" : "setup");
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
    notify("No compatible wallet was detected. Install or unlock a Wallet Standard wallet, then retry.", "error");
  };

  function closeWalletPicker() {
    restoreWalletFocus.current = true;
    setWalletPickerOpen(false);
  }

  const discover = () => run(async () => {
    const response = await api<{ apps: readonly DiscoveredApp[] }>("/api/v1/publisher/discover-apps");
    setApps(response.apps);
    notify(response.apps.length === 0
      ? "No authorized App NFT was found yet. If you just minted one in the Solana Mobile Publisher Portal, wait a few seconds and retry."
      : `Found ${response.apps.length} app${response.apps.length === 1 ? "" : "s"} this wallet can publish.`, response.apps.length === 0 ? "info" : "success");
  });

  const claim = (appMint: string) => run(async () => {
    const { app } = await api<{ app: DiscoveredApp & { id: string; slug: string; claimStatus: string } }>(
      `/api/v1/publisher/apps/${encodeURIComponent(appMint)}/claim`, mutation()
    );
    setClaims((current) => ({ ...current, [app.appMint]: {
      ...app,
      consentStatus: null,
      distributionEnabled: false,
      releasePolicy: "manual",
      releaseCount: 0,
      publisherLinks: { ...EMPTY_PUBLISHER_LINKS }
    } }));
    setManualMint("");
    openManage(app.appMint);
    notify(`${app.name} was added. Choose its distribution and store settings next.`);
  });

  const claimMint = async () => {
    const mint = manualMint.trim();
    if (busy || mint.length < 32) return;
    if (claims[mint]) {
      openManage(mint);
      setManualMint("");
      return;
    }
    await claim(mint);
  };

  function openManage(appMint: string) {
    setRevokingAppMint(null);
    setSelectedAppMint(appMint);
    setWorkspaceView("manage");
  }

  const consent = (candidate: ClaimedApp, consentPolicy: ReleasePolicy = candidate.releasePolicy ?? "manual") => run(async () => {
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
    notify(wasRevoked
      ? `${candidate.name} is available on Dapport again.`
      : `Environment-bound ${consentPolicy} distribution consent is active for ${candidate.name}.`);
  });

  const sync = (candidate: ClaimedApp) => run(async () => {
    const result = await api<{ status: "completed" | "partial" | "already_running"; releases: readonly { releaseMint: string }[] }>(`/api/v1/publisher/apps/${candidate.id}/sync`, mutation());
    await refreshReleases(candidate.id);
    notify(result.status === "partial"
      ? `Releases refreshed for ${candidate.name}, but some checks could not finish. Please retry the refresh.`
      : result.status === "already_running" ? `A refresh is already running for ${candidate.name}.`
        : `Found ${result.releases.length} release${result.releases.length === 1 ? "" : "s"} for ${candidate.name}.`,
    result.status === "completed" ? "success" : "info");
  });

  const validateOrPublish = (candidate: ClaimedApp, release: PublisherRelease) => run(async () => {
    const result = await api<{ status: "validating_binary" | "published" }>(`/api/v1/publisher/releases/${release.id}/publish`, mutation());
    await refreshReleases(candidate.id);
    notify(result.status === "published"
      ? `${candidate.name} ${release.version_name} is published.`
      : `Dapport is checking ${candidate.name} ${release.version_name}. Recent checks took 40–80 seconds; this page updates automatically.`);
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
    notify(`${candidate.name} has been removed from Dapport. Existing installations are not affected.`);
  });

  async function refreshReleases(appId: string): Promise<void> {
    const response = await api<{ releases: readonly PublisherRelease[] }>(`/api/v1/publisher/apps/${appId}/releases`);
    setReleases((current) => ({ ...current, [appId]: response.releases }));
  }

  const saveStorefront = (candidate: ClaimedApp, category: CatalogCategory, genres: readonly GameGenre[], links: PublisherLinks) => run(async () => {
    const [, response] = await Promise.all([
      api(`/api/v1/publisher/apps/${candidate.id}/classification`, mutation({ category, genres })),
      api<{ publisherLinks: PublisherLinks }>(`/api/v1/publisher/apps/${candidate.id}/links`, mutation(links))
    ]);
    setClaims((current) => ({
      ...current,
      [candidate.appMint]: { ...candidate, category, genres, publisherLinks: response.publisherLinks }
    }));
    notify(`${candidate.name} store details are saved.`);
  });

  const saveProfile = async (input: ProfileInput): Promise<ProfileResponse | null> => {
    const generation = authenticationGeneration.current;
    let result: ProfileResponse | null = null;
    await run(async () => {
      if (!account || !activeWallet) throw new Error("Reconnect your publisher wallet.");
      const response = await api<ProfileResponse>("/api/v1/publisher/profile", mutation(input));
      if (authenticationGeneration.current !== generation) return;
      result = response;
      notify("Your public profile is saved.");
    });
    return result;
  };

  function run(action: () => Promise<void>): Promise<void> {
    setStatus(null);
    setBusy(true);
    return action().catch((error: unknown) => notify(error instanceof Error ? error.message : "Publisher operation failed.", "error"))
      .finally(() => setBusy(false));
  }

  const claimList = Object.values(claims);
  const publisherName = profile?.profile.displayName?.trim() || "Publisher";
  const selectedClaim = selectedAppMint ? claims[selectedAppMint] : undefined;
  const selectedReleases = selectedClaim ? releases[selectedClaim.id] ?? [] : [];
  const selectedLiveRelease = selectedClaim ? publishedRelease(selectedClaim, selectedReleases) : undefined;
  const latest = claimList
    .flatMap((app) => (releases[app.id] ?? []).map((release) => ({ app, release })))
    .sort((left, right) => Date.parse(right.release.created_at) - Date.parse(left.release.created_at))[0];

  return (
    <>
      {!account && <PublisherLanding onConnect={requestConnection} busy={busy} walletCount={wallets.length} triggerRef={walletPickerTrigger} />}

      {walletPickerOpen && (
        <div
          className={styles.walletBackdrop}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeWalletPicker(); }}
        >
          <section ref={walletPickerDialog} className={styles.walletDialog} role="dialog" aria-modal="true" aria-labelledby="wallet-picker-title" aria-describedby="wallet-picker-description">
            <header className={styles.walletHeading}>
              <h2 id="wallet-picker-title">Choose your wallet</h2>
              <button type="button" className={styles.walletCancel} onClick={closeWalletPicker}>Cancel</button>
              <p id="wallet-picker-description">You will review and sign a one-time authentication message. This does not submit a transaction.</p>
            </header>
            <div className={styles.walletList}>
              {wallets.map((wallet, index) => (
                <button
                  key={wallet.name}
                  ref={index === 0 ? firstWalletOption : undefined}
                  type="button"
                  className={styles.walletOption}
                  onClick={() => void connect(wallet)}
                  disabled={busy}
                >
                  <Image className={styles.walletIcon} src={wallet.icon} width={40} height={40} alt="" unoptimized />
                  <span>{wallet.name}</span>
                  <ArrowRight className={styles.walletArrow} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {account && (
        <div className={`publisher-workspace ${styles.studio}`}>
          <aside className={styles.rail}>
            <div className={styles.identity}>
              <div aria-hidden="true">
                <PublisherAvatar className={styles.avatar} name={publisherName} url={profile?.profile.avatarUrl ?? null} />
              </div>
              <div>
                <p className={styles.publisherName}>{publisherName}</p>
                <small title={account.address}>{shortAddress(account.address)}</small>
              </div>
            </div>
            <nav className={styles.navigation} aria-label="Publisher workspace">
              <button type="button" aria-current={workspaceView !== "profile" ? "page" : undefined} onClick={() => setWorkspaceView("apps")}>
                <Stack aria-hidden="true" /> My apps
              </button>
              <button type="button" aria-current={workspaceView === "profile" ? "page" : undefined} onClick={() => setWorkspaceView("profile")}>
                <User aria-hidden="true" /> My profile
              </button>
            </nav>
            {profile && <Link className={styles.profileLink} href={`/publishers/${encodeURIComponent(profile.profile.slug)}`}>View public profile <ArrowRight aria-hidden="true" /></Link>}
          </aside>

          <div className={styles.content}>
            {workspaceView === "profile" && <h1 className={styles.title} id="publisher-profile-title" tabIndex={-1} ref={headingRef}>My profile</h1>}
            <PublisherProfileEditor
              key={account.address}
              hidden={workspaceView !== "profile"}
              disabled={busy}
              load={loadPublisherProfile}
              save={saveProfile}
              onProfileChange={setProfile}
            />

            {workspaceView === "apps" && (
              <section aria-labelledby="publisher-apps-title" className={styles.apps}>
                <header className={styles.heading}>
                  <h1 className={styles.title} id="publisher-apps-title" tabIndex={-1} ref={headingRef}>My apps</h1>
                  <button className={`${styles.primary} ${styles.addApp}`} type="button" onClick={() => setWorkspaceView("setup")}><Plus aria-hidden="true" /> Add an app</button>
                </header>
                {claimList.length ? (
                  <ul className={styles.appList}>
                    {claimList.map((app) => {
                      const appReleases = releases[app.id] ?? [];
                      const liveRelease = publishedRelease(app, appReleases);
                      const version = liveRelease ?? appReleases[0];
                      const appStatus = appOverviewStatus(app, appReleases[0], liveRelease);
                      return (
                        <li key={app.id} className={styles.appRow}>
                          <AppIcon key={app.iconUrl} url={app.iconUrl} />
                          <div className={styles.appIdentity}>
                            <h2>{app.name}</h2>
                            <p>{app.packageName}</p>
                          </div>
                          <div className={styles.appRelease}>
                            <span className={styles.appStatus} data-tone={appStatus.tone}>{appStatus.label}</span>
                            {version && <small>{versionLabel(version)}</small>}
                          </div>
                          <button className={styles.manageApp} type="button" aria-label={`Manage app ${app.name}`} onClick={() => openManage(app.appMint)}>
                            Manage app <ArrowRight aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className={styles.empty}>
                    <AppWindow aria-hidden="true" />
                    <h2>No apps here yet.</h2>
                    <p>Add an App NFT this wallet has publishing authority for.</p>
                  </div>
                )}
                {latest && (
                  <section aria-labelledby="publisher-latest-release" className={styles.latest}>
                    <h2 id="publisher-latest-release">Latest release</h2>
                    <div className={styles.latestDetails}>
                      <span className={styles.releaseIcon}><Cube aria-hidden="true" /></span>
                      <p><strong>{latest.app.name}</strong><span>{versionLabel(latest.release)}</span><span>{releaseOverviewStatus(latest.app, latest.release).label}</span></p>
                    </div>
                  </section>
                )}
              </section>
            )}

            {workspaceView === "setup" && (
              <section className={styles.subview} aria-labelledby="publisher-add-title">
                <button type="button" className={styles.back} onClick={() => setWorkspaceView("apps")}><ArrowLeft aria-hidden="true" /> Back to my apps</button>
                <h1 className={styles.title} id="publisher-add-title" tabIndex={-1} ref={headingRef}>Add an app</h1>
                <div className="panel publisher-step-panel" aria-busy={busy}>
                  <h2>Find your App NFT</h2>
                  <p className="muted">Discover the App NFTs this wallet can publish, or enter an App mint directly. Dapport verifies your publishing authority on Solana.</p>
                  <div className="control-row">
                    <button type="button" className={styles.primary} onClick={() => void discover()} disabled={busy}>Discover my apps</button>
                  </div>
                  <form className="control-row" onSubmit={(event) => { event.preventDefault(); void claimMint(); }}>
                    <input aria-label="App mint" placeholder="Or paste an App mint" autoCapitalize="none" spellCheck={false} value={manualMint} onChange={(event) => setManualMint(event.target.value)} />
                    <button type="submit" className="secondary" disabled={busy || manualMint.trim().length < 32}>Verify and add</button>
                  </form>
                  {apps.length > 0 && (
                    <div className="operation-list">
                      {apps.map((candidate) => (
                        <div key={candidate.appMint} className="operation-row">
                          <div><strong>{candidate.name}</strong><small>{candidate.packageName}</small></div>
                          <button type="button" className="secondary" onClick={() => void claim(candidate.appMint)} disabled={busy || Boolean(claims[candidate.appMint])}>
                            {claims[candidate.appMint] ? "Added" : "Add to Dapport"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className={styles.setupHelp}>Need an App NFT? <a href="https://publish.solanamobile.com" target="_blank" rel="noreferrer">Open the Solana Mobile Publisher Portal <ArrowSquareOut aria-hidden="true" /></a></p>
                </div>
              </section>
            )}

            {workspaceView === "manage" && selectedClaim && (
              <section className={styles.subview} aria-labelledby="publisher-managed-app-title">
                <button type="button" className={styles.back} onClick={() => setWorkspaceView("apps")}><ArrowLeft aria-hidden="true" /> Back to my apps</button>
                <article className="publisher-app-manager" key={selectedClaim.id} aria-busy={busy}>
                  <header className="publisher-manager-header">
                    <AppIcon key={selectedClaim.iconUrl} url={selectedClaim.iconUrl} compact />
                    <div className="publisher-manager-title">
                      <h1 className={styles.managedTitle} id="publisher-managed-app-title" tabIndex={-1} ref={headingRef}>{selectedClaim.name}</h1>
                      <p>{selectedClaim.packageName}</p>
                    </div>
                    <div className="publisher-manager-actions">
                      {selectedLiveRelease && selectedClaim.slug ? <Link href={`/apps/${selectedClaim.slug}`}>View store page <ArrowSquareOut aria-hidden="true" /></Link> : null}
                      {selectedClaim.consentStatus !== "revoked" && selectedClaim.consented ? <button type="button" className="danger-quiet" onClick={() => setRevokingAppMint(selectedClaim.appMint)}><TrashSimple aria-hidden="true" /> Remove</button> : null}
                    </div>
                  </header>

                  {revokingAppMint === selectedClaim.appMint ? (
                    <div className="publisher-revoke-confirm">
                      <strong>Remove {selectedClaim.name} from Dapport?</strong>
                      <p>Its catalogue listing and future Dapport updates stop immediately. Apps already installed on phones are not removed.</p>
                      <div className="control-row compact">
                        <button type="button" className="danger" disabled={busy} onClick={() => void revoke(selectedClaim)} autoFocus>Confirm removal</button>
                        <button type="button" className="secondary" onClick={() => setRevokingAppMint(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : null}

                  <section className="publisher-manager-section" aria-labelledby={`distribution-${selectedClaim.id}`}>
                    <div className="publisher-manager-section-heading">
                      <div><p className="step-label">Distribution</p><h2 id={`distribution-${selectedClaim.id}`}>Choose how releases reach Dapport.</h2></div>
                      <span>{selectedClaim.consented ? "Allowed" : selectedClaim.consentStatus === "revoked" ? "Removed" : "Action needed"}</span>
                    </div>
                    <p>Review the <a href="/publisher/distribution-terms" target="_blank" rel="noreferrer">distribution terms</a>, then sign an app-specific consent message. No transaction is sent.</p>
                    <DistributionEditor
                      key={`${selectedClaim.id}-${selectedClaim.releasePolicy}-${selectedClaim.consentStatus}`}
                      app={selectedClaim}
                      termsVersion={termsVersion}
                      disabled={busy}
                      onConsent={(nextPolicy) => void consent(selectedClaim, nextPolicy)}
                      onSync={() => void sync(selectedClaim)}
                    />
                  </section>

                  <section className="publisher-manager-section" aria-labelledby={`storefront-${selectedClaim.id}`}>
                    <div className="publisher-manager-section-heading">
                      <div><p className="step-label">Store page</p><h2 id={`storefront-${selectedClaim.id}`}>Help people find and follow this app.</h2></div>
                    </div>
                    <StorefrontEditor
                      key={selectedClaim.id}
                      app={selectedClaim}
                      disabled={busy}
                      onSave={(category, genres, links) => void saveStorefront(selectedClaim, category, genres, links)}
                    />
                  </section>

                  <section className="publisher-manager-section" aria-labelledby={`releases-${selectedClaim.id}`}>
                    <div className="publisher-manager-section-heading">
                      <div><p className="step-label">Releases</p><h2 id={`releases-${selectedClaim.id}`}>APK checks and publication.</h2></div>
                      <button type="button" className="secondary" onClick={() => void sync(selectedClaim)} disabled={busy || !selectedClaim.consented}>Refresh releases</button>
                    </div>
                    <p>Dapport checks the APK referenced by each Release NFT before it can be installed from the catalogue.</p>
                    <div className="operation-list">
                      {selectedReleases.map((release) => (
                        <div className="operation-row" key={release.id}>
                          <div><strong>{selectedClaim.name} {release.version_name}</strong><small>{releaseStatusLabel(release)}</small></div>
                          <div className="control-row compact">
                            {release.validation_status === "validating_binary" ? (
                              <span className="validation-live" role="status">
                                <i aria-hidden="true" />
                                <span>Updating automatically</span>
                              </span>
                            ) : null}
                            {releaseActionLabel(release) ? <button type="button" onClick={() => void validateOrPublish(selectedClaim, release)} disabled={busy || Boolean(release.quarantine_code)}>{releaseActionLabel(release)}</button> : null}
                          </div>
                        </div>
                      ))}
                      {selectedReleases.length === 0 ? <p className="muted">{selectedClaim.consented ? "No release loaded yet. Refresh releases to check again." : "Allow distribution before loading releases."}</p> : null}
                    </div>
                  </section>
                </article>
              </section>
            )}
          </div>
        </div>
      )}
      {busy || status ? <p className={`publisher-toast ${busy ? "info" : noticeTone}`} role={!busy && noticeTone === "error" ? "alert" : "status"}>{busy ? "Working…" : status}</p> : null}
    </>
  );
}

function AppIcon({ url, compact = false }: { url: string | null; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={styles.appIcon} data-compact={compact}>
      {url && /^https:\/\//i.test(url) && !failed
        ? <Image src={url} alt="" width={76} height={76} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <AppWindow aria-hidden="true" />}
    </span>
  );
}

type OverviewStatus = { label: string; tone: "published" | "pending" | "warning" | "removed" };

function appRestriction(app: ClaimedApp): OverviewStatus | undefined {
  if (app.consentStatus === "revoked" || app.claimStatus === "revoked") return { label: "Removed", tone: "removed" };
  if (app.claimStatus === "suspended") return { label: "Suspended", tone: "warning" };
  if (app.claimStatus === "pending") return { label: "Claim pending", tone: "pending" };
}

function publishedRelease(app: ClaimedApp, releases: readonly PublisherRelease[]) {
  if (!app.consented || !app.distributionEnabled || appRestriction(app)) return undefined;
  return releases.find((release) => release.publication_status === "published" && release.validation_status !== "quarantined");
}

function appOverviewStatus(app: ClaimedApp, latest: PublisherRelease | undefined, live: PublisherRelease | undefined): OverviewStatus {
  const restriction = appRestriction(app);
  if (restriction) return restriction;
  if (live) return { label: "Published", tone: "published" };
  if (!app.consented) return { label: "Setup in progress", tone: "pending" };
  if (!app.distributionEnabled) return { label: "Distribution paused", tone: "warning" };
  if (!latest) return { label: "Awaiting release", tone: "pending" };
  return releaseOverviewStatus(app, latest);
}

function releaseOverviewStatus(app: ClaimedApp, release: PublisherRelease): OverviewStatus {
  if (release.publication_status === "withdrawn") return { label: "Removed", tone: "removed" };
  const restriction = appRestriction(app);
  if (restriction) return restriction;
  if (release.publication_status === "ignored") return { label: "Ignored", tone: "pending" };
  if (release.validation_status === "quarantined" || release.quarantine_code) return { label: "Blocked", tone: "warning" };
  if (release.publication_status === "published") {
    if (app.consented && app.distributionEnabled) return { label: "Published", tone: "published" };
    return { label: "Distribution paused", tone: "warning" };
  }
  if (release.validation_status === "validating_binary") return { label: releaseStatusLabel(release), tone: "pending" };
  if (release.validation_status === "server_binary_valid") return { label: "Ready to publish", tone: "pending" };
  if (release.validation_status === "metadata_valid") {
    return release.validation_failure_codes?.length
      ? { label: "Checks need attention", tone: "warning" }
      : { label: "Ready for checks", tone: "pending" };
  }
  return { label: "Unpublished", tone: "pending" };
}

function versionLabel(release: PublisherRelease): string {
  return release.version_name ? `Version ${release.version_name}` : `Build ${release.version_code}`;
}

function DistributionEditor({
  app,
  termsVersion,
  disabled,
  onConsent,
  onSync
}: {
  app: ClaimedApp;
  termsVersion: string;
  disabled: boolean;
  onConsent: (policy: ReleasePolicy) => void;
  onSync: () => void;
}) {
  const [policy, setPolicy] = useState<ReleasePolicy>(app.releasePolicy ?? "manual");
  const policyChanged = app.consented && policy !== app.releasePolicy;
  const actionLabel = app.consentStatus === "revoked"
    ? "Review and reauthorize"
    : policyChanged
      ? "Review and update consent"
      : app.consented
        ? "Distribution active"
        : "Review and allow distribution";

  return (
    <div className="publisher-distribution-editor">
      <label>Release policy
        <select value={policy} onChange={(event) => setPolicy(event.target.value as ReleasePolicy)} disabled={disabled}>
          <option value="manual">I publish each release manually</option>
          <option value="automatic">Publish automatically after Dapport checks pass</option>
        </select>
      </label>
      <small className="publisher-terms-version">Terms: {termsVersion}</small>
      <div className="control-row compact">
        <button type="button" className={styles.primary} onClick={() => onConsent(policy)} disabled={disabled || (app.consented && !policyChanged)}>{actionLabel}</button>
        <button type="button" className="secondary" onClick={onSync} disabled={disabled || !app.consented}>Find latest releases</button>
      </div>
    </div>
  );
}

function StorefrontEditor({
  app,
  disabled,
  onSave
}: {
  app: ClaimedApp;
  disabled: boolean;
  onSave: (category: CatalogCategory, genres: readonly GameGenre[], links: PublisherLinks) => void;
}) {
  const [category, setCategory] = useState<CatalogCategory>(app.category ?? "other");
  const [genres, setGenres] = useState<readonly GameGenre[]>(app.genres ?? []);
  const initial = app.publisherLinks ?? EMPTY_PUBLISHER_LINKS;
  const [website, setWebsite] = useState(initial.website ?? "");
  const [x, setX] = useState(initial.x ?? "");
  const [discord, setDiscord] = useState(initial.discord ?? "");
  const [telegram, setTelegram] = useState(initial.telegram ?? "");
  const toggleGenre = (genre: GameGenre) => setGenres((current) => current.includes(genre)
    ? current.filter((item) => item !== genre)
    : current.length < 4 ? [...current, genre] : current);
  const links = {
    website: website.trim() || null,
    x: x.trim() || null,
    discord: discord.trim() || null,
    telegram: telegram.trim() || null
  } satisfies PublisherLinks;

  return (
    <div className="publisher-storefront-form">
      <div className="publisher-category-editor">
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
        ) : <p className="muted publisher-category-note">Focused categories stay simple. Extra genre filters appear only for games.</p>}
      </div>
      <div className="publisher-links-editor">
        <div className="publisher-links-heading">
          <div><strong>Official links</strong><small>Displayed as publisher-provided links on the store page.</small></div>
          <span>Optional</span>
        </div>
        <div className="publisher-link-fields">
          <label>Website<input type="url" inputMode="url" placeholder="https://yourapp.com" value={website} onChange={(event) => setWebsite(event.target.value)} disabled={disabled} /></label>
          <label>X<input type="url" inputMode="url" placeholder="https://x.com/yourapp" value={x} onChange={(event) => setX(event.target.value)} disabled={disabled} /></label>
          <label>Discord<input type="url" inputMode="url" placeholder="https://discord.gg/yourapp" value={discord} onChange={(event) => setDiscord(event.target.value)} disabled={disabled} /></label>
          <label>Telegram<input type="url" inputMode="url" placeholder="https://t.me/yourapp" value={telegram} onChange={(event) => setTelegram(event.target.value)} disabled={disabled} /></label>
        </div>
      </div>
      <div className="publisher-storefront-save">
        <span>Category, game genres and official links are saved together.</span>
        <button type="button" onClick={() => onSave(category, genres, links)} disabled={disabled}>Save store page</button>
      </div>
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

function loadPublisherProfile(): Promise<ProfileResponse> {
  return api<ProfileResponse>("/api/v1/publisher/profile");
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
  if (release.validation_status === "validating_binary") {
    return release.validation_run_status === "queued" ? "Queued for APK checks" : "APK checks in progress";
  }
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
    VALIDATOR_DISPATCH_FAILED: "checks could not start; please retry",
    VALIDATOR_RUNNER_FAILED: "validation service could not complete the checks; please retry",
    VALIDATOR_TIMEOUT: "checks timed out; please retry",
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

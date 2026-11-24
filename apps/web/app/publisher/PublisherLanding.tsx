"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type Ref } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Wallet } from "@phosphor-icons/react/dist/csr/Wallet";
import { X } from "@phosphor-icons/react/dist/csr/X";
import artwork from "../../public/publisher-hero.webp";
import styles from "./PublisherLanding.module.css";

const steps = [
  {
    title: "Connect your wallet",
    text: "Use the publisher wallet that controls your App NFT. Sign a one-time message to open the workspace, where you can manage apps and edit your public profile."
  },
  {
    title: "Find your app",
    text: "Choose an app Dapport finds for your wallet, or enter its App NFT mint address. Dapport checks that your wallet can publish for that app."
  },
  {
    title: "Authorize distribution",
    text: "Review the terms and sign consent for this app. Choose whether future releases that pass Dapport’s checks go live automatically or wait for you to publish them."
  },
];

type LandingProps = {
  busy?: boolean;
  walletCount?: number;
  onConnect?: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
};

export function PublisherLanding({ busy = false, walletCount = 0, onConnect, triggerRef }: LandingProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [help, setHelp] = useState<"wallet" | "mint">("wallet");
  const helpDialog = useRef<HTMLDialogElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function openHelp(topic: typeof help) {
    setHelp(topic);
    helpDialog.current?.showModal();
  }

  function navigateSteps(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next;
    switch (event.key) {
      case "ArrowLeft": next = (index + steps.length - 1) % steps.length; break;
      case "ArrowRight": next = (index + 1) % steps.length; break;
      case "Home": next = 0; break;
      case "End": next = steps.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveStep(next);
    tabs.current[next]?.focus({ preventScroll: true });
  }

  return (
    <div className={styles.landing}>
      <section className={styles.hero} data-publisher-hero aria-labelledby="publish-title">
        <div className={styles.spread}>
          <div className={styles.intro}>
            <h1 id="publish-title">Publish your app <span>on Dapport.</span></h1>
            <p>Bring the Solana app you already publish to Android users. Connect your publisher wallet to manage your releases and public profile.</p>
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.connect}
                ref={triggerRef}
                disabled={busy || !onConnect}
                aria-haspopup={onConnect && walletCount !== 1 ? "dialog" : undefined}
                aria-describedby={onConnect ? undefined : "publisher-availability"}
                onClick={() => walletCount > 0 ? onConnect?.() : openHelp("wallet")}
              >
                <Wallet aria-hidden="true" />
                {busy ? "Connecting…" : "Connect wallet"}
              </button>
              <a className={styles.guideLink} href="#publishing-guide">
                Publishing guide <ArrowRight aria-hidden="true" />
              </a>
            </div>
            {!onConnect && (
              <p id="publisher-availability" className={styles.availability}>
                Publisher onboarding is currently unavailable here. You can still use the guide below.
              </p>
            )}
          </div>
          <div className={styles.art}>
            <Image src={artwork} alt="" fill preload sizes="(max-width: 760px) 94vw, 48vw" />
          </div>
        </div>
      </section>

      <section id="publishing-guide" className={styles.guide} aria-labelledby="guide-title" tabIndex={-1}>
        <div className={styles.guideInner}>
          <div className={styles.guideIntro}>
            <h2 id="guide-title">Publishing guide</h2>
            <p>Dapport lists your app with your permission. You keep your signing keys and can withdraw consent in your workspace.</p>
          </div>
          <div className={styles.reader}>
            <div className={styles.tabs} role="tablist" aria-label="Steps to list your app">
              {steps.map((step, index) => (
                <button type="button" role="tab" key={step.title} id={`guide-tab-${index}`}
                  aria-selected={activeStep === index} aria-controls={`guide-panel-${index}`}
                  ref={(node) => { tabs.current[index] = node; }}
                  tabIndex={activeStep === index ? 0 : -1}
                  onClick={() => setActiveStep(index)} onKeyDown={(event) => navigateSteps(event, index)}>
                  <span className={styles.number} aria-hidden="true">{index + 1}</span>
                  <span>{step.title}</span>
                </button>
              ))}
            </div>
            <div className={styles.panels}>
              {steps.map((step, index) => (
                <p key={step.title} role="tabpanel" id={`guide-panel-${index}`} aria-labelledby={`guide-tab-${index}`}
                  aria-hidden={activeStep !== index} tabIndex={activeStep === index ? 0 : -1}>
                  {step.text}
                </p>
              ))}
            </div>
          </div>
          <div className={styles.resources}>
            <button type="button" aria-haspopup="dialog" onClick={() => openHelp("mint")}>
              New to App NFTs?
            </button>
            <Link href="/publisher/distribution-terms">Distribution terms <ArrowRight aria-hidden="true" /></Link>
            <Link href="/security">FAQ &amp; security <ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <dialog className={styles.help} ref={helpDialog} aria-labelledby="publisher-help-title"
        onClick={(event) => { if (event.target === event.currentTarget) helpDialog.current?.close(); }}>
        <div className={styles.dialogBody}>
          <button type="button" className={styles.close} aria-label="Close" onClick={() => helpDialog.current?.close()}>
            <X size={21} aria-hidden="true" />
          </button>
          <h2 id="publisher-help-title">{help === "wallet" ? "No compatible wallet detected" : "New to App NFTs?"}</h2>
          {help === "wallet" ? <p>Install or unlock a Wallet Standard wallet such as Phantom, Solflare or Backpack, then select Connect wallet again. On a phone, open Dapport in your wallet’s browser.</p> : (
            <p>Create your App NFT in the <a href="https://publish.solanamobile.com" target="_blank" rel="noreferrer">Solana Mobile Publisher Portal</a>, then return with the same wallet. <a href="https://docs.solanamobile.com/dapp-store/submit-new-app" target="_blank" rel="noreferrer">Read the Solana Mobile walkthrough</a>.</p>
          )}
        </div>
      </dialog>
    </div>
  );
}

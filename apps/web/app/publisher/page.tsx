import type { Metadata } from "next";
import { hubConfig } from "@/server/runtime";
import { isPublisherOnboardingEnabled } from "@/server/publisher-availability";
import { PublisherClient } from "./PublisherClient";
import { PublisherLanding } from "./PublisherLanding";
import styles from "./PublisherLanding.module.css";

export const metadata: Metadata = {
  title: "For publishers",
  description: "List your Solana app on Dapport, manage Android releases and edit your public publisher profile.",
  alternates: { canonical: "/publisher" }
};

export default function PublisherPage() {
  const onboardingEnabled = isPublisherOnboardingEnabled(hubConfig.heliusApiKey);

  return (
    <main className={styles.page}>
      {onboardingEnabled
        ? <PublisherClient termsVersion={hubConfig.consentTermsVersion} />
        : <PublisherLanding />}
    </main>
  );
}

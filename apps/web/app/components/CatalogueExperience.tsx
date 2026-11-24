import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import styles from "../catalog/Home.module.css";

export function CatalogueExperience() {
  return (
    <section className={styles.lead} id="discover" aria-labelledby="intro">
      <div className={styles.hero}>
        <div className={styles.copy}>
          <h1 id="intro"><span>Solana apps.</span> <span>Any Android.</span></h1>
          <p>Discover Solana games and apps. Install and update them with Dapport on the Android phone you already own.</p>
        </div>
        <aside className={styles.invitation} aria-labelledby="invite-title">
          <span className={styles.audience}>For publishers</span>
          <h2 id="invite-title">Reach more Android users.</h2>
          <p>Choose your Solana Mobile apps and authorize Dapport to distribute them.</p>
          <Link href="/publisher">List your app <ArrowRight aria-hidden="true" /></Link>
        </aside>
      </div>
    </section>
  );
}

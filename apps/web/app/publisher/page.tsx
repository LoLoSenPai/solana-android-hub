import { PublisherClient } from "./PublisherClient";

export default function PublisherPage() {
  return (
    <main>
      <section className="hero compact">
        <p className="eyebrow">Publisher workspace</p>
        <h1>Claim with authority. Consent separately.</h1>
        <p>Wallet Standard authentication, finalized App authority, and environment-bound distribution consent are explicit, independently recorded steps.</p>
      </section>
      <PublisherClient />
    </main>
  );
}

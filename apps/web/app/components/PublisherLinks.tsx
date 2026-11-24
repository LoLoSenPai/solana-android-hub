import type { PublisherLinks as PublisherLinkUrls } from "@hub/api-client";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { Briefcase } from "@phosphor-icons/react/dist/ssr/Briefcase";
import { DiscordLogo } from "@phosphor-icons/react/dist/ssr/DiscordLogo";
import { Globe } from "@phosphor-icons/react/dist/ssr/Globe";
import { TelegramLogo } from "@phosphor-icons/react/dist/ssr/TelegramLogo";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import styles from "./PublisherLinks.module.css";

export function PublisherLinks({ links, portfolioUrl, label }: {
  links?: PublisherLinkUrls | null | undefined;
  portfolioUrl?: string | null;
  label: string;
}) {
  const destinations = [
    { label: "Website", url: links?.website, Icon: Globe },
    { label: "Portfolio", url: portfolioUrl, Icon: Briefcase },
    { label: "X", url: links?.x, Icon: XLogo },
    { label: "Discord", url: links?.discord, Icon: DiscordLogo },
    { label: "Telegram", url: links?.telegram, Icon: TelegramLogo }
  ].flatMap(({ url, ...item }) => url ? [{ ...item, url }] : []);
  if (!destinations.length) return null;
  return (
    <nav className={styles.links} aria-label={label}>
      {destinations.map(({ label: name, url, Icon }) => (
        <a key={name} href={url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">
          <Icon size={20} aria-hidden="true" /><span>{name}</span><ArrowUpRight size={12} aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

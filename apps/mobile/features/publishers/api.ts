import { HubApiClient, type PublicPublisherProfileDto } from "@hub/api-client";
import { hubOrigin } from "@/features/catalog/api";
import { getCatalogChannel } from "@/storage/database";

const client = new HubApiClient(hubOrigin);

export async function loadPublicPublisherProfile(slug: string): Promise<PublicPublisherProfileDto> {
  return client.getPublicPublisherProfile(slug, { channel: await getCatalogChannel() });
}

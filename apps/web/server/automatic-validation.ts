import type { SavedRelease } from "@hub/database";
import type { ReleasePolicy } from "@hub/domain";

export function shouldRequestAutomaticValidation(
  releasePolicy: ReleasePolicy,
  release: SavedRelease
): boolean {
  return releasePolicy === "automatic"
    && release.validationStatus === "metadata_valid"
    && release.publicationStatus === "unpublished"
    && release.quarantineCode === null;
}

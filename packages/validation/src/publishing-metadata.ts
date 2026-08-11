import { z } from "zod";

export const PUBLISHING_SCHEMA_VERSION = "0.4.0" as const;
export const MAX_APK_BYTES = 500 * 1024 * 1024;
const INSTALL_APK_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/vnd.android.package-archive"
]);

const httpsUri = z.url().refine((value) => new URL(value).protocol === "https:", "HTTPS URL required");
const email = z.email();
const sha256 = z.string().transform(normalizeSha256).pipe(z.string().regex(/^[0-9a-f]{64}$/));
const packageName = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/);

const creators = z.array(z.object({ address: z.string().min(32).max(44) }));

export const appJsonMetadataSchema = z.object({
  schema_version: z.literal(PUBLISHING_SCHEMA_VERSION),
  name: z.string().min(1).max(32),
  image: httpsUri,
  properties: z.object({ category: z.string().min(1), creators }),
  extensions: z.object({
    solana_dapp_store: z.object({ android_package: packageName })
  })
});

export const publisherJsonMetadataSchema = z.object({
  schema_version: z.literal(PUBLISHING_SCHEMA_VERSION),
  name: z.string().min(1).max(32),
  extensions: z.object({
    solana_dapp_store: z.object({
      publisher_details: z.object({
        name: z.string().min(1),
        website: httpsUri,
        contact: email
      })
    })
  })
});

const publisherDetails = z.object({
  name: z.string().min(1),
  website: httpsUri,
  contact: email,
  support_email: email
});

const localizedResources = z.object({
  short_description: z.string().max(50),
  long_description: z.string(),
  new_in_version: z.string(),
  saga_features: z.string().optional(),
  name: z.string().min(1)
});

const media = z.object({
  mime: z.string().min(1),
  purpose: z.string().min(1),
  width: z.int().positive(),
  height: z.int().positive(),
  sha256,
  uri: httpsUri
});

const releaseFile = z.object({
  mime: z.string().min(1),
  purpose: z.string().min(1),
  size: z.int().positive().max(MAX_APK_BYTES),
  sha256,
  uri: httpsUri
});

export const releaseJsonMetadataSchema = z.object({
  schema_version: z.literal(PUBLISHING_SCHEMA_VERSION),
  name: z.string().min(1).max(32),
  description: z.string(),
  image: httpsUri,
  properties: z.object({
    category: z.string().optional(),
    creators: creators.optional()
  }),
  extensions: z.object({
    solana_dapp_store: z.object({
      publisher_details: publisherDetails,
      release_details: z.object({
        updated_on: z.string().min(1),
        license_url: httpsUri,
        copyright_url: z.string(),
        privacy_policy_url: httpsUri,
        localized_resources: localizedResources
      }),
      media: z.array(media),
      files: z.array(releaseFile).min(1),
      android_details: z.object({
        android_package: packageName,
        version_code: z.int().positive(),
        version: z.string().min(1).max(128),
        min_sdk: z.int().min(1).max(100),
        target_sdk: z.int().min(1).max(100).optional(),
        cert_fingerprint: sha256,
        permissions: z.array(z.string()),
        locales: z.array(z.string())
      })
    }),
    i18n: z.record(z.string(), z.record(z.string(), z.string()))
  })
});

export interface NormalizedReleaseMetadata {
  schemaVersion: typeof PUBLISHING_SCHEMA_VERSION;
  name: string;
  description: string;
  iconUri: string;
  shortDescription: string;
  packageName: string;
  versionName: string;
  versionCode: bigint;
  minSdk: number;
  targetSdk?: number;
  certificateSha256: string;
  permissions: readonly string[];
  locales: readonly string[];
  apkUri: string;
  apkSize: number;
  apkSha256: string;
  screenshots: readonly string[];
  bannerUri?: string;
  featureGraphicUri?: string;
}

export function normalizeReleaseMetadata(input: unknown): NormalizedReleaseMetadata {
  const parsed = releaseJsonMetadataSchema.parse(input);
  const store = parsed.extensions.solana_dapp_store;
  const android = store.android_details;
  const installFiles = store.files.filter(
    (file) => file.purpose.toLowerCase() === "install" && INSTALL_APK_MIME_TYPES.has(file.mime.toLowerCase())
  );
  if (installFiles.length !== 1) {
    throw new Error("Release metadata must contain exactly one install APK");
  }
  const apk = installFiles[0];
  if (!apk) throw new Error("Install APK missing");
  if (android.target_sdk !== undefined && android.target_sdk < android.min_sdk) {
    throw new Error("target_sdk must not be lower than min_sdk");
  }

  const mediaByPurpose = (purpose: string) => store.media.find(
    (item) => normalizeMediaPurpose(item.purpose) === purpose
  )?.uri;
  const bannerUri = mediaByPurpose("banner");
  const featureGraphicUri = mediaByPurpose("featuregraphic");
  const localized = store.release_details.localized_resources;
  const resolveLocalized = (value: string) => resolveLocalizedResource(
    value,
    parsed.extensions.i18n,
    android.locales
  );

  return {
    schemaVersion: parsed.schema_version,
    name: resolveLocalized(localized.name),
    description: resolveLocalized(localized.long_description),
    iconUri: parsed.image,
    shortDescription: resolveLocalized(localized.short_description),
    packageName: android.android_package,
    versionName: android.version,
    versionCode: BigInt(android.version_code),
    minSdk: android.min_sdk,
    ...(android.target_sdk === undefined ? {} : { targetSdk: android.target_sdk }),
    certificateSha256: android.cert_fingerprint,
    permissions: [...new Set(android.permissions)].sort(),
    locales: [...new Set(android.locales)].sort(),
    apkUri: apk.uri,
    apkSize: apk.size,
    apkSha256: apk.sha256,
    screenshots: store.media
      .filter((item) => item.purpose.toLowerCase().includes("screenshot"))
      .map((item) => item.uri),
    ...(bannerUri === undefined ? {} : { bannerUri }),
    ...(featureGraphicUri === undefined ? {} : { featureGraphicUri })
  };
}

function normalizeMediaPurpose(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function resolveLocalizedResource(
  valueOrKey: string,
  translations: Record<string, Record<string, string>>,
  preferredLocales: readonly string[]
): string {
  for (const locale of preferredLocales) {
    const translated = translations[locale]?.[valueOrKey];
    if (translated !== undefined) return translated;
  }

  for (const localeTranslations of Object.values(translations)) {
    const translated = localeTranslations[valueOrKey];
    if (translated !== undefined) return translated;
  }

  return valueOrKey;
}

function normalizeSha256(value: string): string {
  return value.replaceAll(":", "").trim().toLowerCase();
}

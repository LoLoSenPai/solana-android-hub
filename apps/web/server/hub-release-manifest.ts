import { z } from "zod";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/iu).transform((value) => value.toUpperCase());
const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === "https:", "APK URL must use HTTPS");
const stringArraySchema = z.array(z.string().min(1)).max(100).transform((values) => [...new Set(values)].sort());
const orderedStringArraySchema = z.array(z.string().min(1)).max(100);

const manifestSchema = z.object({
  packageName: z.literal("com.lololabs.solanaandroidhub"),
  versionName: z.string().min(1).max(40),
  versionCode: z.string().regex(/^[1-9][0-9]*$/u),
  apkUrl: httpsUrlSchema,
  apkSize: z.number().int().positive().max(500 * 1024 * 1024),
  apkSha256: digestSchema,
  certificateSha256: digestSchema,
  minSdk: z.number().int().min(26).max(36),
  permissions: stringArraySchema,
  releaseNotes: orderedStringArraySchema,
  publishedAt: z.iso.datetime({ offset: true }),
  mandatory: z.boolean()
});

export type HubReleaseManifest = z.infer<typeof manifestSchema>;

export function hubReleaseManifestFromEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>
): HubReleaseManifest | null {
  const raw = {
    packageName: "com.lololabs.solanaandroidhub",
    versionName: environment.NEXT_PUBLIC_HUB_ANDROID_APK_VERSION,
    versionCode: environment.NEXT_PUBLIC_HUB_ANDROID_APK_VERSION_CODE,
    apkUrl: environment.NEXT_PUBLIC_HUB_ANDROID_APK_URL,
    apkSize: numericValue(environment.HUB_ANDROID_APK_SIZE),
    apkSha256: environment.NEXT_PUBLIC_HUB_ANDROID_APK_SHA256,
    certificateSha256: environment.HUB_ANDROID_APK_CERTIFICATE_SHA256,
    minSdk: 26,
    permissions: jsonStringArray(environment.HUB_ANDROID_APK_PERMISSIONS_JSON),
    releaseNotes: jsonStringArray(environment.HUB_ANDROID_APK_RELEASE_NOTES_JSON),
    publishedAt: environment.HUB_ANDROID_APK_PUBLISHED_AT,
    mandatory: environment.HUB_ANDROID_APK_MANDATORY === "true"
  };
  const result = manifestSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function numericValue(value: string | undefined): number | undefined {
  if (!value || !/^[0-9]+$/u.test(value)) return undefined;
  return Number(value);
}

function jsonStringArray(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function isPublisherOnboardingEnabled(heliusApiKey: string | undefined): boolean {
  return Boolean(heliusApiKey?.trim());
}

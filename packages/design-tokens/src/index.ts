export const colors = {
  background: "#071411",
  surface: "#10201C",
  surfaceRaised: "#172923",
  text: "#F5F8F6",
  textMuted: "#9AAEA7",
  border: "#29433B",
  primary: "#58EBC5",
  primaryDark: "#25B894",
  accent: "#FF765C",
  accentWarm: "#FFB23F",
  success: "#58EBC5",
  warning: "#FFD07A",
  danger: "#FF7D78",
  preview: "#FFD07A"
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, md: 18, lg: 28, xl: 36, pill: 999 } as const;

export const trustCopy = {
  approved: "Approved on Solana Mobile",
  trusted: "Verified Publisher Release",
  preview: "Development preview",
  nonAffiliation: "Independently verified. Not affiliated with Solana Mobile."
} as const;

export const colors = {
  background: "#091018",
  surface: "#111B27",
  surfaceRaised: "#172536",
  text: "#F4F7FB",
  textMuted: "#95A5B7",
  border: "#26384D",
  primary: "#77A7FF",
  primaryDark: "#4F7FEA",
  accent: "#F49A8A",
  accentWarm: "#E6C994",
  success: "#58C7A2",
  warning: "#FFD58A",
  danger: "#FF7D78",
  preview: "#FFD58A"
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, md: 18, lg: 28, xl: 36, pill: 999 } as const;

export const trustCopy = {
  approved: "Approved on Solana Mobile",
  trusted: "Verified Publisher Release",
  preview: "Development preview",
  nonAffiliation: "Independently verified. Not affiliated with Solana Mobile."
} as const;

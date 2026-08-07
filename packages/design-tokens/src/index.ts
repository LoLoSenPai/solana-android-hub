export const colors = {
  background: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceRaised: "#FBFBFE",
  text: "#171925",
  textMuted: "#65697A",
  border: "#E4E6EE",
  primary: "#6D5EF7",
  primaryDark: "#4D3ED1",
  accent: "#23C7A1",
  success: "#167C63",
  warning: "#B86B12",
  danger: "#C43D4B",
  preview: "#7652B5"
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const trustCopy = {
  approved: "Approved on Solana Mobile",
  trusted: "Verified Publisher Release",
  preview: "Development preview",
  nonAffiliation: "Independently verified. Not affiliated with Solana Mobile."
} as const;

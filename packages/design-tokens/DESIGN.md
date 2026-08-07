# Quiet Orbit — Solana Android Hub

## Product character

A premium, modern Android storefront with a native mobile rhythm. It is Solana-adjacent without looking like a generic neon crypto dashboard and without copying Solana Mobile. App artwork and screenshots lead; trust information is calm, precise, and legible.

## Colour

- Background: `#F6F7FB`
- Surface: `#FFFFFF`
- Raised surface: `#FBFBFE`
- Primary text: `#171925`
- Secondary text: `#65697A`
- Border: `#E4E6EE`
- Primary violet: `#6D5EF7`
- Dark violet: `#4D3ED1`
- Mint accent: `#23C7A1`
- Success: `#167C63`
- Warning: `#B86B12`
- Danger: `#C43D4B`
- Preview: `#7652B5`

Use gradients sparingly and only over artwork or hero surfaces. Do not use giant neon blobs.

## Typography

Use Roboto for Android and Geist/Arial-compatible system typography on web. Headings are compact and confident. Body copy uses generous line height. Integrity details use a readable monospace style only for hashes and identifiers.

## Shape and elevation

- App cards: 20 px corners, subtle cool shadow, generous internal spacing.
- Buttons and selectors: 14 px corners, minimum 48 px touch height.
- Pills: fully rounded, always include readable text.
- Sheets: 24 px top corners.
- Prefer borders and restrained elevation over glass effects.

## Trust language

Trust is never encoded by colour alone.

- `Approved on Solana Mobile` requires independent approval evidence.
- `Verified Publisher Release` requires production server and device APK validation.
- `Development preview` is visibly non-production and must never use a verified-release badge.
- Include `Independently verified. Not affiliated with Solana Mobile.` where approval could imply affiliation.

## Android vertical slice

Design these connected screens first:

1. Discover with search, current source selector, featured artwork, and compact app cards.
2. App detail with artwork, publisher, description, screenshots, selected release, permissions, integrity details, and install action.
3. Download/validation/install progress with explicit stages for hash, package, version, certificate, and Android confirmation.
4. Permission-change sheet with additions and removals.
5. Install result and update-available state.

## Publisher vertical slice

Design wallet connection, discovered App claim, canonical consent review, release policy choice, and detected Release status as a simple guided flow. Do not resemble a crypto trading dashboard.

## Accessibility

Use WCAG AA contrast, 48 px touch targets, clear focus states, readable error copy, and icons paired with text. Avoid tiny badges and horizontal scrolling for core information.

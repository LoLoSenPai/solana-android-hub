const { copyFile, mkdir, readFile } = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "../..");
const sources = path.join(root, "packages/design-tokens/assets");
const web = path.join(root, "apps/web/public");
const mobile = path.join(root, "apps/mobile/assets");

async function render() {
  await Promise.all([mkdir(web, { recursive: true }), mkdir(mobile, { recursive: true })]);

  const sourceIcon = await readFile(path.join(sources, "dapport-icon-source.png"));
  const fallback = await readFile(path.join(sources, "dapport-app-fallback.svg"));
  const social = await readFile(path.join(sources, "dapport-social-card.svg"));

  // The generated source includes generous presentation-board spacing. A centred
  // 75% crop preserves adaptive-icon safety while keeping the mark legible at
  // launcher size instead of repeating the old undersized-icon problem.
  const icon = await sharp(sourceIcon)
    .extract({ left: 157, top: 157, width: 940, height: 940 })
    .resize(1024, 1024)
    .png()
    .toBuffer();
  const markAlpha = await sharp(icon)
    .toColourspace("b-w")
    .linear(3.4, -35)
    .blur(0.3)
    .raw()
    .toBuffer();
  const mark = await sharp(icon).joinChannel(markAlpha, {
    raw: { width: 1024, height: 1024, channels: 1 }
  }).png().toBuffer();
  const monochromeAlpha = await sharp(icon).toColourspace("b-w").threshold(58).raw().toBuffer();
  const monochrome = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: "#FFFFFF" }
  }).joinChannel(monochromeAlpha, {
    raw: { width: 1024, height: 1024, channels: 1 }
  }).png().toBuffer();
  const adaptive = await sharp(mark).resize(700, 700, { fit: "contain" }).extend({
    top: 162,
    bottom: 162,
    left: 162,
    right: 162,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }).png().toBuffer();
  const socialMark = await sharp(mark).resize(430, 430, { fit: "contain" }).png().toBuffer();

  await Promise.all([
    sharp(mark).resize(512, 512).png().toFile(path.join(web, "dapport-mark-512.png")),
    sharp(icon).resize(512, 512).png().toFile(path.join(web, "dapport-icon-512.png")),
    sharp(icon).resize(180, 180).png().toFile(path.join(web, "apple-touch-icon.png")),
    sharp(icon).resize(64, 64).png().toFile(path.join(web, "favicon-64.png")),
    sharp(fallback).resize(1024, 1024).png().toFile(path.join(web, "dapport-app-fallback.png")),
    sharp(social).resize(1200, 630).composite([{ input: socialMark, left: 735, top: 96 }]).png().toFile(path.join(web, "dapport-social-card.png")),
    sharp(icon).resize(1024, 1024).png().toFile(path.join(mobile, "icon.png")),
    sharp(adaptive).png().toFile(path.join(mobile, "adaptive-icon.png")),
    sharp(monochrome).resize(700, 700, { fit: "contain" }).extend({
      top: 162,
      bottom: 162,
      left: 162,
      right: 162,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }).png().toFile(path.join(mobile, "monochrome-icon.png")),
    sharp(fallback).resize(1024, 1024).png().toFile(path.join(mobile, "dapport-app-fallback.png"))
  ]);

  await Promise.all([
    copyFile(path.join(web, "hub-hero-chromatic.webp"), path.join(web, "dapport-hero-chromatic.webp")),
    copyFile(path.join(web, "hub-hero-chromatic.webp"), path.join(mobile, "dapport-hero.webp"))
  ]);
}

render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

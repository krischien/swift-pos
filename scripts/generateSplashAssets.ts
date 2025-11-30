import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const splashSvg = path.resolve("src/assets/splash-icon.svg");
const resBase = path.resolve("android/app/src/main/res");

const backgroundColor = { r: 25, g: 194, b: 216, alpha: 1 };

const targets = [
  { folder: "drawable", width: 1280, height: 1920 },
  // Portrait
  { folder: "drawable-port-mdpi", width: 320, height: 480 },
  { folder: "drawable-port-hdpi", width: 480, height: 800 },
  { folder: "drawable-port-xhdpi", width: 720, height: 1280 },
  { folder: "drawable-port-xxhdpi", width: 960, height: 1600 },
  { folder: "drawable-port-xxxhdpi", width: 1280, height: 1920 },
  // Landscape
  { folder: "drawable-land-mdpi", width: 480, height: 320 },
  { folder: "drawable-land-hdpi", width: 800, height: 480 },
  { folder: "drawable-land-xhdpi", width: 1280, height: 720 },
  { folder: "drawable-land-xxhdpi", width: 1600, height: 960 },
  { folder: "drawable-land-xxxhdpi", width: 1920, height: 1280 },
];

async function main() {
  if (!fs.existsSync(splashSvg)) {
    throw new Error(`Splash SVG not found at ${splashSvg}`);
  }

  const svgBuffer = await fs.promises.readFile(splashSvg);

  for (const target of targets) {
    const outputDir = path.join(resBase, target.folder);
    await fs.promises.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "splash.png");

    await sharp(svgBuffer, { density: 300 })
      .resize(target.width, target.height, {
        fit: "contain",
        background: backgroundColor,
      })
      .png()
      .toFile(outputPath);

    console.log(`Generated ${target.folder}/splash.png (${target.width}x${target.height})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



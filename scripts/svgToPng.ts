import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = path.resolve("src/assets/splash-icon.svg");
const dest = path.resolve("src/assets/splash-icon.png");
const size = 512;

async function main() {
  if (!fs.existsSync(src)) {
    throw new Error(`Source SVG not found at ${src}`);
  }

  const svgBuffer = await fs.promises.readFile(src);

  await sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(dest);

  console.log(`Splash icon exported to ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const sourceSvg = path.resolve("src/assets/splash-icon.svg");
const resBase = path.resolve("android/app/src/main/res");

const densities = [
  { folder: "mipmap-mdpi", launcher: 48, foreground: 108 },
  { folder: "mipmap-hdpi", launcher: 72, foreground: 162 },
  { folder: "mipmap-xhdpi", launcher: 96, foreground: 216 },
  { folder: "mipmap-xxhdpi", launcher: 144, foreground: 324 },
  { folder: "mipmap-xxxhdpi", launcher: 192, foreground: 432 },
];

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const circleMask = (size: number) =>
  Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
  );

async function generateIcons() {
  if (!fs.existsSync(sourceSvg)) {
    throw new Error(`Source SVG not found at ${sourceSvg}`);
  }

  const svg = await fs.promises.readFile(sourceSvg);

  for (const density of densities) {
    const outDir = path.join(resBase, density.folder);
    await fs.promises.mkdir(outDir, { recursive: true });

    const launcherPath = path.join(outDir, "ic_launcher.png");
    const roundPath = path.join(outDir, "ic_launcher_round.png");
    const foregroundPath = path.join(outDir, "ic_launcher_foreground.png");

    await sharp(svg, { density: 1024 })
      .resize(density.launcher, density.launcher, {
        fit: "contain",
        background: transparent,
      })
      .png()
      .toFile(launcherPath);

    await sharp(svg, { density: 1024 })
      .resize(density.launcher, density.launcher, {
        fit: "contain",
        background: transparent,
      })
      .composite([{ input: circleMask(density.launcher), blend: "dest-in" }])
      .png()
      .toFile(roundPath);

    await sharp(svg, { density: 1024 })
      .resize(density.foreground, density.foreground, {
        fit: "contain",
        background: transparent,
      })
      .png()
      .toFile(foregroundPath);

    console.log(
      `Generated ${density.folder}: launcher ${density.launcher}px, foreground ${density.foreground}px`,
    );
  }
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});



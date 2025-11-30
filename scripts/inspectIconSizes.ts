import sharp from "sharp";

const folders = ["mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"];

async function main() {
  for (const folder of folders) {
    const base = `android/app/src/main/res/${folder}`;
    const launcher = await sharp(`${base}/ic_launcher.png`).metadata();
    const foreground = await sharp(`${base}/ic_launcher_foreground.png`).metadata();
    console.log(folder, "ic_launcher", launcher.width, launcher.height);
    console.log(folder, "foreground", foreground.width, foreground.height);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



import sharp from "sharp";

const folders = [
  "drawable-port-mdpi",
  "drawable-port-hdpi",
  "drawable-port-xhdpi",
  "drawable-port-xxhdpi",
  "drawable-port-xxxhdpi",
  "drawable-land-mdpi",
  "drawable-land-hdpi",
  "drawable-land-xhdpi",
  "drawable-land-xxhdpi",
  "drawable-land-xxxhdpi",
];

async function main() {
  for (const folder of folders) {
    const file = `android/app/src/main/res/${folder}/splash.png`;
    const metadata = await sharp(file).metadata();
    console.log(folder, metadata.width, metadata.height);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



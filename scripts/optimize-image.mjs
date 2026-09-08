/**
 * Pakkaa kuvan sivustolle sopivaksi WebP-tiedostoksi.
 *
 *   node scripts/optimize-image.mjs <lähde> <kohde.webp> [maksimileveys]
 *
 * Rajaa samalla pois yläreunan valkoisen kaistaleen, jollainen jää helposti
 * kuvankäsittelystä. Alkuperäistä tiedostoa ei muuteta.
 */
import sharp from 'sharp';

const [source, target, maxWidth = '2200'] = process.argv.slice(2);
if (!source || !target) {
  console.error('Käyttö: node scripts/optimize-image.mjs <lähde> <kohde.webp> [maksimileveys]');
  process.exit(1);
}

const image = sharp(source);
const meta = await image.metadata();

// Etsi ensimmäinen rivi joka ei ole lähes kokonaan valkoinen.
const { data, info } = await image.clone().raw().toBuffer({ resolveWithObject: true });
let top = 0;
for (let y = 0; y < info.height; y++) {
  let white = 0;
  let sampled = 0;
  for (let x = 0; x < info.width; x += 8) {
    const i = (y * info.width + x) * info.channels;
    sampled++;
    if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) white++;
  }
  if (white < sampled * 0.97) {
    top = y;
    break;
  }
}

const pipeline = sharp(source);
if (top > 0) {
  pipeline.extract({ left: 0, top, width: meta.width, height: meta.height - top });
}
const result = await pipeline
  .resize({ width: Math.min(Number(maxWidth), meta.width), withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(target);

console.log(
  `${source} (${meta.width}×${meta.height}) → ${target} ` +
    `(${result.width}×${result.height}, ${Math.round(result.size / 1024)} kB)` +
    (top ? `, rajattu ${top} px ylhäältä` : ''),
);

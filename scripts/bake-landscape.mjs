// Resolves the magenta chroma key in the generated landscape into a real alpha
// channel and writes compact WebP files for the renderer and the no-WebGL still.
// The key formula matches the one the shaders used before the alpha was baked.
import sharp from 'sharp';

const source = 'public/assets/empty-site-keyed.png';
const {data, info} = await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject: true});
const {width, height} = info;
const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgba = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = y * width + x, [r, g, b] = [0, 1, 2].map(k => data[i * 3 + k] / 255);
  // Chroma separation is limited to the skyline; purple flowers stay intact.
  const key = smoothstep(.05, .40, Math.min(r, b) - g) * smoothstep(.26, .33, 1 - (y + .5) / height);
  const alpha = 1 - key;
  // Remove magenta contamination in antialiased branches and silhouette edges.
  [r - key, g, b - key].forEach((c, k) => { rgba[i * 4 + k] = Math.round(255 * Math.min(1, Math.max(0, c / Math.max(alpha, .03)))); });
  rgba[i * 4 + 3] = Math.round(255 * alpha);
}
const baked = () => sharp(rgba, {raw: {width, height, channels: 4}});
// Lossy colour, lossless alpha: the skyline edge is kept exactly.
const options = {quality: 85, alphaQuality: 100, effort: 6};
for (const [file, image] of [
  ['public/assets/empty-site.webp', baked()],
  ['public/assets/site-fallback.webp', baked().resize(1400, 700)],
]) {
  const {size} = await image.webp(options).toFile(file);
  console.log(`${file}  ${Math.round(size / 1024)} kB`);
}

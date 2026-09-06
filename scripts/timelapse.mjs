// Renders a day-cycle timelapse offline. The scene is a pure function of state.hour,
// so instead of screen-recording sixteen minutes of real time we step the clock frame
// by frame and screenshot each step: any length, any frame rate, no dropped frames and
// no cursor or browser chrome in the shot.
import {build, preview} from 'vite';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir, rm, writeFile, readdir} from 'node:fs/promises';
import {existsSync, createReadStream, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

const HELP = `
Usage: npm run timelapse -- [options]

  --frames N        frames to render (default 480)
  --fps N           frame rate of the finished video (default 30)
  --start H         first hour, 0-24 (default 0)
  --end H           last hour; may exceed 24 to cross midnight (default 24)
  --width N         capture width in CSS px (default 1920)
  --height N        capture height in CSS px (default 1080)
  --supersample N   render N x larger and scale back down (default 1)
  --quality Q       scene detail: low | balanced | high (default high)
  --out PATH        output file (default timelapse.mp4, or .webm without ffmpeg)
  --bare            hide the wordmark, clock, instructions and timeline
  --keep-frames     leave the individual JPEGs behind
  --no-build        reuse the existing dist/ instead of rebuilding
  --url URL         capture a server that is already running

Defaults give a 16 second video of one full day. A full day is 24 hours of scene
time regardless of how many frames you spend on it.
`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }

function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1];
}
const flag = name => argv.includes(`--${name}`);
const num = (name, fallback) => {
  const v = Number(opt(name, fallback));
  if (!Number.isFinite(v)) throw new Error(`--${name} must be a number`);
  return v;
};

const cfg = {
  frames: Math.max(1, Math.round(num('frames', 480))),
  fps: Math.max(1, num('fps', 30)),
  start: num('start', 0),
  end: num('end', 24),
  width: Math.round(num('width', 1920)),
  height: Math.round(num('height', 1080)),
  supersample: Math.max(1, num('supersample', 1)),
  quality: opt('quality', 'high'),
  bare: flag('bare'),
  keepFrames: flag('keep-frames'),
  url: opt('url', null),
};
if (!['low', 'balanced', 'high'].includes(cfg.quality)) throw new Error('--quality must be low, balanced or high');

const systemFfmpeg = await which('ffmpeg');
// Playwright ships its own ffmpeg for video capture. It is a cut-down build — JPEG in,
// VP8/WebM out, no H.264 — but it means this works with nothing else installed.
const bundledFfmpeg = systemFfmpeg ? null : findBundledFfmpeg();
if (!systemFfmpeg && !bundledFfmpeg) {
  console.error('No ffmpeg found. Install it (brew install ffmpeg) or run: npx playwright install chromium');
  process.exit(1);
}
const out = path.resolve(opt('out', systemFfmpeg ? 'timelapse.mp4' : 'timelapse.webm'));
if (!systemFfmpeg && !out.endsWith('.webm')) {
  console.error(`Only ${path.basename(out)}'s .webm sibling can be written without a system ffmpeg.`);
  console.error('Install ffmpeg (brew install ffmpeg) for MP4, or pass --out timelapse.webm.');
  process.exit(1);
}

const frameDir = path.resolve('.timelapse-frames');
let server, browser;
const shutdown = async () => { await browser?.close().catch(() => {}); await server?.close().catch(() => {}); };
process.on('SIGINT', async () => { await shutdown(); process.exit(130); });

try {
  let url = cfg.url;
  if (!url) {
    if (!flag('no-build')) { console.log('Building…'); await build({ logLevel: 'warn' }); }
    server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'warn' });
    url = server.resolvedUrls.local[0];
  }
  console.log(`Capturing ${cfg.frames} frames from ${url}`);

  browser = await launchChromium();
  const page = await browser.newPage({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: cfg.supersample,
  });
  await page.goto(url, { waitUntil: 'load' });

  // The scene marks its own readiness in the DOM as each piece comes up.
  await page.waitForSelector('#sky[data-renderer="webgl2"]', { timeout: 30000 });
  await page.waitForSelector('#sky[data-landscape="ready"]', { timeout: 30000 });
  await page.waitForSelector('#house[data-backend]', { timeout: 60000 })
    .catch(() => console.warn('The 3D frame never initialised; capturing the sky and landscape only.'));

  await page.evaluate(quality => {
    const set = (sel, value, event) => {
      const el = document.querySelector(sel);
      el.value = value;
      el.dispatchEvent(new Event(event, { bubbles: true }));
    };
    set('#quality', quality, 'change');
    // Playing would advance the clock between setting an hour and screenshotting it.
    const play = document.querySelector('#play');
    if (play.getAttribute('aria-label') === 'Pause time') play.click();
  }, cfg.quality);
  if (cfg.bare) await page.addStyleTag({ content: 'header,footer,.timeline,.intro,aside,#error{display:none!important}' });
  await page.waitForTimeout(1200);

  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const span = cfg.end - cfg.start;
  // A full-day sweep stops one step short of the end so the last frame does not repeat
  // the first, which would stutter on loop.
  const seamless = Math.abs(Math.abs(span) - 24) < 1e-9;
  const started = Date.now();
  for (let i = 0; i < cfg.frames; i++) {
    const hour = cfg.start + span * (i / (seamless ? cfg.frames : Math.max(1, cfg.frames - 1)));
    await page.evaluate(async h => {
      const slider = document.querySelector('#time');
      slider.value = String(((h % 24) + 24) % 24);
      // setTime(value, immediate) jumps the clock and the weather together, no easing.
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, hour);
    await writeFile(
      path.join(frameDir, `${String(i).padStart(6, '0')}.jpg`),
      await page.screenshot({ type: 'jpeg', quality: 95 }),
    );
    if (i % 25 === 0 || i === cfg.frames - 1) {
      const done = i + 1, rate = done / ((Date.now() - started) / 1000);
      process.stdout.write(`\r  ${done}/${cfg.frames} frames  ${rate.toFixed(1)}/s  eta ${Math.round((cfg.frames - done) / rate)}s   `);
    }
  }
  process.stdout.write('\n');

  await shutdown();
  await encode();
  if (!cfg.keepFrames) await rm(frameDir, { recursive: true, force: true });

  const seconds = (cfg.frames / cfg.fps).toFixed(1);
  console.log(`\n${path.relative(process.cwd(), out)} — ${cfg.frames} frames, ${cfg.fps}fps, ${seconds}s`);
} catch (error) {
  await shutdown();
  console.error(error);
  process.exit(1);
}

async function encode() {
  const scale = `scale=${cfg.width}:${cfg.height}:flags=lanczos`;
  if (systemFfmpeg) {
    console.log('Encoding H.264…');
    return run(systemFfmpeg, [
      '-y', '-framerate', String(cfg.fps), '-i', path.join(frameDir, '%06d.jpg'),
      '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
    ]);
  }
  // The bundled build has no image2 demuxer, so the frames go in through stdin.
  console.log('Encoding VP8 (no system ffmpeg — install one for MP4)…');
  const files = (await readdir(frameDir)).filter(f => f.endsWith('.jpg')).sort();
  const child = spawn(bundledFfmpeg, [
    '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(cfg.fps), '-i', 'pipe:0',
    '-vf', scale, '-c:v', 'libvpx', '-b:v', '0', '-crf', '18', '-pix_fmt', 'yuv420p', out,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  const finished = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`)));
  });
  for (const f of files) {
    await new Promise((resolve, reject) => {
      const stream = createReadStream(path.join(frameDir, f));
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(child.stdin, { end: false });
    });
  }
  child.stdin.end();
  return finished;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`)));
  });
}

function which(cmd) {
  return new Promise(resolve => {
    const child = spawn(cmd, ['-version'], { stdio: 'ignore' });
    child.on('error', () => resolve(null));
    child.on('close', code => resolve(code === 0 ? cmd : null));
  });
}

function findBundledFfmpeg() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(homedir(), 'Library/Caches/ms-playwright'), path.join(homedir(), '.cache/ms-playwright')];
  for (const root of roots.filter(Boolean)) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter(d => d.startsWith('ffmpeg'))) {
      for (const name of ['ffmpeg-mac', 'ffmpeg-linux', 'ffmpeg-win64.exe']) {
        const candidate = path.join(root, dir, name);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

async function launchChromium() {
  const args = ['--use-gl=angle', '--use-angle=default', '--enable-unsafe-swiftshader', '--hide-scrollbars'];
  const candidates = [process.env.CHROMIUM_PATH, undefined, '/opt/pw-browsers/chromium'];
  let last;
  for (const executablePath of candidates) {
    if (executablePath !== undefined && !executablePath) continue;
    try { return await chromium.launch({ executablePath, args }); } catch (error) { last = error; }
  }
  throw new Error(`Could not launch Chromium. Run "npx playwright install chromium".\n${last?.message ?? ''}`);
}

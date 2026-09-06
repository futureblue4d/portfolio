# Sky

A fixed-view Benicia landscape with an original WebGL 2 sky inspired by the time-scrubbing interaction at oscardumlao.com. Generated landscape artwork preserves a single house beside the descending road; the surrounding homes are replaced with grassland. All runtime assets are local. No copied site code or external runtime services.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static production site in `dist`; `npm run preview` serves that build.

Drag horizontally to travel through time (one viewport = 12 hours). Scroll or use the left/right arrows; Shift + arrow moves one hour. The bottom timeline also sets time. Space or the pause button pauses both the clock and wind. Atmosphere controls cloud coverage, wind, and rendering detail. Reduced-motion preferences start the experience paused.

## Rendering

`src/noise.js` generates a deterministic, seamless 64³ two-channel noise texture on startup. `src/shaders.js` shapes a three-dimensional cloud layer from that texture, ray marches through it, and samples toward the light for approximate self-shadowing. It includes approximate multiple scattering, directional scattering, ambient sky illumination, distance haze, sun, moon, and stars. Atmospheric colors are artist-tuned approximations, not a physically integrated atmosphere model. The initial prototype uses value noise rather than baked production cloud assets.

`src/main.js` connects a continuous clock to sun position and cloud drift. Balanced quality uses 56 view samples; Light uses 36 and High 88. Pixel resolution is capped for GPU cost. This is an initial visual prototype, not a reproduction of Oscar's renderer; additional work on density shaping and atmospheric scattering can improve realism further.

Requires WebGL 2. All rendering stays in your browser. No accounts, API keys, or backend services.

## Fixed landscape

The default Panorama view composites `public/assets/panorama-keyed.png` beneath the procedural sky. Atmosphere → View → Open sky retains the original sky-only experience. Desktop and portrait framing use one shared image-coordinate camera mapping; portrait favors the house and descending road.

`src/landscape.js` renders the photographic artwork at display resolution while the expensive cloud pass runs at the selected lower resolution. Its fixed-view shader approximates surface lighting, warm twilight, cool moonlit terrain, distance haze, and drifting cloud shade. This is a 2D photographic composite with approximate relighting, not a depth-reconstructed terrain mesh or physical shadow simulation. Some original illumination remains in the artwork. The distant photographed water is static.

The stars now rotate as a shared field with the clock. Dragging, scrolling, and the timeline update both scene lighting and cloud movement. Pause stops automatic weather and clock movement.

See ASSETS.md for the built-in image-generation prompts and asset provenance.

## Portfolio / house frame study

`main` preserves the original one-house landscape. `house-frame-study` introduces the empty-site artwork and an Evan Gorman — Land Use Consulting portfolio concept. The practice dialog is introductory copy only; project credentials and contact information have not been invented.

`src/house.js` uses Three.js WebGPURenderer, with automatic WebGL 2 fallback, on a transparent canvas over the WebGL sky. Add `?webgl` to force the fallback for testing. The engine is loaded separately so the landscape can start before the 3D frame is ready. A calibrated affine camera aligns the 3D footprint to the photographed slab and follows the landscape's responsive crop. Its coordinate system is explicitly matched to the backend so WebGPU does not replace the custom projection on first render.

The model consists of sill plates, wall studs, a broad opening header, top plates, gable rafters, and a ridge beam. Complete framing assemblies appear at scheduled thresholds. With Follow time of day enabled, construction progresses from 7 a.m. to 6 p.m., stays complete overnight, and resets at 5 a.m. Dragging backward through the construction interval reverses assembly. The construction slider disables following and permits independent exploration; checking Follow time of day reattaches it. This is an illustrative daily cycle, not a real construction schedule.

Limitations: the frame is conceptual, not structurally engineered or an approved proposal. The landscape is still a photograph with approximate relighting, not a recovered depth mesh. Frame illumination follows the sun but it does not yet cast physically accurate shadows onto the photographed terrain; the photograph also cannot occlude arbitrary 3D parts without an additional depth mask. Contact details and verified project case studies remain future portfolio content.

### Open wall-frame timelapse

The bright blond timber remains fully open: there is no plywood, sheathing, cladding, or solid roof. Complete preassembled stud-wall frames pop into their upright positions as single units: rear at 9 a.m., left at 10:30 a.m., right at noon, and front (including its opening header) at 1:30 p.m. Six open roof frames arrive every 20 minutes from 3 to 4:40 p.m.; the ridge beam arrives at 5 p.m. Members have their full dimensions immediately; they no longer grow individually. Reverse scrubbing removes the same assemblies at the same thresholds. This stylized timelapse skips the physical lifting motion, showing the result of each wall raising.

### Stable rotating stars

`src/stars.js` creates one deterministic synthetic catalogue of 3,200 directions, brightness values, and colors. A shared rotation moves the field through the sky; stars are never regenerated or given random per-frame brightness. Stars render as Gaussian point sprites at display resolution after the lower-resolution cloud pass, avoiding the old subpixel flicker from hashing tiny points in the cloud texture. The cloud texture's alpha carries transmission, and the photographic skyline masks stars behind terrain and trees. Twilight and horizon attenuation remain gradual. Star resolution is independent of the cloud detail setting.

Verification: browser readback showed identical paused frames (zero changed color channels), continuous aggregate star energy during small time changes, and no WebGL errors.

### Visitor-local time

Each visit initializes from the browser's local clock (including fractional minutes), without location permission or a server timezone. While playing, the scene advances at real clock speed; drag, scroll, arrow keys, and the timeline still let visitors explore another time. Pausing freezes the scene. The Dawn/Day/Dusk/Night preset buttons have been removed.

### Offline timelapse render

`npm run timelapse` renders a day cycle to a video file instead of screen-recording one. The scene is a pure function of `state.hour`, so the script drives the clock frame by frame rather than waiting on wall time: a full day is 24 hours of scene time whatever frame count you spend on it. Screen recording the live site would take the full sixteen minutes of a real cycle and still capture the cursor, the browser chrome and any dropped frames.

The script builds the site, serves `dist/` on an ephemeral port, and drives a headless Chromium through Playwright. It waits on the readiness attributes the scene already publishes — `#sky[data-renderer]`, `#sky[data-landscape]` and `#house[data-backend]` — so no frame is captured before the landscape texture and the timber frame exist. It then pauses playback and steps the clock through the existing timeline input, whose `setTime(value, immediate)` path jumps the hour and the weather together without easing, waits two animation frames for the redraw, and screenshots. Because playback is paused, the only thing moving the clock is the script, so frames are reproducible rather than sampled off a running animation.

Options: `--frames`, `--fps`, `--start`, `--end` (may exceed 24 to cross midnight), `--width`, `--height`, `--supersample`, `--quality`, `--out`, `--bare`, `--keep-frames`, `--no-build`, `--url`. Defaults render 480 frames at 30fps for a 16 second video of one full day. A full-day sweep stops one step short of its end so the last frame does not repeat the first and the video loops cleanly. `--bare` hides the wordmark, clock, instructions and timeline for a clean plate.

Encoding prefers a system `ffmpeg` and writes H.264 MP4. Without one it falls back to the cut-down ffmpeg that ships with Playwright, which accepts MJPEG on a pipe and writes VP8 WebM but has no H.264 encoder and no `image2` demuxer; MP4 output therefore requires installing ffmpeg. Note that the volumetric sky renders below native resolution by design (`landscape.resize` caps it at 1800px wide on `high`), so `--supersample` sharpens the timber frame, the landscape and the type more than it sharpens the clouds.

Verification: both encoders were exercised end to end — H.264 MP4 probed as 640×360 yuv420p, 16 frames, 2.000s, and VP8 WebM written through the bundled binary. Sampled frames at 12am, 6am, 12pm and 6pm showed the clock reading each target hour exactly, the sky moving from stars through dawn to daylight, and the frame assembling across the working day. Throughput under software rendering (SwiftShader, no GPU) was 0.3–1.5 frames per second depending on size and detail; a real GPU is substantially faster, so start with a short `--frames` run to gauge it.

# Sky

A fixed-view Benicia landscape with an original WebGL 2 sky inspired by the time-scrubbing interaction at oscardumlao.com. Generated landscape artwork preserves a single house beside the descending road; the surrounding homes are replaced with grassland. All runtime assets are local. No copied site code or external runtime services.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static production site in `dist`; `npm run preview` serves that build.

Drag horizontally to travel through time (one viewport = 12 hours). Scroll or use the left/right arrows; Shift + arrow moves one hour. The presets and bottom timeline also set time. Space or the pause button pauses both the clock and wind. Atmosphere controls cloud coverage, wind, and rendering detail. Reduced-motion preferences start the experience paused.

## Rendering

`src/noise.js` generates a deterministic, seamless 64³ two-channel noise texture on startup. `src/shaders.js` shapes a three-dimensional cloud layer from that texture, ray marches through it, and samples toward the light for approximate self-shadowing. It includes approximate multiple scattering, directional scattering, ambient sky illumination, distance haze, sun, moon, and stars. Atmospheric colors are artist-tuned approximations, not a physically integrated atmosphere model. The initial prototype uses value noise rather than baked production cloud assets.

`src/main.js` connects a continuous clock to sun position and cloud drift. Balanced quality uses 56 view samples; Light uses 36 and High 88. Pixel resolution is capped for GPU cost. This is an initial visual prototype, not a reproduction of Oscar's renderer; additional work on density shaping and atmospheric scattering can improve realism further.

Requires WebGL 2. All rendering stays in your browser. No accounts, API keys, or backend services.

## Fixed landscape

The default Panorama view composites `public/assets/panorama-keyed.png` beneath the procedural sky. Atmosphere → View → Open sky retains the original sky-only experience. Desktop and portrait framing use one shared image-coordinate camera mapping; portrait favors the house and descending road.

`src/landscape.js` renders the photographic artwork at display resolution while the expensive cloud pass runs at the selected lower resolution. Its fixed-view shader approximates surface lighting, warm twilight, cool moonlit terrain, distance haze, and drifting cloud shade. This is a 2D photographic composite with approximate relighting, not a depth-reconstructed terrain mesh or physical shadow simulation. Some original illumination remains in the artwork. The distant photographed water is static.

The stars now rotate as a shared field with the clock. Dragging, scrolling, time presets, and the timeline update both scene lighting and cloud movement. Pause stops automatic weather and clock movement.

See ASSETS.md for the built-in image-generation prompts and asset provenance.

## Portfolio / house frame study

`main` preserves the original one-house landscape. `house-frame-study` introduces the empty-site artwork and an Evan Gorman — Land Use Consulting portfolio concept. The practice dialog is introductory copy only; project credentials and contact information have not been invented.

`src/house.js` uses Three.js WebGPURenderer, with automatic WebGL 2 fallback, on a transparent canvas over the WebGL sky. Add `?webgl` to force the fallback for testing. The engine is loaded separately so the landscape can start before the 3D frame is ready. A calibrated affine camera aligns the 3D footprint to the photographed slab and follows the landscape's responsive crop. Its coordinate system is explicitly matched to the backend so WebGPU does not replace the custom projection on first render.

The model consists of sill plates, wall studs, a broad opening header, top plates, gable rafters, and a ridge beam. Each member grows from an anchored endpoint. With Follow time of day enabled, construction progresses from 7 a.m. to 6 p.m., stays complete overnight, and resets at 5 a.m. Dragging backward through the construction interval reverses assembly. The construction slider disables following and permits independent exploration; checking Follow time of day reattaches it. This is an illustrative daily cycle, not a real construction schedule.

Limitations: the frame is conceptual, not structurally engineered or an approved proposal. The landscape is still a photograph with approximate relighting, not a recovered depth mesh. Frame illumination follows the sun but it does not yet cast physically accurate shadows onto the photographed terrain; the photograph also cannot occlude arbitrary 3D parts without an additional depth mask. Contact details and verified project case studies remain future portfolio content.

### Panel timelapse update

The brighter blond timber frame now completes during the morning (by approximately 11:57 a.m.). Solid sheathing pops in without interpolation: rear wall at noon, left wall at 12:45 p.m., right wall at 1:30 p.m., front panels around the open garage bay at 2:15 p.m., and gables at 3 p.m. Four roof sheets arrive at 4:00, 4:20, 4:40, and 5:00 p.m. Reverse scrubbing removes panels at the same thresholds. Independent construction progress uses the same schedule mapped onto the 7 a.m.–6 p.m. interval.

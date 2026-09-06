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

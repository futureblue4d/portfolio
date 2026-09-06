# Landscape artwork

Generated with the built-in image generation tool from the user's supplied Benicia Street View reference. The scene is a reconstructed interpretation, not an exact survey or recovered 3D model.

Runtime asset: `public/assets/panorama-keyed.png` (1774 × 887). The shader removes the magenta background at the skyline and preserves the purple foreground flowers. `public/assets/panorama-landscape.png` is the first generated artwork; its checkerboard was baked in rather than a real alpha channel, so it is retained as an intermediate and is not used by the renderer.

## Initial prompt

Use case: precise-object-edit and background-extraction. Create a photorealistic landscape asset for a fixed-view interactive website, based on the attached reference. Wide 2:1 canvas, ideally 2048x1024. Preserve the reference camera position and composition: descending asphalt road with double yellow lines from bottom center into distance, golden dry grass slope filling lower right, distant blue water and soft California hills at about 55 percent from top. KEEP exactly the prominent single tan/olive house at right-center next to the road, with its broad gray gabled roof and garage, in the same position and scale. Remove ALL other houses/buildings throughout the scene, all cars, fences associated with removed houses, utility poles and signage. Reconstruct those areas naturally with rolling dry golden grass, scattered green native trees and shrubs. Keep the remaining house driveway and nearby purple flowering groundcover. Remove all Google Maps interface, overlays, text, branding and controls, reconstruct underlying scene. MOST IMPORTANT: remove the entire original blue sky and replace only the sky with genuine transparent alpha, including sky through tree branches. No clouds or sun or sky color baked into the image. Lower landscape and road fully opaque all the way to image bottom. Preserve large empty transparent upper half above the hill silhouette, do NOT crop to the landscape bounding box. Natural detailed photography with neutral soft daylight and mild shadows suitable for shader relighting, not painted, not illustration. Keep the only house around x=65 percent, y=68 percent; distant hills silhouette around y=55 percent. No additional buildings. Output a true transparent PNG landscape cutout.

## Final background correction prompt

Use case: precise-object-edit. Edit this landscape asset with exact pixel composition preservation. Keep the entire landscape, single house, trees, road, hills, water and all their positions unchanged. Replace ONLY the white/light gray checkerboard region above the hills and through the tree branches with perfectly flat solid chroma-key magenta RGB(255,0,255), hex #FF00FF. There must be NO checkerboard left, NO sky gradients, NO clouds. Preserve thin branches and foliage silhouettes against the magenta with clean edges. Keep the original wide 2:1 aspect ratio and exact framing. No transparency requested this time. The magenta will be keyed out in the web renderer. Do not recolor anything in the landscape. Output one landscape image.

## Empty-site version (house-frame-study)

The user supplied `ChatGPT Image Sep 5, 2026, 11_08_52 PM.png`, with neutral lighting and an empty concrete pad. Built-in image generation produced the runtime asset `public/assets/empty-site-keyed.png`. The 3D timber frame is generated entirely in `src/house.js`, not baked into the image.

Prompt: Use case: precise-object-edit. Production landscape texture for a fixed-view website. Keep this supplied image's EXACT composition, empty concrete building slab at right-center, road, land, trees, neutral illumination, hills, water, and camera viewpoint. Do not add any buildings, house, frame, vehicles, objects, or shadows. Change ONLY the white/gray checkerboard sky region to perfectly uniform solid chroma key magenta #FF00FF, including checkerboard between branches. Preserve all tree foliage and all distant hill silhouette detail without changing their position. No checkerboard remaining, no text, no sky gradient. Maintain the exact 1774x887 2:1 composition and slab position. This must remain an empty site; a real 3D building frame will be added by code.

## No-WebGL fallback still

`public/assets/site-fallback.png` (1400 × 700) is `empty-site-keyed.png` with the magenta chroma key resolved to a real alpha channel, using the same key formula as `src/landscape.js`. It is referenced only by the `body[data-fallback]` CSS rule, so browsers that can run the sky never download it.

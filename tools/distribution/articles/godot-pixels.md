# Diagnose blurry Godot pixel art with a still-frame test

A sharp source PNG can become soft at several different points in a Godot 4 project. Start by separating softness from uneven pixel widths and movement shimmer. They look similar during play, but changing the wrong setting can hide one symptom while leaving its cause intact.

## Start with one stationary sprite

Disable camera movement and display a small sprite at a whole-number scale. Inspect an edge with a contrasting background. A smooth colour ramp between neighbouring art pixels points to filtering. Hard edges with alternating widths point to scaling. An image that is sharp until the camera moves points to placement.

Nearest filtering chooses a texel instead of blending adjacent texels. It cannot undo smoothing already baked into a source image, and it cannot divide a screen pixel into equal pieces to accommodate a fractional scale.

## Example: work out the display scale

For a 320 by 180 viewport, both dimensions must fit the window. Use the smaller ratio, then take its floor when you require integer scaling:

```text
window = 1366 by 768
horizontal ratio = 1366 / 320 = 4.26875
vertical ratio   =  768 / 180 = 4.26666...
integer scale    = floor(min(ratios)) = 4
rendered image   = 1280 by 720
unused space     = 86 by 48
```

With a centred, aspect-preserving presentation, that unused space becomes bars. Filling the entire window would require a different presentation decision. Nearest sampling alone cannot make a 4.2666-times enlargement have equally wide art pixels.

## Apply one change at a time

1. Set the sprite's CanvasItem Texture Filter to Nearest. For a wholly pixel-art project, set the project default instead and check inheritance on child nodes.
2. Inspect the PNG import: retain Lossless compression and disable generated mipmaps for this ordinary 2D pixel-art case. Reimport after editing those settings.
3. Set the intended base viewport dimensions. For a low-resolution presentation, use viewport stretching, an appropriate aspect policy and integer scale mode.
4. Restore movement. Test camera smoothing, fractional transforms and non-integer zoom independently. Transform snapping is a project option; restart after changing a setting read at startup.

## Troubleshoot by symptom

| Symptom | Isolate it | Next action |
| --- | --- | --- |
| Soft while stationary | Inspect an enlarged edge | Check filter inheritance and the source PNG |
| Unequal hard pixel widths | Compare window and viewport ratios | Use integer scaling or change the viewport design |
| Sharp until movement | Freeze the camera, then the actor | Inspect fractional positions and snapping |
| Changed after using a 3D material | Reopen texture import settings | Check compression and mipmap changes |

## Check the result and its limits

Test both 1920 by 1080 and 1366 by 768. The first supports a 6-times enlargement of this viewport; the second supports 4 times with spare space. Save screenshots and count a few edge pixels. Then move slowly through a high-contrast scene.

Snapping trades subpixel motion for discrete steps, so evaluate it in motion rather than treating it as a universal improvement. High-resolution interfaces and pixel-art worlds may need different filter settings. These steps target Godot 4's rendering model; they are not evidence of a new engine benchmark.

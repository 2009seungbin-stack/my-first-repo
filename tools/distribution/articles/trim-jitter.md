# Stop trimmed animation frames from changing their anchor

An animation can look stable as separate images and wobble after atlas packing. Before moving any pixels, check whether the loader preserves the original canvas. Trimming changes the rectangle that stores a frame; it should not change where that frame stands in the animation.

## Two coordinate systems are involved

The packed rectangle locates pixels on the atlas. The source rectangle locates those pixels on the original frame canvas. A pivot expressed relative to the cropped rectangle is not automatically the same physical point as a pivot on the original canvas.

If a loader centres each crop independently, a narrow pose and a wide pose acquire different origins. Increasing padding around the atlas does not repair this: padding protects sampling boundaries, while trim offsets preserve placement.

## Example: restore a cropped foot position

Suppose a 64 by 64 frame uses the canvas point (32, 56) as its foot anchor. Two crops can represent that point differently:

```text
original anchor = (32, 56)
frame A crop starts at (20, 12): local anchor = (12, 44)
frame B crop starts at (17,  9): local anchor = (15, 47)

reconstruct:
A: (20, 12) + (12, 44) = (32, 56)
B: (17,  9) + (15, 47) = (32, 56)
```

Placing both local anchors at the same scene position keeps the foot fixed. Giving both crops the same local pivot would lose those differing offsets. The numbers are a coordinate example, not a measured quality score.

## Repair the data before the art

1. Keep an untrimmed export as a reference and play it using a fixed canvas origin.
2. Inspect the atlas metadata for original dimensions and crop offsets. TexturePacker-style data commonly uses sourceSize and spriteSourceSize for those jobs.
3. Confirm that the engine importer actually reads those fields. A generic rectangle reader may ignore them even though the JSON contains them.
4. Restore each crop onto the original canvas, or use the target format's offset or margin support. Derive pivots from the full canvas before converting units.
5. Inspect runtime code for a pivot or offset assignment that overrides the imported value.

## Troubleshoot remaining movement

| Observation | Likely distinction | Check |
| --- | --- | --- |
| Only packed animation wobbles | Placement data was lost | Compare reconstructed frames with original canvases |
| Both versions move identically | Motion may be drawn intentionally | Follow a fixed landmark through the source frames |
| Every other pose shifts | Crop sizes or offsets differ | Print per-frame origin data |
| Only camera movement causes shimmer | Rendering placement issue | Test the actor with a stationary camera |

## Check without erasing animation

Draw a crosshair at the intended anchor and step through frames individually. An idle foot might remain fixed, but a travelling walk or a jump must move. Pinning every frame to the first pose can erase intended translation.

Compare both the landmark position and the full silhouette. If placement metadata is correct, any remaining artistic correction should be explicit and reversible. Different engines encode origins differently, so a successful preview in one loader does not validate all export targets.

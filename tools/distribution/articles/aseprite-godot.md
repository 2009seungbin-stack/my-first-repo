# Preserve Aseprite frame timing in a Godot 4 animation

Converting an Aseprite animation to Godot requires more than cutting a PNG. The image contains visible pixels; the animation also needs frame order, named ranges and durations. Keep those three pieces together until the destination SpriteFrames resource is assembled.

## Milliseconds and relative durations

Aseprite records frame time in milliseconds. Godot 4 SpriteFrames combines an animation speed in frames per second with a relative duration for each frame. At a speed of F, a relative duration d lasts d/F seconds. Assigning every frame a duration of one silently removes the original timing variations.

## Example: convert a held attack pose

Take four frames lasting 80, 80, 140 and 300 milliseconds. Choose a SpriteFrames animation speed of 10 FPS:

```text
relative duration = milliseconds * FPS / 1000
80 ms  -> 0.8
80 ms  -> 0.8
140 ms -> 1.4
300 ms -> 3.0

source cycle = 80 + 80 + 140 + 300 = 600 ms
Godot cycle  = (0.8 + 0.8 + 1.4 + 3.0) / 10 = 0.6 s
```

The 10 FPS value is a convenient reference speed, not a request to replace all frame times with 100 milliseconds. Choosing a different reference speed is valid if the duration multipliers change consistently.

## Build and import the animation

1. Retain the .aseprite source, or export a sheet with JSON metadata that contains both durations and tags. Bare PNG frames cannot preserve those fields on their own.
2. Create one SpriteFrames animation for each intended named range. Check forward, reverse and ping-pong playback rather than inferring order from a filename sort.
3. Add each frame texture in playback order, then assign the calculated relative duration. Set looping separately from timing.
4. Attach the resource to an AnimatedSprite2D. Keep referenced textures and resource paths together when moving the exported folder under res://.
5. Select the animation explicitly and test switching to another tag. For a non-looping attack, decide what plays when animation_finished fires.

## Troubleshoot the handoff

| Symptom | Inspect | Repair |
| --- | --- | --- |
| Held pose disappears | Relative durations | Recalculate from the original milliseconds |
| All tags become one sequence | Input tag metadata | Re-export tags or rebuild named ranges |
| Blank resource | Texture paths | Keep the bundle together and let imports finish |
| Crisp source looks soft | CanvasItem filtering | Use Nearest on the pixel-art node |

## Check scope before shipping

Compare total cycle duration, first and last frames and a distinctive held pose. A stopwatch alone can miss a wrong frame order with the same total duration. Check visual placement after trimming too.

Layers may be flattened during conversion. A finite repeat count greater than one needs explicit game logic when the exporter only represents once-versus-looping. Hitbox metadata also does not automatically create collision nodes. Those are separate integration tasks, even when the animation resource loads correctly.

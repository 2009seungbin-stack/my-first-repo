# Find where Aseprite animation tags disappeared during packing

When every animation becomes one long strip after packing, inspect the packer's input before its output. A filename sequence can preserve ordering while carrying no named ranges. PNG pixels also do not tell a loader how long a pose should be displayed.

## Grouping and timing are separate fields

An Aseprite JSON export can retain per-frame duration while omitting tag metadata. That produces a subtle failure: playback speed looks right, yet idle, walk and attack are no longer separate animations. Verify both fields rather than using one successful preview as proof that all metadata survived.

## Example: export tags explicitly

When using the Aseprite command line, include the tag-list option with the sheet and JSON outputs:

```sh
aseprite -b actor.aseprite --sheet actor.png --data actor.json --list-tags
```

Then inspect the JSON. A simplified named-range fragment could look like this:

```json
{
  "frameTags": [
    { "name": "idle", "from": 0, "to": 3, "direction": "forward" },
    { "name": "walk", "from": 4, "to": 9, "direction": "forward" }
  ]
}
```

In the actual export, look under meta for frameTags. The example is only the grouping fragment, not a complete atlas file. Inclusive endpoints mean idle covers four frames and walk covers six; a mistaken exclusive endpoint drops the final pose.

## Trace the metadata through the pipeline

1. Confirm the source .aseprite file contains the intended named ranges and playback directions.
2. Export JSON and PNG together. In the export dialog, include Tags in the metadata options; in the CLI, include --list-tags.
3. Inspect the emitted JSON before packing. Check named ranges and frame durations independently.
4. Import both files, then inspect the resulting animation list. If grouping falls back to names, check whether the importer received tag metadata at all.
5. Choose an output that can represent the needed timing and ranges. Read format limitations before assuming a single-FPS or image-only destination can preserve everything.

## Troubleshoot missing information

| Symptom | Where to look | Action |
| --- | --- | --- |
| One animation, correct speed | Tag export options | Include frameTags |
| Correct names, uniform timing | Duration fields and target format | Preserve durations or document the approximation |
| Last pose missing | Inclusive range endpoints | Compare source indices |
| No names or timing in input | Bare image sequence | Rebuild metadata from the source project |

## Check more than the animation count

Select one loop, one non-looping animation and one held pose. Compare their names, order, durations and transition behaviour. A reverse or ping-pong tag needs an ordering check as well as a name check.

Keep the editable source. Information omitted before packing cannot be reliably recovered from the pixels. Finite repeat counts, pivots and collision-related metadata may have separate limitations in the destination; successful tag import does not establish support for those other fields.

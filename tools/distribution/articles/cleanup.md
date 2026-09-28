# Clean animation palettes without changing the silhouette

Pixel-art cleanup has two separate jobs: changing unwanted colours and changing occupied pixels. Treating both as one automatic operation makes it hard to tell whether a cleaner removed anti-aliasing or accidentally erased a deliberate detail. Work from the original-resolution frames and compare colour and alpha independently.

## Share the palette across the animation

If each frame chooses its own nearest colours, an apparently stationary surface can flicker as its palette changes. Start with one palette for the whole sequence. Keep an original copy and distinguish authored highlight colours from transitional shades introduced by smoothing.

A low colour count alone does not demonstrate good cleanup. A silhouette can lose a finger while the count improves. Equally, a single isolated pixel may be an intentional sparkle rather than noise.

## Example: verify two independent properties

For a small RGBA frame, check both palette membership and unchanged alpha. The simplified diagnostic below treats every nontransparent RGB value as an exact palette entry:

```js
function inspect(before, after, paletteRGB) {
  let alphaChanges = 0, outsidePalette = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (before[i + 3] !== after[i + 3]) alphaChanges++;
    const key = Array.from(after.slice(i, i + 3)).join(',');
    if (after[i + 3] && !paletteRGB.has(key)) outsidePalette++;
  }
  return { alphaChanges, outsidePalette };
}
```

Zero in both fields means those particular conditions hold; it does not certify attractive art. For a palette-only pass, alpha changes are a useful warning. A later, deliberately approved hole fill is expected to change occupancy and should be evaluated separately.

## Clean in reviewable passes

1. Recover the intended one-times resolution first. Downscaling a smoothed enlargement is a separate problem from palette cleanup.
2. Build or load one palette and preview it across all frames, including darker or brighter poses.
3. Review transition-colour replacements at an enlarged nearest-neighbour view and at normal play size.
4. Inspect stray-pixel and hole candidates individually. Apply only the changes that match the intended drawing.
5. Export lossless PNG frames, then reopen them and run the same checks on decoded output.

## Troubleshoot misleading improvements

| Observation | Possible cause | Check |
| --- | --- | --- |
| Colours flicker between poses | Per-frame palette decisions | Use a shared palette |
| Outline becomes thinner | Occupancy changed | Compare alpha and silhouette |
| Sparkles disappear | Intentional isolated pixels removed | Review each candidate |
| Colours return after export | Resampling or wrong export settings | Reopen the actual output bytes |

## Check at playback speed

An enlarged still image exposes individual pixels; normal-speed playback exposes temporal inconsistency. Use both. Preserve highlights and motion accents that only make sense in sequence. Keep the original frames alongside the cleaned export so a later palette decision can be reversed without reconstructing lost pixels.

# Test a normal map's green-channel convention with one light

If a raised edge lights from the wrong vertical direction, check the normal map's Y convention before adjusting light intensity. In the tangent-space conventions discussed here, OpenGL-style and DirectX-style maps encode opposite signs in green. The graphics API name alone does not tell you what a particular material importer expects.

## Why a horizontal test can miss the problem

Red encodes the horizontal component, green the vertical component and blue the outward component. Reversing green changes the vertical response while leaving the horizontal component intact. A light moving left to right can therefore look convincing even when an above-to-below test fails.

Use a shape with an obvious raised top edge, such as a bevelled button. A flat map has no useful vertical slope for this test. Stylized maps and ambiguous opaque textures can also resist automatic classification.

## Example: flip once and prove the round trip

For an 8-bit channel, invert green by subtracting it from 255. Preserve the other bytes:

```js
function flipGreen(rgba) {
  const copy = new Uint8ClampedArray(rgba);
  for (let i = 1; i < copy.length; i += 4) {
    copy[i] = 255 - copy[i];
  }
  return copy;
}
// [128, 218, 218, 255] -> [128, 37, 218, 255]
// Applying flipGreen twice restores every byte.
```

This is a byte operation on decoded RGBA data, not a brightness adjustment to the image. Store the result losslessly. A colour correction or lossy recompression can modify components you intended to preserve.

## Run a controlled lighting test

1. Keep the original map and make a clearly named converted copy. Record which convention each file represents.
2. Confirm the receiving shader or importer expects the chosen convention. An import-time Y inversion and an already inverted file can cancel each other.
3. Place one light above a shape whose upper-facing surface is known. Compare the original and converted map without changing any other setting.
4. Move the light to the left. If that response is inverted too, investigate red orientation or the underlying height interpretation.
5. Check the texture's colour-space handling. Normal components are data; an unintended colour transformation can change their direction.

## Troubleshoot without overcorrecting

| Result | Suspect | Next check |
| --- | --- | --- |
| Top and bottom reversed | Green sign mismatch | Flip Y once |
| Left and right reversed | Red sign mismatch | Inspect generator X convention |
| Every direction seems hollow | Shape or both signs inverted | Compare with a known height shape |
| Flipping changes nothing | No useful vertical slope | Test a curved or bevelled fixture |

## Check what the test actually proves

The round trip proves the channel operation is reversible. The light test checks agreement between a map and one rendering setup. Neither proves the normal map describes the intended shape perfectly. Preserve a reference fixture and repeat the test when changing import presets or shaders.

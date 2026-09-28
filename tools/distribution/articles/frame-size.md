# Calculate sprite-sheet cells without cumulative slicing drift

A sheet width divided by its column count gives the cell width only when there are no outer margins or gaps. If the first frame looks correct but later frames drift into their neighbours, suspect the grid pitch before redrawing the artwork.

## Separate cell size, gap and offset

The cell includes transparent space belonging to the frame. The gap lies between cells. The initial offset locates the first cell. A visible character's bounding box is not necessarily the cell boundary, so a transparent column beside its head does not prove there is a sheet gap.

For equally sized cells with the same outer margin on each side, the row width is two margins plus all cells plus one fewer gaps than cells. If margins are asymmetric, use separate left and right values in the calculation.

## Example: solve and verify the last edge

Consider five columns in a 172-pixel-wide sheet, with a 2-pixel margin on each side and 2-pixel gaps:

```text
cell width = (172 - 2*2 - (5-1)*2) / 5 = 32
pitch = cell width + gap = 34
cell starts: 2, 36, 70, 104, 138
last cell end: 138 + 32 = 170
right margin: 172 - 170 = 2
```

The last-edge check is essential. A plausible width that leaves an unexplained remainder is evidence that at least one assumption is wrong. Repeat the calculation independently for rows; vertical spacing does not have to equal horizontal spacing.

## Enter the grid deliberately

1. Measure the complete image dimensions and count cells, including intentional empty cells.
2. Identify repeated boundaries across several rows. Do not rely on a single opaque pixel to locate a cell origin.
3. Calculate width and height using margins and spacing. Require whole numbers and verify the final edge.
4. Preview outlines on the first, middle and last cells before applying a slice operation.
5. In Godot's SpriteFrames sheet dialog, map cell dimensions to Size, gaps to Separation and the starting position to Offset. In Unity's grid slicing, check Pixel Size, Padding and Offset.

## Troubleshoot a convincing but wrong grid

| Symptom | Explanation | Test |
| --- | --- | --- |
| Increasing drift across a row | Pitch is wrong | Compare the final boundary with the image edge |
| Every cell shifted equally | Starting offset is wrong | Inspect the outer border |
| Character limbs are cut | Visible bounds mistaken for cells | Include the source frame's transparent canvas |
| No regular grid fits | It may be a packed atlas | Look for a JSON rectangle file |

## Check animation order as well

Correct rectangles do not establish correct animation order. Some sheets arrange poses by row, others by named sequences, and empty cells may be intentional timing placeholders. Step through the extracted frames and compare them to the source layout.

A packed atlas with variable rectangles should use its metadata instead of a guessed uniform grid. Rotation and trimming add their own interpretation rules; a successful grid calculation does not validate those formats.

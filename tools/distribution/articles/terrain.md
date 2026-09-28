# Debug Godot terrain gaps with a tiny neighbourhood map

When terrain painting leaves an empty cell or adds an unexpected inner corner, start with the tile patterns available to the terrain set. A correctly sized image can still lack a tile for the neighbourhood you just painted. Changing the tile size cannot supply that missing pattern.

## Match rules and artwork must agree

Godot 4 terrain sets describe how tiles connect through terrain values on their peering positions. Matching sides is a different rule from matching corners and sides. A sheet designed for one rule cannot safely be treated as an arbitrary collection of cells under another.

Also distinguish the terrain set from the terrain within that set. Tiles and the selected brush must refer to compatible definitions. A populated atlas is not evidence that those assignments are complete.

## Example: a test map that exposes missing cases

Use tiny shapes before painting a whole level. In this notation X is the terrain being tested and dots are empty cells:

```text
isolated    horizontal    vertical    inner corner
...         .....        ...         XXX
.X.         .XXX.        .X.         X.X
...         .....        .X.         XXX
                         .X.
                         ...
```

An isolated tile needs empty neighbours around it. A one-cell-wide horizontal strip needs a different set of side connections from a solid block. The centre hole exercises inward-facing corners. A set that handles a rectangle can still fail these small shapes.

## Diagnose in a fixed order

1. Confirm the brush's terrain set and terrain ID, then inspect those assignments on the candidate tiles.
2. Read the terrain set's matching mode and compare it to the layout the artwork was drawn for.
3. Inspect peering positions around a failing cell. Write down which neighbours should connect before changing bits.
4. Search for a tile that represents that exact case. Missing art needs a new tile or a different layout; relabelling an unrelated picture only hides the omission.
5. Paint each small fixture into a fresh area. Repeat the fill in a different order if an incomplete set behaves inconsistently.

## Troubleshoot the failure shape

| Failure | Inspect first | Practical correction |
| --- | --- | --- |
| Single cell vanishes | Isolated pattern | Add or correctly assign that tile |
| Narrow strip fails | Opposite empty sides | Supply strip and endpoint cases |
| Extra inner corner | Corner bits and coverage | Compare the expected neighbourhood with the tile |
| All painting seems unrelated | Set and terrain IDs | Align brush and tile assignments |

## Check the actual engine result

Keep a copy of the original TileSet and compare a repaired resource in a small scene. Inspect whether a cell is really empty rather than assuming transparent art means nothing was placed. Verify collision separately; visually connected tiles do not guarantee continuous physics shapes.

If you rebuild from an image, retain any hand-authored settings until the replacement is checked. A pattern preview is useful evidence about coverage, but it cannot guarantee every result of every painting order in an incomplete set.

/** What each Tile export has been checked with, shown next to the target in the Export panel and
 * written into NOTES.txt. Only claims that tools/engine-verify/tile/ actually ran belong here
 * (docs/STUDIO-TILE.md has the numbers). status: 'verified' | 'partial' | 'unverified'. */
export const VERIFY=Object.freeze({
 godot:{status:'verified',detail:'Godot 4.7.2: TileSet built by the shipped importer and painted with set_cells_terrain_connect; every cell equals the Studio painter on 9 corpus sheets (blob-47, 16-edge, 16-corner, dual-grid with 4 terrains).'},
 tiled:{status:'verified',detail:'Tiled 1.12.2 (its own --export-tileset/--export-map readers and tmxrasterizer): every Wang ID read as written, the sample map is a valid Wang tiling in Tiled and renders pixel-exact, on 12 corpus sets. The terrain brush itself was not driven (Tiled scripting does not run headless on Windows).'},
 ldtk:{status:'partial',detail:'LDtk 1.5.3 JSON schema and the official LDtk QuickType loader accept every export, and an independent re-run of the rules gives the exported tiles on 12 corpus sets. Not opened in the LDtk app (no command line).'},
 unity:{status:'verified',detail:'Unity 6000.5.3f1 + 2D Tilemap Extras 8.0.3 (batch mode): the shipped script builds the RuleTiles, a painted Tilemap shows the Studio's predicted sprite in every cell on 10 corpus sets (sprite rects and pixels exact, Point/Uncompressed). One RuleTile per terrain: Unity draws no transitions between terrains. Corner / dual-grid sets are not exported to Unity.'},
 generic:{status:'verified',detail:'Plain PNG + JSON; the numbers are unit-tested (tests/tiles.test.mjs).'}
});

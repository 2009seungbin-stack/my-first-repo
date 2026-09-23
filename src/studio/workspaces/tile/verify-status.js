/** What each Tile export has been checked with, shown next to the target in the Export panel and
 * written into NOTES.txt. Only claims that tools/engine-verify/tile/ actually ran belong here
 * (docs/STUDIO-TILE.md has the numbers). status: 'verified' | 'unverified'. */
export const VERIFY=Object.freeze({
 godot:{status:'verified',detail:'Godot 4.7.2: TileSet built by the shipped importer and painted with set_cells_terrain_connect; every cell equals the Studio painter on 9 corpus sheets (blob-47, 16-edge, 16-corner, dual-grid with 4 terrains).'},
 tiled:{status:'unverified',detail:'Not yet loaded in Tiled itself.'},
 ldtk:{status:'unverified',detail:'Not yet loaded in LDtk itself.'},
 unity:{status:'unverified',detail:'Not yet built in Unity.'},
 generic:{status:'verified',detail:'Plain PNG + JSON; the numbers are unit-tested (tests/tiles.test.mjs).'}
});

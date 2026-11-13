Nerulio sprite-grid spacing case study, 2026-11-14 Korea time.

Input: Kenney Tiny Dungeon 1.0, 203x186 PNG, CC0.
Original: https://kenney.nl/assets/tiny-dungeon
Bundled license: tests/fixtures/kenney/License.txt in the source repository.
Input SHA-256: 5653222ac495d89e942f9b636300759b3f38e85b26e9b888676f2e9ab834095a

Reproduce from the recorded source commit with the repository's Node and Python test dependencies:
python tools/editorial/measure-sprite-grid.py
python tools/editorial/measure-sprite-grid.py --browser firefox

Each browser folder contains the exact input, downloaded Phaser-format bundles,
UI captures, last-frame PNGs, an annotated nearest-neighbour comparison and measurements.json.
The measurements record the actual applied grid, every selected source rectangle,
independent Pillow reconstruction checks, browser/Pillow versions and source commit.

Reference condition: 16x16 cells, no outer margin, 1px horizontal and vertical gaps.
Comparison condition: the same cells and margin, 0px horizontal and vertical gaps.
RGB values below alpha=0 are ignored; visible RGBA samples are compared exactly.
This is file reconstruction, not a native Phaser or Godot runtime test or human visual review.
These files are benchmark assets, not the user's own game artwork.

audit.json records generated ZIP paths, hashes and a scan for known credential patterns.

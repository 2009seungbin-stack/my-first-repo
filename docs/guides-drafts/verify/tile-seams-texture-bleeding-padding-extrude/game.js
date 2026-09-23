// Tile seam reproduction harness. Query: ?pixelArt=0|1&sheet=orig|ext|ext2&gpu=0|1&zoom=2.37&sx=3.3&sy=5.7&round=0|1
const q = new URLSearchParams(location.search);
const PIXEL_ART = q.get('pixelArt') === '1';
const SHEET = q.get('sheet') || 'orig';
const GPU = q.get('gpu') === '1';
const ZOOM = parseFloat(q.get('zoom') || '2.37');
const SX = parseFloat(q.get('sx') || '3.3');
const SY = parseFloat(q.get('sy') || '5.7');
const ROUND = q.get('round');

// Kenney Tiny Dungeon (CC0): 16x16 tiles, 12 columns, 1 px spacing, no margin.
const SHEETS = {
  orig: { file: 'tiny-dungeon.png', margin: 0, spacing: 1 },
  ext:  { file: 'tiny-dungeon-extruded.png', margin: 1, spacing: 3 },  // tile-extruder -e 1
  ext2: { file: 'tiny-dungeon-extruded2.png', margin: 2, spacing: 5 }, // tile-extruder -e 2
};

// 14 x 9 room: stone wall border (40), brown floor (0), rubble floors (12, 24), sand patch (48-53).
const W = 14, H = 9;
const data = [];
for (let y = 0; y < H; y++) {
  const row = [];
  for (let x = 0; x < W; x++) {
    let t = 0;
    if (y === 0 || y === H - 1 || x === 0 || x === W - 1) t = 40;
    else if (x >= 8 && x <= 11 && y >= 4 && y <= 6) t = 48 + ((x + y) % 3);
    else if ((x * 7 + y * 3) % 11 === 0) t = 12;
    else if ((x * 5 + y * 2) % 13 === 0) t = 24;
    row.push(t);
  }
  data.push(row);
}

window.RESULT = { errors: [] };
window.onerror = (m) => { window.RESULT.errors.push(String(m)); };

class Scene extends Phaser.Scene {
  preload() { this.load.image('tiles', SHEETS[SHEET].file); }
  create() {
    const s = SHEETS[SHEET];
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    // addTilesetImage(tilesetName, key, tileWidth, tileHeight, tileMargin, tileSpacing)
    const tileset = map.addTilesetImage('tiles', 'tiles', 16, 16, s.margin, s.spacing);
    const layer = GPU ? map.createLayer(0, tileset, 0, 0, true) : map.createLayer(0, tileset, 0, 0);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#ff00ff'); // magenta: any seam that lets the background through shows up
    cam.setZoom(ZOOM);
    // Phaser zooms around the camera centre; shift the scroll so the view's top-left world point is (SX, SY).
    cam.setScroll(SX - (480 / 2) * (1 - 1 / ZOOM), SY - (300 / 2) * (1 - 1 / ZOOM));
    if (ROUND !== null) cam.setRoundPixels(ROUND === '1');
    this.game.events.once('postrender', () => {
      window.RESULT.version = Phaser.VERSION;
      window.RESULT.mapRect = { x: -SX * ZOOM, y: -SY * ZOOM, w: 224 * ZOOM, h: 144 * ZOOM };
      window.RESULT.config = { pixelArt: PIXEL_ART, sheet: SHEET, gpu: GPU, zoom: ZOOM, sx: SX, sy: SY,
        antialias: this.game.config.antialias, roundPixels: this.game.config.roundPixels, camRound: cam.roundPixels,
        layerType: layer.type };
      window.DONE = true;
    });
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  width: 480, height: 300,
  pixelArt: PIXEL_ART,
  backgroundColor: '#ff00ff',
  scene: Scene,
  banner: false,
});

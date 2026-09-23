// Nerulio engine-verify probe for the Studio Tile "Unity Rule Tiles" export. NOT shipped to users.
//
// tools/engine-verify/tile/unity_tile.py copies the exported bundle (PNG, nerulio-ruletile.json,
// Editor/NerulioRuleTileImporter.cs) into Assets/Bundle/ of a throw-away project that has the 2D
// Tilemap Extras package, puts this file in Assets/VerifyEditor/Editor/ and runs
//   Unity -batchmode -quit -projectPath <p> -executeMethod NerulioTileProbe.Run -logFile <log>
// The probe builds the RuleTiles WITH THE IMPORTER THE BUNDLE SHIPS (NerulioRuleTileImporter.Build),
// reloads them from disk, reads back the texture import settings and every sprite (rect + pixels
// against the PNG decoded independently), then paints each case of _verify/job.json on a fresh
// Tilemap (one SetTile per terrain cell; our (x,y) is Unity cell (x,-y) because Unity's y is up),
// refreshes, and reports the sprite Unity chose for every cell. Judging happens in Python.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.Tilemaps;

public static class NerulioTileProbe
{
    [Serializable] class Case { public string name; public int[] flat; }
    [Serializable] class Job { public string json; public string png; public int[] terrainOrder; public Case[] cases; }
    static string Q(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") + "\"";
    static string F(float v) => v.ToString("R", CultureInfo.InvariantCulture);

    public static void Run()
    {
        string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "_verify"));
        Directory.CreateDirectory(outDir);
        var errors = new List<string>();
        var sb = new StringBuilder();
        string settings = "null", sprites = "[]", cases = "{}", tiles = "[]", package = "\"\"";
        try
        {
            var job = JsonUtility.FromJson<Job>(File.ReadAllText(Path.Combine(outDir, "job.json")));
            var pkgs = UnityEditor.PackageManager.PackageInfo.GetAllRegisteredPackages();
            var extras = pkgs.FirstOrDefault(p => p.name == "com.unity.2d.tilemap.extras");
            package = Q(extras == null ? "" : extras.name + "@" + extras.version + " (" + extras.source + ")");
            if (extras == null) throw new Exception("com.unity.2d.tilemap.extras is not installed in this project");
            List<string> written = NerulioRuleTileImporter.Build(job.json);
            AssetDatabase.Refresh();
            string folder = Path.GetDirectoryName(job.json).Replace('\\', '/');
            string texturePath = folder + "/" + job.png;
            var ti = (TextureImporter)AssetImporter.GetAtPath(texturePath);
            settings = "{\"textureType\":" + Q(ti.textureType.ToString()) + ",\"spriteImportMode\":" + Q(ti.spriteImportMode.ToString()) +
                       ",\"filterMode\":" + Q(ti.filterMode.ToString()) + ",\"compression\":" + Q(ti.textureCompression.ToString()) +
                       ",\"mipmaps\":" + (ti.mipmapEnabled ? "true" : "false") + ",\"pixelsPerUnit\":" + F(ti.spritePixelsPerUnit) + "}";
            // pixels: make the texture readable (after the settings above were recorded) and compare every
            // sprite with the same region of the PNG decoded on its own
            ti.isReadable = true; ti.SaveAndReimport();
            var reference = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            reference.LoadImage(File.ReadAllBytes(Path.GetFullPath(Path.Combine(Application.dataPath, "..", texturePath))));
            var spriteList = AssetDatabase.LoadAllAssetsAtPath(texturePath).OfType<Sprite>().OrderBy(s => s.name).ToList();
            var sp = new List<string>();
            foreach (var s in spriteList)
            {
                Rect r = s.rect; int x = (int)r.x, y = (int)r.y, w = (int)r.width, h = (int)r.height;
                Color32[] a = s.texture.GetPixels32();
                Color32[] b = reference.GetPixels32();
                int diff = 0;
                for (int yy = 0; yy < h; yy++) for (int xx = 0; xx < w; xx++)
                {
                    Color32 p = a[(y + yy) * s.texture.width + x + xx], q = b[(y + yy) * reference.width + x + xx];
                    if (p.a != q.a || (q.a > 0 && (p.r != q.r || p.g != q.g || p.b != q.b))) diff++;
                }
                sp.Add("{\"name\":" + Q(s.name) + ",\"rect\":[" + x + "," + y + "," + w + "," + h + "],\"diff\":" + diff + ",\"ppu\":" + F(s.pixelsPerUnit) + "}");
            }
            sprites = "[" + string.Join(",", sp) + "]";
            // reload the RuleTiles from disk (not the objects the importer still holds)
            var ruleTiles = new Dictionary<int, RuleTile>();
            var tl = new List<string>();
            for (int i = 0; i < written.Count; i++)
            {
                var rt = AssetDatabase.LoadAssetAtPath<RuleTile>(written[i]);
                if (rt == null) { errors.Add("RuleTile did not reload: " + written[i]); continue; }
                ruleTiles[job.terrainOrder[i]] = rt;
                tl.Add("{\"path\":" + Q(written[i]) + ",\"terrain\":" + job.terrainOrder[i] + ",\"rules\":" + rt.m_TilingRules.Count + ",\"default\":" + Q(rt.m_DefaultSprite ? rt.m_DefaultSprite.name : "") + "}");
            }
            tiles = "[" + string.Join(",", tl) + "]";
            var gridGo = new GameObject("Grid", typeof(Grid));
            var cs = new List<string>();
            foreach (var c in job.cases)
            {
                var go = new GameObject("Map_" + c.name, typeof(Tilemap), typeof(TilemapRenderer));
                go.transform.SetParent(gridGo.transform);
                var map = go.GetComponent<Tilemap>();
                for (int i = 0; i + 2 < c.flat.Length; i += 3)
                    if (ruleTiles.TryGetValue(c.flat[i + 2], out var rt)) map.SetTile(new Vector3Int(c.flat[i], -c.flat[i + 1], 0), rt);
                map.RefreshAllTiles();
                var picks = new List<string>();
                for (int i = 0; i + 2 < c.flat.Length; i += 3)
                {
                    var s = map.GetSprite(new Vector3Int(c.flat[i], -c.flat[i + 1], 0));
                    picks.Add(Q(c.flat[i] + "," + c.flat[i + 1]) + ":" + Q(s ? s.name : ""));
                }
                cs.Add(Q(c.name) + ":{" + string.Join(",", picks) + "}");
                UnityEngine.Object.DestroyImmediate(go);
            }
            cases = "{" + string.Join(",", cs) + "}";
        }
        catch (Exception e) { errors.Add(e.GetType().Name + ": " + e.Message); }
        sb.Append("{\"unity\":" + Q(Application.unityVersion) + ",\"package\":" + package + ",\"settings\":" + settings + ",\"sprites\":" + sprites +
                  ",\"ruleTiles\":" + tiles + ",\"cases\":" + cases + ",\"errors\":[" + string.Join(",", errors.Select(Q)) + "]}");
        File.WriteAllText(Path.Combine(outDir, "report.json"), sb.ToString());
        Debug.Log("NERULIO_TILE_UNITY_DONE errors=" + errors.Count);
    }
}

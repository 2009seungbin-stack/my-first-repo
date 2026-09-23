/** Unity Rule Tile export: a JSON rule list + an editor script that builds real RuleTile assets
 * inside Unity (2D Tilemap Extras package, com.unity.2d.tilemap.extras). Pure. No .asset or .meta is
 * written here — Unity writes them itself when the script runs.
 *
 * One RuleTile per terrain. Every tile of that terrain becomes one tiling rule over the 8
 * neighbours (Unity grid, y UP): This (1) where the pattern connects, NotThis (2) where it does not,
 * nothing where it does not matter (a corner behind an open side, a position the mode ignores).
 * Rules are ordered most specific first because a RuleTile uses the first rule that matches.
 * Corner (dual-grid) sets cannot be expressed as a RuleTile placed on terrain cells and are left
 * out (`skipped`). */
import {MODE_IDX,CORNER_SIDES,OFFSETS} from './patterns.js';
export function unityRules(ts,{imageName,width,height}){
 const g=ts.grid,out={format:'nerulio-unity-ruletile',version:1,image:imageName,width,height,tileWidth:g.w,tileHeight:g.h,pixelsPerUnit:g.w,sprites:[],terrains:[],skipped:null};
 if(ts.mode==='corners'){out.skipped='corner / dual-grid sets need tiles on grid points; a RuleTile draws on cells';return out;}
 const spriteName=(c,r)=>`tile_${c}_${r}`;
 for(const [k,v] of Object.entries(ts.tiles)){
  const [c,r]=k.split(',').map(Number),x=g.ox+c*(g.w+g.sx),y=g.oy+r*(g.h+g.sy);
  if(v.pattern[0]<0)continue;
  out.sprites.push({name:spriteName(c,r),x,y:height-(y+g.h),w:g.w,h:g.h});// Unity rects are bottom-left based
 }
 ts.terrains.forEach((terrain,t)=>{
  const rules=[];let full=null;
  for(const [k,v] of Object.entries(ts.tiles)){
   const p=v.pattern;if(p[0]!==t)continue;const [c,r]=k.split(',').map(Number);
   const n=[];
   for(const i of MODE_IDX[ts.mode]){
    if(i%2===1&&ts.mode==='corners-and-sides'){const [s1,s2]=CORNER_SIDES[i];if(p[s1+1]!==t||p[s2+1]!==t)continue;}
    const [dx,dy]=OFFSETS[i];n.push([dx,-dy,p[i+1]===t?1:2]);
   }
   if(MODE_IDX[ts.mode].every(i=>p[i+1]===t))full=spriteName(c,r);
   rules.push({sprite:spriteName(c,r),col:c,row:r,neighbors:n});
  }
  rules.sort((a,b)=>b.neighbors.length-a.neighbors.length||a.row-b.row||a.col-b.col);
  if(rules.length)out.terrains.push({name:terrain.name,index:t,defaultSprite:full||rules[0].sprite,rules});
 });
 return out;
}
export const UNITY_RULETILE_SCRIPT=`// NerulioRuleTileImporter.cs — builds Unity RuleTile assets from a Nerulio Studio (Tile) export.
// Needs the 2D Tilemap Extras package (com.unity.2d.tilemap.extras) and the 2D Sprite package.
// 1. Copy the PNG and nerulio-ruletile.json into Assets/ (same folder).
// 2. Put this file in any folder named "Editor".
// 3. Select the JSON in the Project window and run Tools > Nerulio > Build Rule Tiles.
// It slices the PNG into sprites (Point filter, no compression) and writes one RuleTile per terrain
// next to the JSON: <Terrain>.asset. Paint them on a Tilemap.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;
using UnityEngine.Tilemaps;

public static class NerulioRuleTileImporter
{
    [Serializable] public class SpriteEntry { public string name; public int x, y, w, h; }
    [Serializable] public class Rule { public string sprite; public int col, row; public int[] flat; }
    [Serializable] public class Terrain { public string name; public int index; public string defaultSprite; public Rule[] rules; }
    [Serializable] public class Export { public string format; public string image; public int width, height, tileWidth, tileHeight; public float pixelsPerUnit; public SpriteEntry[] sprites; public Terrain[] terrains; }

    [MenuItem("Tools/Nerulio/Build Rule Tiles")]
    public static void BuildSelected()
    {
        string path = AssetDatabase.GetAssetPath(Selection.activeObject);
        if (string.IsNullOrEmpty(path) || !path.EndsWith(".json")) { Debug.LogError("Nerulio: select nerulio-ruletile.json first."); return; }
        Build(path);
    }

    /// Returns the asset paths of the RuleTiles it wrote.
    public static List<string> Build(string jsonAssetPath)
    {
        var export = JsonUtility.FromJson<Export>(File.ReadAllText(jsonAssetPath));
        string folder = Path.GetDirectoryName(jsonAssetPath).Replace('\\\\', '/');
        string texturePath = folder + "/" + export.image;
        var importer = (TextureImporter)AssetImporter.GetAtPath(texturePath);
        if (importer == null) throw new Exception("Nerulio: " + texturePath + " is not in the project");
        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = export.pixelsPerUnit;
        importer.filterMode = FilterMode.Point;
        importer.mipmapEnabled = false;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.SaveAndReimport();
        var factory = new SpriteDataProviderFactories();
        factory.Init();
        ISpriteEditorDataProvider provider = factory.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();
        var rects = new List<SpriteRect>();
        foreach (var s in export.sprites)
            rects.Add(new SpriteRect { name = s.name, spriteID = GUID.Generate(), rect = new Rect(s.x, s.y, s.w, s.h), pivot = new Vector2(0.5f, 0.5f), alignment = SpriteAlignment.Center });
        provider.SetSpriteRects(rects.ToArray());
        provider.Apply();
        AssetDatabase.ImportAsset(texturePath, ImportAssetOptions.ForceUpdate);
        var sprites = AssetDatabase.LoadAllAssetsAtPath(texturePath).OfType<Sprite>().ToDictionary(s => s.name);
        var written = new List<string>();
        foreach (var terrain in export.terrains)
        {
            var tile = ScriptableObject.CreateInstance<RuleTile>();
            tile.m_DefaultSprite = sprites[terrain.defaultSprite];
            tile.m_DefaultColliderType = Tile.ColliderType.None;
            foreach (var rule in terrain.rules)
            {
                var r = new RuleTile.TilingRule();
                r.m_Sprites = new[] { sprites[rule.sprite] };
                r.m_ColliderType = Tile.ColliderType.None;
                r.m_NeighborPositions = new List<Vector3Int>();
                r.m_Neighbors = new List<int>();
                for (int i = 0; i + 2 < rule.flat.Length; i += 3)
                {
                    r.m_NeighborPositions.Add(new Vector3Int(rule.flat[i], rule.flat[i + 1], 0));
                    r.m_Neighbors.Add(rule.flat[i + 2]); // 1 = This, 2 = NotThis
                }
                tile.m_TilingRules.Add(r);
            }
            string safe = string.Concat(terrain.name.Select(ch => char.IsLetterOrDigit(ch) ? ch : '_'));
            string outPath = folder + "/" + (safe.Length > 0 ? safe : "Terrain" + terrain.index) + ".asset";
            AssetDatabase.CreateAsset(tile, outPath);
            written.Add(outPath);
        }
        AssetDatabase.SaveAssets();
        Debug.Log("Nerulio: wrote " + written.Count + " RuleTile(s): " + string.Join(", ", written));
        return written;
    }
}
`;
/** JsonUtility cannot read nested arrays, so neighbours travel flat: [dx,dy,kind, dx,dy,kind, …]. */
export function unityJSON(rules){return {...rules,terrains:rules.terrains.map(t=>({...t,rules:t.rules.map(r=>({sprite:r.sprite,col:r.col,row:r.row,flat:r.neighbors.flat()}))}))};}

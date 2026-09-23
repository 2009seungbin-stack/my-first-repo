/** Unity 6 export: the atlas pages, a JSON with every rect already in Unity's conventions, and an
 * Editor script (NerulioSpriteImporter.cs) that sets the textures to Sprite / Multiple / Point /
 * Uncompressed, writes one SpriteRect per frame through ISpriteEditorDataProvider, and builds one
 * AnimationClip per tag (SpriteRenderer.m_Sprite keyframes with each frame's own duration).
 *
 * Verified in Unity 6000.5.3f1 batch mode by tools/engine-verify (the probe calls the shipped
 * importer's Apply and CreateClips and reads back rects, pivots, pixels and clip keyframes).
 * No `.meta` file is written: Unity makes its own when the files are imported.
 *
 * Conversions: rect y = pageHeight − (y + h) (Unity textures start bottom-left); pivot normalised
 * inside the sprite rect, y up, from the pivot on the full frame canvas (so a trimmed frame's pivot
 * may lie outside 0…1 — which is what keeps it aligned with the other frames). */
import {frameRows,playback,frameKeys,pageNames,stemOf,round,requireNoRotation,GENERATOR,SCHEMA_VERSION,json} from './common.js';
export function unityData(model,variant,{base=stemOf(model.name),pixelsPerUnit=100}={}){
 requireNoRotation(variant,'Unity sprite rects');
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant);
 const sprites=[],seen=new Set();
 for(const r of rows){
  const H=variant.pages[r.page].height,px=r.pivotPx.x-r.ox,py=r.pivotPx.y-r.oy;
  sprites.push({name:r.key,page:r.page,rect:{x:r.x,y:H-(r.y+r.h),width:r.w,height:r.h},
   pivot:{x:round(px/r.w),y:round((r.h-py)/r.h)},border:{x:0,y:0,z:0,w:0},alignment:9});
  seen.add(r.key);
 }
 const clips=playback(model,keys).map(a=>({name:a.name,fps:a.fps,loop:a.loop,frames:a.steps.map(s=>({sprite:s.key,durationMs:round(s.ms,3)}))}));
 return {schemaVersion:SCHEMA_VERSION,engineTarget:'unity-2022',generator:{...GENERATOR},
  meta:{engineTarget:'unity-2022',image:names[0],images:names,pages:names.length,pageSizes:variant.pages.map(p=>({w:p.width,h:p.height})),scale:variant.scale},
  unity:{verified:true,pixelsPerUnit,textures:names.map((image,i)=>({image,width:variant.pages[i].width,height:variant.pages[i].height})),sprites,clips}};
}
export const UNITY_IMPORTER=`// NerulioSpriteImporter.cs - applies a Nerulio Studio export to its textures and builds clips.
// Put this file in any folder called "Editor", the PNG page(s) and the .json anywhere under Assets/,
// then Tools > Nerulio > Import Studio JSON and pick the .json.
// Verified in Unity 6000.5.3f1 (docs/STUDIO-PACK.md in the Nerulio repository).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class NerulioSpriteImporter
{
    [Serializable] private class Vec { public float x, y; }
    [Serializable] private class Rect4 { public float x, y, width, height; }
    [Serializable] private class Border { public float x, y, z, w; }
    [Serializable] private class SpriteEntry { public string name; public int page; public Rect4 rect; public Vec pivot; public Border border; public int alignment; }
    [Serializable] private class TextureEntry { public string image; public int width, height; }
    [Serializable] private class ClipFrame { public string sprite; public float durationMs; }
    [Serializable] private class ClipEntry { public string name; public float fps; public bool loop; public ClipFrame[] frames; }
    [Serializable] private class UnityBlock { public bool verified; public float pixelsPerUnit = 100f; public TextureEntry[] textures; public SpriteEntry[] sprites; public ClipEntry[] clips; }
    [Serializable] private class Export { public UnityBlock unity; }

    [MenuItem("Tools/Nerulio/Import Studio JSON")]
    public static void ImportSelected()
    {
        string jsonPath = EditorUtility.OpenFilePanel("Nerulio Studio export", Application.dataPath, "json");
        if (string.IsNullOrEmpty(jsonPath)) return;
        Import(jsonPath);
    }

    /// Applies every page and builds the clips. Also callable from your own editor scripts.
    public static void Import(string jsonPath)
    {
        Export export = JsonUtility.FromJson<Export>(File.ReadAllText(jsonPath));
        if (export?.unity?.sprites == null || export.unity.sprites.Length == 0)
        {
            Debug.LogError("Nerulio: that file has no \\"unity\\" block. Export with the Unity preset.");
            return;
        }
        string folder = Path.GetDirectoryName(jsonPath);
        for (int page = 0; page < export.unity.textures.Length; page++)
        {
            string texturePath = ToAssetPath(Path.Combine(folder, export.unity.textures[page].image));
            if (texturePath == null) { Debug.LogError($"Nerulio: {export.unity.textures[page].image} is not inside this project's Assets folder."); return; }
            Apply(texturePath, export.unity, page);
        }
        CreateClips(ToAssetPath(folder), export.unity);
        AssetDatabase.Refresh();
    }

    private static string ToAssetPath(string absolute)
    {
        string full = Path.GetFullPath(absolute).Replace('\\\\', '/');
        string root = Path.GetFullPath(Application.dataPath).Replace('\\\\', '/');
        return full.StartsWith(root, StringComparison.OrdinalIgnoreCase) ? "Assets" + full.Substring(root.Length) : null;
    }

    private static void Apply(string texturePath, UnityBlock block, int page)
    {
        var importer = (TextureImporter)AssetImporter.GetAtPath(texturePath);
        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = block.pixelsPerUnit;
        // Pixel art: no filtering, no compression, no mipmaps. Change these if your art is not pixel art.
        importer.filterMode = FilterMode.Point;
        importer.mipmapEnabled = false;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.maxTextureSize = Math.Max(importer.maxTextureSize, NextPow2(Math.Max(block.textures[page].width, block.textures[page].height)));
        importer.SaveAndReimport();

        var factory = new SpriteDataProviderFactories();
        factory.Init();
        ISpriteEditorDataProvider provider = factory.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();
        var rects = new List<SpriteRect>();
        foreach (SpriteEntry entry in block.sprites)
        {
            if (entry.page != page) continue;
            rects.Add(new SpriteRect
            {
                name = entry.name,
                spriteID = GUID.Generate(),
                rect = new Rect(entry.rect.x, entry.rect.y, entry.rect.width, entry.rect.height),
                pivot = new Vector2(entry.pivot.x, entry.pivot.y),
                alignment = SpriteAlignment.Custom,
                border = new Vector4(entry.border.x, entry.border.y, entry.border.z, entry.border.w)
            });
        }
        provider.SetSpriteRects(rects.ToArray());
        provider.Apply();
        AssetDatabase.ImportAsset(texturePath, ImportAssetOptions.ForceUpdate);
        Debug.Log($"Nerulio: applied {rects.Count} sprite rect(s) to {texturePath}.");
    }

    private static int NextPow2(int v) { int p = 32; while (p < v) p *= 2; return p; }

    /// One AnimationClip per tag: SpriteRenderer.m_Sprite keyframes at each frame's own start time,
    /// plus a closing key so the last frame keeps its duration. Written next to the JSON.
    private static void CreateClips(string folder, UnityBlock block)
    {
        if (block.clips == null || folder == null) return;
        var sprites = new Dictionary<string, Sprite>();
        foreach (TextureEntry t in block.textures)
            foreach (Sprite s in AssetDatabase.LoadAllAssetsAtPath(folder + "/" + t.image).OfType<Sprite>())
                sprites[s.name] = s;
        foreach (ClipEntry c in block.clips)
        {
            var keys = new List<ObjectReferenceKeyframe>();
            float time = 0f;
            foreach (ClipFrame f in c.frames)
            {
                if (!sprites.TryGetValue(f.sprite, out Sprite sprite)) { Debug.LogError($"Nerulio: clip {c.name} names a missing sprite {f.sprite}"); continue; }
                keys.Add(new ObjectReferenceKeyframe { time = time, value = sprite });
                time += f.durationMs / 1000f;
            }
            if (keys.Count == 0) continue;
            keys.Add(new ObjectReferenceKeyframe { time = time, value = keys[keys.Count - 1].value });
            var clip = new AnimationClip { frameRate = Math.Max(1f, c.fps), name = c.name };
            var binding = EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite");
            AnimationUtility.SetObjectReferenceCurve(clip, binding, keys.ToArray());
            var settings = AnimationUtility.GetAnimationClipSettings(clip);
            settings.loopTime = c.loop;
            AnimationUtility.SetAnimationClipSettings(clip, settings);
            string path = folder + "/" + c.name + ".anim";
            AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(clip, path);
        }
        AssetDatabase.SaveAssets();
    }
}
`;
export function unityFiles(model,variant,{base=stemOf(model.name),pixelsPerUnit=100}={}){
 const data=unityData(model,variant,{base,pixelsPerUnit}),notes=[];
 if(model.frames.some(f=>(f.collision||[]).length))notes.push('Collision polygons are not written as Unity physics shapes by this importer (not verified yet); they are in the generic JSON.');
 if(model.frames.some(f=>(f.boxes||[]).length))notes.push('Hitboxes have no Unity sprite field; they are in the generic JSON.');
 return {files:[{name:`${base}${variant.suffix}.unity.json`,text:json(data),type:'application/json'},
  {name:'Editor/NerulioSpriteImporter.cs',text:UNITY_IMPORTER,type:'text/plain'},
  {name:'README-UNITY.md',type:'text/markdown',text:`# Unity 6 (tested in 6000.5.3f1)

1. Copy this folder into your project's \`Assets/\` (keep the PNG${data.meta.pages>1?'s':''} next to the JSON).
2. The \`Editor/\` folder holds \`NerulioSpriteImporter.cs\`; Unity compiles it.
3. **Tools › Nerulio › Import Studio JSON** and pick \`${base}${variant.suffix}.unity.json\`.

The importer sets the texture to Sprite (2D and UI), Multiple, Point (no filter), no compression, no
mipmaps, Pixels Per Unit ${pixelsPerUnit}; it writes one sprite per frame with its pivot, and one
\`.anim\` clip per tag (SpriteRenderer sprite keys, each frame's own duration, loop as tagged).
Add the clips to an Animator Controller, or drop a sprite into the scene and drag a clip onto it.

The \`com.unity.2d.sprite\` package (in every 2D template) must be installed.
`}],notes,images:data.meta.images};
}

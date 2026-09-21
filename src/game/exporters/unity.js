/** Unity export: the generic envelope with `engineTarget:"unity-2022"`, every coordinate already
 * converted to Unity's conventions, plus a C# Editor script that applies them.
 *
 * **UNVERIFIED.** Unity is not installed on the machine this was written on, so the C# script has
 * never been run inside the editor. The coordinate conversions below are unit-tested numerically
 * (tests/game-exporters.test.mjs), and they are documented so a Unity user can check them in a
 * minute, but "the importer applies these rects correctly" is a claim this project has not earned.
 * Treat the script as a starting point, not as a tested importer. No `.meta` file is generated —
 * writing Unity's own asset metadata by hand is exactly the kind of guess this project refuses.
 *
 * The conversions, each of which is a place a sprite ends up subtly wrong if it is skipped:
 *  * **Texture origin.** Unity's texture space starts at the bottom-left, ours at the top-left, so
 *    `y_unity = pageHeight − (y + h)`.
 *  * **Pivot.** Unity's `SpriteRect.pivot` is normalised *inside the sprite's rect*, y up. Ours is
 *    normalised on the frame's whole canvas, y down, and the rect holds only the trimmed pixels.
 *    A bottom-centre pivot on a frame whose artwork floats above the canvas bottom therefore
 *    converts to a y below 0 — which is legal in Unity and is the only way to keep the frame
 *    aligned with the rest of the animation.
 *  * **Physics shape.** Outlines are emitted in pixels relative to the sprite rect, y up. The C#
 *    script converts them to the space `ISpriteEditorDataProvider` expects, which is the one line
 *    to check first if a collider comes out mirrored or offset. */
import {exportProject,frameNames} from './generic-json.js';
export const UNITY_TARGET='unity-2022';
export const UNITY_VERIFIED=false;
export const UNITY_NOTES=Object.freeze([
 'UNVERIFIED: no part of this was run inside Unity. The numbers are unit-tested; the importer is not.',
 'Rects are bottom-left based: y_unity = pageHeight - (y + h).',
 'SpriteRect.pivot is normalised inside the rect, y up, and may fall outside 0…1 for a trimmed frame whose pivot lies off its artwork.',
 'Physics shape outlines are in pixels relative to the rect, y up.',
 'No .meta file is generated. Import through the Editor script, or set the rects yourself.',
 'Sprite rects cannot be rotated, which is why this tool never packs rotated.']);
/** Top-left, y-down atlas rect to Unity's bottom-left, y-up texture rect. */
export function toUnityRect(rect,pageHeight){
 if(!Number.isFinite(pageHeight)||pageHeight<=0)throw Error('The atlas page height is needed to flip a rect into Unity space');
 if(rect.y+rect.h>pageHeight)throw Error(`A ${rect.h}px rect at y=${rect.y} does not fit a ${pageHeight}px page`);
 return {x:rect.x,y:pageHeight-(rect.y+rect.h),width:rect.w,height:rect.h};
}
/** Our pivot (normalised on the frame canvas, y down) to Unity's (normalised inside the rect, y up). */
export function toUnityPivot(frame,rect){
 const px=frame.pivotX*frame.canvasWidth-frame.offsetX,py=frame.pivotY*frame.canvasHeight-frame.offsetY;
 return {x:px/rect.w,y:(rect.h-py)/rect.h};
}
/** A point in frame-canvas pixels (y down) to rect-relative pixels, y up. */
export const toUnityPoint=(x,y,frame,rect)=>({x:x-frame.offsetX,y:rect.h-(y-frame.offsetY)});
/** Nine-slice border as Unity orders it: left, bottom, right, top. Zero unless the frame carries
 * one in `metadata.border` (as {left,top,right,bottom} in frame-canvas pixels). */
export function toUnityBorder(frame){
 const b=frame.metadata?.border;
 if(!b)return {x:0,y:0,z:0,w:0};
 for(const k of ['left','top','right','bottom'])if(!Number.isFinite(b[k])||b[k]<0)throw Error(`metadata.border.${k} must be a non-negative number`);
 return {x:b.left,y:b.bottom,z:b.right,w:b.top};
}
export function toUnityPhysicsShape(frame,rect){
 return frame.collision.map(polygon=>polygon.map(([x,y])=>toUnityPoint(x,y,frame,rect)));
}
/** @returns the generic envelope plus a `unity` block and per-frame `unity` fields. */
export function unityProject(project,options={}){
 const {frames=[]}=project,names=options.names||frameNames(frames);
 const data=exportProject(project,{...options,names,engineTarget:UNITY_TARGET,
  meta:{unity:{verified:UNITY_VERIFIED,notes:UNITY_NOTES,...(options.meta?.unity||{})},...(options.meta||{})}});
 const sprites=[];
 for(const f of frames){
  const entry=data.frames[names.get(f.id)],page=data.meta.pageSizes[entry.page]||data.meta.pageSizes[0];
  const rect=toUnityRect(entry.rect,page.h);
  entry.unity={rect,pivot:toUnityPivot(f,entry.rect),border:toUnityBorder(f),
   physicsShape:toUnityPhysicsShape(f,entry.rect),alignment:9};// 9 = SpriteAlignment.Custom
  sprites.push({name:names.get(f.id),page:entry.page,...entry.unity});
 }
 data.unity={verified:UNITY_VERIFIED,pixelsPerUnit:options.pixelsPerUnit??100,
  textures:data.meta.images.map((image,i)=>({image,width:data.meta.pageSizes[i].w,height:data.meta.pageSizes[i].h})),
  sprites,notes:UNITY_NOTES};
 return data;
}
export const unityJson=(project,options)=>JSON.stringify(unityProject(project,options),null,2);
export const UNITY_EDITOR_SCRIPT=`// NerulioSpriteImporter.cs - applies a Nerulio Sprite Lab export to a texture's sprite rects.
// Put this file anywhere under an "Editor" folder, then use Tools > Nerulio > Import Sprite Lab JSON.
//
// UNVERIFIED: this script has not been run inside Unity. It is written against the documented
// ISpriteEditorDataProvider API for Unity 2022 LTS and later. Read it before you run it.
//
// What it does: sets the texture to Multiple sprite mode, then writes one SpriteRect per frame
// with the rect, pivot and border from the JSON, and the physics shape when the export has one.
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class NerulioSpriteImporter
{
    [Serializable] private class Vec { public float x, y; }
    [Serializable] private class Rect4 { public float x, y, width, height; }
    [Serializable] private class Border { public float x, y, z, w; }
    [Serializable] private class SpriteEntry
    {
        public string name;
        public int page;
        public Rect4 rect;
        public Vec pivot;
        public Border border;
        public Vec[][] physicsShape;
        public int alignment;
    }
    [Serializable] private class TextureEntry { public string image; public int width, height; }
    [Serializable] private class UnityBlock
    {
        public bool verified;
        public float pixelsPerUnit = 100f;
        public TextureEntry[] textures;
        public SpriteEntry[] sprites;
    }
    [Serializable] private class Export { public UnityBlock unity; }

    [MenuItem("Tools/Nerulio/Import Sprite Lab JSON")]
    public static void ImportSelected()
    {
        string jsonPath = EditorUtility.OpenFilePanel("Sprite Lab export", Application.dataPath, "json");
        if (string.IsNullOrEmpty(jsonPath)) return;
        Export export = JsonUtility.FromJson<Export>(File.ReadAllText(jsonPath));
        if (export?.unity?.sprites == null || export.unity.sprites.Length == 0)
        {
            Debug.LogError("Nerulio: that file has no \\"unity\\" block. Export with the Unity target selected.");
            return;
        }
        string folder = Path.GetDirectoryName(jsonPath);
        for (int page = 0; page < export.unity.textures.Length; page++)
        {
            string texturePath = ToAssetPath(Path.Combine(folder, export.unity.textures[page].image));
            if (texturePath == null)
            {
                Debug.LogError($"Nerulio: {export.unity.textures[page].image} is not inside this project's Assets folder.");
                continue;
            }
            Apply(texturePath, export.unity, page);
        }
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
        importer.SaveAndReimport();

        var factory = new SpriteDataProviderFactories();
        factory.Init();
        ISpriteEditorDataProvider provider = factory.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();

        var rects = new List<SpriteRect>();
        var outlines = new List<SpritePhysicsOutline>();
        foreach (SpriteEntry entry in block.sprites)
        {
            if (entry.page != page) continue;
            var spriteRect = new SpriteRect
            {
                name = entry.name,
                spriteID = new GUID(GUID.Generate().ToString()),
                rect = new Rect(entry.rect.x, entry.rect.y, entry.rect.width, entry.rect.height),
                pivot = new Vector2(entry.pivot.x, entry.pivot.y),
                alignment = SpriteAlignment.Custom,
                border = new Vector4(entry.border.x, entry.border.y, entry.border.z, entry.border.w)
            };
            rects.Add(spriteRect);
            if (entry.physicsShape != null && entry.physicsShape.Length > 0)
            {
                var shape = new List<Vector2[]>();
                foreach (Vec[] polygon in entry.physicsShape)
                {
                    var points = new Vector2[polygon.Length];
                    for (int i = 0; i < polygon.Length; i++)
                        // The export gives pixels relative to the rect with y up; the data provider
                        // wants them relative to the rect's centre. This is the line to check first
                        // if a collider comes out offset or mirrored.
                        points[i] = new Vector2(polygon[i].x - entry.rect.width * 0.5f,
                                                polygon[i].y - entry.rect.height * 0.5f);
                    shape.Add(points);
                }
                outlines.Add(new SpritePhysicsOutline { spriteID = spriteRect.spriteID, outlines = shape });
            }
        }
        provider.SetSpriteRects(rects.ToArray());
        var physics = provider.GetDataProvider<ISpritePhysicsOutlineDataProvider>();
        if (physics != null)
            foreach (SpritePhysicsOutline outline in outlines)
                physics.SetOutlines(outline.spriteID, outline.outlines);
        provider.Apply();
        AssetDatabase.ImportAsset(texturePath, ImportAssetOptions.ForceUpdate);
        Debug.Log($"Nerulio: applied {rects.Count} sprite rect(s) to {texturePath}.");
    }

    private class SpritePhysicsOutline { public GUID spriteID; public List<Vector2[]> outlines; }
}
`;
export const UNITY_README=`# Unity import — UNVERIFIED

This path has **not** been run inside Unity. The JSON's numbers are unit-tested; the C# script is
written against the documented \`ISpriteEditorDataProvider\` API for Unity 2022 LTS and later and is
offered as a starting point. Please read it before running it, and no \`.meta\` file is generated.

1. Copy the atlas \`.png\` pages and the exported \`.json\` into your project's \`Assets/\` folder.
2. Copy \`NerulioSpriteImporter.cs\` into any folder called \`Editor\`.
3. Tools > Nerulio > Import Sprite Lab JSON, and pick the exported \`.json\`.

What the conversions assume
* \`unity.sprites[].rect\` is bottom-left based: \`y = pageHeight - (y + h)\` of the atlas rect.
* \`unity.sprites[].pivot\` is normalised inside the sprite rect, y up. For a trimmed frame whose
  pivot sits off its artwork the value is outside 0…1 on purpose — that is what keeps the frame
  aligned with the others. \`alignment\` is \`SpriteAlignment.Custom\`.
* \`unity.sprites[].physicsShape\` is in pixels relative to the rect, y up. The script re-centres it
  on the rect's centre; if a collider lands offset or mirrored, that is the line to change.
* Per-frame durations and animation order live in the generic \`animations\` block. Unity's
  \`Animation\` windows and Animator clips are not written by this script.
`;
export function unityBundle(project,options={}){
 const data=unityProject(project,options);
 const stem=data.meta.image.replace(/\.[^.]*$/,'').replace(/-0$/,'');
 return [{name:`${stem}.json`,text:JSON.stringify(data,null,2),type:'application/json'},
  {name:'Editor/NerulioSpriteImporter.cs',text:UNITY_EDITOR_SCRIPT,type:'text/plain'},
  {name:'UNITY-README.md',text:UNITY_README,type:'text/markdown'}];
}

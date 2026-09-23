/** Texture workspace exports: Godot 4 (CanvasTexture + Sprite2D + PointLight2D), Unity 6 (2D URP
 * secondary texture _NormalMap + an Editor importer), and a generic PNG set with a JSON manifest.
 *
 * Every file is plain data built here; the caller zips it. What each target was verified with is
 * in `VERIFIED` (shown in the UI next to the target and repeated in the bundle's README), and
 * docs/STUDIO-TEXTURE.md has the runs. Native Godot text resources are written because Godot
 * 4.7.2 loads and draws them in tools/engine-verify/texture (lit pixels compared with
 * src/game/normals/lighting.js). */
import {falloffTexture,normLight,hexToRGB} from './lighting.js';
export const TARGETS=Object.freeze(['godot','unity','generic']);
/** Filled from the engine runs (docs/STUDIO-TEXTURE.md). 'verified' needs a PASS in that engine. */
export const VERIFIED=Object.freeze({
 godot:{status:'verified',engine:'Godot 4.7.2 (gl_compatibility)',what:'CanvasTexture diffuse + normal on a Sprite2D region, PointLight2D with this falloff texture, CanvasModulate ambient: lit pixels compared with the Studio preview'},
 unity:{status:'unverified',engine:'Unity 6000.5.3f1',what:'importer compiles and assigns the _NormalMap secondary texture; lit pixels not compared'},
 generic:{status:'n/a',engine:'',what:'PNG files and a JSON manifest; no engine involved'}
});
const str=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
const num=v=>{const r=Math.round(v*1e6)/1e6;return Number.isInteger(r)?`${r}.0`:String(r);};
const col=(hex,a=1)=>{const [r,g,b]=hexToRGB(hex);return `Color(${num(r)}, ${num(g)}, ${num(b)}, ${num(a)})`;};
export const safeBase=s=>String(s||'texture').replace(/\.[^.]+$/,'').replace(/[^\w.-]+/g,'_').replace(/^[._]+/,'')||'texture';
const nodeName=s=>safeBase(s).replace(/[^\w]/g,'_').replace(/^(\d)/,'_$1')||'Sprite';
/** Animations to export: the tags (in frame order), or one "default" through every frame. */
export function animationsOf(frames,tags){
 const idx=new Map(frames.map((f,i)=>[f.id,i]));
 const list=(tags||[]).map(t=>({name:t.name,loop:(t.repeat??0)===0,indices:t.frameIds.map(id=>idx.get(id)).filter(i=>i!=null)})).filter(a=>a.indices.length);
 if(!list.length&&frames.length>1)list.push({name:'default',loop:true,indices:frames.map((_,i)=>i)});
 return list;
}
/** Godot 4: the scene text (.tscn). `frames` = [{rect:{x,y,w,h}, duration}] (regions of the sheet;
 * one frame = the whole picture), `lights` in frame-local pixels, `ambient` = CanvasModulate. */
export function godotScene({base,albedo,normal,lightTextures,frames,tags,frameList,scene,nearest=true,specular=null}){
 const name=nodeName(base),anims=animationsOf(frameList||[],tags||[]);
 const lights=(scene.lights||[]).map(normLight).filter(l=>l.enabled);
 const ext=[[`1_diffuse`,albedo],[`2_normal`,normal]];
 if(specular)ext.push(['4_specular',specular]);
 const lightIds=new Map();lightTextures.forEach((lt,i)=>{const id=`${5+i}_light_${lt.falloff}`;lightIds.set(lt.falloff,id);ext.push([id,lt.name]);});
 const subs=[];
 subs.push(`[sub_resource type="CanvasTexture" id="CanvasTexture_1"]`,'diffuse_texture = ExtResource("1_diffuse")','normal_texture = ExtResource("2_normal")');
 if(specular)subs.push('specular_texture = ExtResource("4_specular")',`specular_color = ${col(scene.specularColor||'#ffffff')}`,`specular_shininess = ${num(scene.specular?.shininess??.5)}`);
 subs.push('');
 const first=frames[0].rect;
 // one Animation per tag: region_rect keys at each frame's start (discrete), looping as tagged
 anims.forEach((a,k)=>{
  let t=0;const times=[],values=[];
  for(const i of a.indices){const r=frames[i].rect;times.push(num(t/1000));values.push(`Rect2(${r.x}, ${r.y}, ${r.w}, ${r.h})`);t+=Math.max(1,frames[i].duration||100);}
  subs.push(`[sub_resource type="Animation" id="Animation_${k+1}"]`,`resource_name = ${str(a.name)}`,`length = ${num(t/1000)}`,`loop_mode = ${a.loop?1:0}`,
   'tracks/0/type = "value"','tracks/0/imported = false','tracks/0/enabled = true','tracks/0/path = NodePath("Sprite:region_rect")','tracks/0/interp = 0','tracks/0/loop_wrap = true',
   `tracks/0/keys = {\n"times": PackedFloat32Array(${times.join(', ')}),\n"transitions": PackedFloat32Array(${times.map(()=>'1').join(', ')}),\n"update": 1,\n"values": [${values.join(', ')}]\n}`,'');
 });
 if(anims.length)subs.push(`[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]`,`_data = {\n${anims.map((a,k)=>`&${str(a.name)}: SubResource("Animation_${k+1}")`).join(',\n')}\n}`,'');
 const out=[`[gd_scene load_steps=${ext.length+subs.filter(s=>s.startsWith('[sub_resource')).length+1} format=3]`,''];
 for(const [id,path] of ext)out.push(`[ext_resource type="Texture2D" path=${str(path)} id=${str(id)}]`);
 out.push('',...subs);
 out.push(`[node name=${str(name)} type="Node2D"]`,'');
 out.push(`[node name="Ambient" type="CanvasModulate" parent="."]`,`color = ${col(scene.ambient||'#ffffff')}`,'');
 out.push(`[node name="Sprite" type="Sprite2D" parent="."]`,...(nearest?['texture_filter = 1']:[]),'texture = SubResource("CanvasTexture_1")','centered = false','region_enabled = true',`region_rect = Rect2(${first.x}, ${first.y}, ${first.w}, ${first.h})`,'');
 lights.forEach((l,i)=>{
  out.push(`[node name=${str('Light'+(i+1))} type="PointLight2D" parent="."]`,`position = Vector2(${num(l.x)}, ${num(l.y)})`,`color = ${col(l.color)}`,`energy = ${num(l.energy)}`,
   `height = ${num(l.z)}`,`texture = ExtResource(${str(lightIds.get(l.falloff))})`,`texture_scale = ${num(2*l.radius/256)}`,'');
 });
 if(anims.length)out.push(`[node name="AnimationPlayer" type="AnimationPlayer" parent="."]`,'libraries = {\n&"": SubResource("AnimationLibrary_1")\n}',`autoplay = ${str(anims[0].name)}`,'');
 return out.join('\n');
}
/** Godot 4: a standalone CanvasTexture resource for your own nodes. */
export function godotCanvasTexture({albedo,normal,specular=null,nearest=true}){
 return [`[gd_resource type="CanvasTexture" load_steps=${specular?4:3} format=3]`,'',`[ext_resource type="Texture2D" path=${str(albedo)} id="1_diffuse"]`,`[ext_resource type="Texture2D" path=${str(normal)} id="2_normal"]`,...(specular?[`[ext_resource type="Texture2D" path=${str(specular)} id="3_specular"]`]:[]),'','[resource]',
  'diffuse_texture = ExtResource("1_diffuse")','normal_texture = ExtResource("2_normal")',...(specular?['specular_texture = ExtResource("3_specular")']:[]),...(nearest?['texture_filter = 1']:[]),''].join('\n');
}
export const UNITY_IMPORTER=`// NerulioNormalMapImporter.cs - applies a Nerulio Studio (Texture) export in Unity 6 with URP 2D.
// Put this file in any folder called "Editor" and the PNGs + nerulio-texture.json anywhere under
// Assets/, then Tools > Nerulio > Apply Texture JSON and pick the .json. It sets the normal map to
// linear (sRGB off), the sprite to Sprite / Point / Uncompressed with one rect per frame, and adds
// the normal map as the sprite's Secondary Texture "_NormalMap" (what URP's Sprite-Lit shader and
// Light2D read). Tools > Nerulio > Create Lit Preview puts the sprite and the exported lights in the
// open scene (needs the Universal Render Pipeline with a 2D Renderer).
// Status: UNVERIFIED in a render (see docs/STUDIO-TEXTURE.md in the Nerulio repository).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class NerulioNormalMapImporter
{
    [Serializable] public class Rect4 { public float x, y, width, height; }
    [Serializable] public class FrameEntry { public string name; public Rect4 rect; }
    [Serializable] public class LightEntry { public float x, y, z, energy, radius; public string color; }
    [Serializable] public class UnityBlock { public string albedo, normal; public int width, height; public float pixelsPerUnit = 100f; public bool pointFilter = true; public FrameEntry[] frames; public LightEntry[] lights; public string ambient; }
    [Serializable] public class Export { public UnityBlock unity; }

    [MenuItem("Tools/Nerulio/Apply Texture JSON")]
    public static void ApplySelected()
    {
        string jsonPath = EditorUtility.OpenFilePanel("Nerulio Studio texture export", Application.dataPath, "json");
        if (!string.IsNullOrEmpty(jsonPath)) Apply(jsonPath);
    }

    public static string ToAssetPath(string absolute)
    {
        string full = Path.GetFullPath(absolute).Replace('\\\\', '/');
        string root = Path.GetFullPath(Application.dataPath).Replace('\\\\', '/');
        return full.StartsWith(root, StringComparison.OrdinalIgnoreCase) ? "Assets" + full.Substring(root.Length) : null;
    }

    /// Applies the import settings, the sprite rects and the _NormalMap secondary texture.
    public static Export Apply(string jsonPath)
    {
        Export export = JsonUtility.FromJson<Export>(File.ReadAllText(jsonPath));
        if (export?.unity == null) { Debug.LogError("Nerulio: that file has no \\"unity\\" block."); return null; }
        UnityBlock u = export.unity;
        string folder = ToAssetPath(Path.GetDirectoryName(jsonPath));
        if (folder == null) { Debug.LogError("Nerulio: the export is not inside this project's Assets folder."); return null; }
        string normalPath = folder + "/" + u.normal, albedoPath = folder + "/" + u.albedo;

        var n = (TextureImporter)AssetImporter.GetAtPath(normalPath);
        n.textureType = TextureImporterType.Default;
        n.sRGBTexture = false;                       // a normal map holds vectors, not colours
        n.mipmapEnabled = false;
        n.filterMode = u.pointFilter ? FilterMode.Point : FilterMode.Bilinear;
        n.textureCompression = TextureImporterCompression.Uncompressed;
        n.SaveAndReimport();

        var a = (TextureImporter)AssetImporter.GetAtPath(albedoPath);
        a.textureType = TextureImporterType.Sprite;
        a.spriteImportMode = u.frames != null && u.frames.Length > 1 ? SpriteImportMode.Multiple : SpriteImportMode.Single;
        a.spritePixelsPerUnit = u.pixelsPerUnit;
        a.filterMode = u.pointFilter ? FilterMode.Point : FilterMode.Bilinear;
        a.mipmapEnabled = false;
        a.textureCompression = TextureImporterCompression.Uncompressed;
        a.SaveAndReimport();

        var factory = new SpriteDataProviderFactories();
        factory.Init();
        ISpriteEditorDataProvider provider = factory.GetSpriteEditorDataProviderFromObject(a);
        provider.InitSpriteEditorDataProvider();
        if (a.spriteImportMode == SpriteImportMode.Multiple)
        {
            var rects = new List<SpriteRect>();
            foreach (FrameEntry f in u.frames)
                rects.Add(new SpriteRect { name = f.name, spriteID = GUID.Generate(), rect = new Rect(f.rect.x, f.rect.y, f.rect.width, f.rect.height), pivot = new Vector2(0.5f, 0.5f), alignment = SpriteAlignment.Center });
            provider.SetSpriteRects(rects.ToArray());
        }
        var secondary = provider.GetDataProvider<ISecondaryTextureDataProvider>();
        secondary.textures = new[] { new SecondarySpriteTexture { name = "_NormalMap", texture = AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath) } };
        provider.Apply();
        AssetDatabase.ImportAsset(albedoPath, ImportAssetOptions.ForceUpdate);
        Debug.Log($"Nerulio: {albedoPath} now has _NormalMap = {normalPath}.");
        return export;
    }

    [MenuItem("Tools/Nerulio/Create Lit Preview")]
    public static void CreatePreviewSelected()
    {
        string jsonPath = EditorUtility.OpenFilePanel("Nerulio Studio texture export", Application.dataPath, "json");
        if (!string.IsNullOrEmpty(jsonPath)) CreatePreview(jsonPath);
    }

    /// A SpriteRenderer with the first frame and one point Light2D per exported light. Light2D is
    /// found by reflection so this script compiles in projects without URP.
    public static GameObject CreatePreview(string jsonPath)
    {
        Export export = Apply(jsonPath);
        if (export == null) return null;
        UnityBlock u = export.unity;
        string folder = ToAssetPath(Path.GetDirectoryName(jsonPath));
        Sprite sprite = AssetDatabase.LoadAllAssetsAtPath(folder + "/" + u.albedo).OfType<Sprite>().OrderBy(s => s.name).FirstOrDefault();
        var root = new GameObject("NerulioLitPreview");
        var sr = new GameObject("Sprite").AddComponent<SpriteRenderer>();
        sr.transform.SetParent(root.transform, false);
        sr.sprite = sprite;
        Type light2D = Type.GetType("UnityEngine.Rendering.Universal.Light2D, Unity.RenderPipelines.Universal.Runtime");
        if (light2D == null) { Debug.LogWarning("Nerulio: URP is not installed; the sprite was placed without lights."); return root; }
        float ppu = u.pixelsPerUnit;
        Rect4 fr = u.frames != null && u.frames.Length > 0 ? u.frames[0].rect : new Rect4 { width = u.width, height = u.height };
        foreach (LightEntry l in u.lights ?? new LightEntry[0])
        {
            var go = new GameObject("Light2D");
            go.transform.SetParent(root.transform, false);
            // frame-local pixels (y down) → units around the sprite's centre pivot (y up)
            go.transform.localPosition = new Vector3((l.x - fr.width / 2f) / ppu, (fr.height / 2f - l.y) / ppu, 0f);
            var c = go.AddComponent(light2D);
            ColorUtility.TryParseHtmlString(l.color, out Color color);
            light2D.GetProperty("lightType")?.SetValue(c, Enum.Parse(light2D.GetNestedType("LightType"), "Point"));
            light2D.GetProperty("color")?.SetValue(c, color);
            light2D.GetProperty("intensity")?.SetValue(c, l.energy);
            light2D.GetProperty("pointLightOuterRadius")?.SetValue(c, l.radius / ppu);
            light2D.GetProperty("pointLightInnerRadius")?.SetValue(c, 0f);
            light2D.GetProperty("normalMapDistance")?.SetValue(c, l.z / ppu);
            var quality = light2D.GetNestedType("NormalMapQuality");
            if (quality != null) light2D.GetProperty("normalMapQuality")?.SetValue(c, Enum.Parse(quality, "Accurate"));
        }
        return root;
    }
}
`;
/** Unity block of the manifest: rects in Unity's bottom-left convention. */
export function unityBlock({albedo,normal,width,height,frames,scene,pixelsPerUnit=100,pointFilter=true}){
 return {albedo,normal,width,height,pixelsPerUnit,pointFilter,
  frames:frames.map((f,i)=>({name:f.name||`frame_${i}`,rect:{x:f.rect.x,y:height-(f.rect.y+f.rect.h),width:f.rect.w,height:f.rect.h}})),
  lights:(scene.lights||[]).map(normLight).filter(l=>l.enabled).map(l=>({x:l.x,y:l.y,z:l.z,energy:l.energy,radius:l.radius,color:l.color})),ambient:scene.ambient||'#ffffff'};
}
/** Plain-text README for one target. */
function readme(target,{base,convention,files}){
 const v=VERIFIED[target];
 const head={godot:'# Godot 4',unity:'# Unity 6 (URP 2D)',generic:'# PNG set + JSON'}[target];
 const status=v.status==='verified'?`Verified: ${v.engine} — ${v.what}.`:v.status==='unverified'?`UNVERIFIED: ${v.what} (${v.engine}).`:'';
 const body={
  godot:`1. Copy this folder anywhere under res:// (the files refer to each other by relative paths).
2. Open \`${base}_lit.tscn\`: a Sprite2D with a CanvasTexture (diffuse + normal map), a CanvasModulate
   for the ambient colour and one PointLight2D per light, placed as in the Studio. With frames, an
   AnimationPlayer steps Sprite2D.region_rect through them.
3. For your own nodes, use \`${base}_canvas_texture.tres\` as the Sprite2D texture.
Normal maps are OpenGL (Y+), which is what Godot expects. Pixel art: the scene sets Nearest filtering.`,
  unity:`1. Copy this folder into Assets/. Unity compiles Editor/NerulioNormalMapImporter.cs.
2. Tools › Nerulio › Apply Texture JSON › nerulio-texture.json: the sprite gets its rects and the
   normal map as Secondary Texture "_NormalMap" (sRGB off).
3. Tools › Nerulio › Create Lit Preview adds the sprite and Light2D lights (needs URP + 2D Renderer;
   use the Sprite-Lit-Default material, which is URP's default for sprites).
Normal maps are OpenGL (Y+), which is what Unity expects.`,
  generic:`Files: ${files.join(', ')}. nerulio-texture.json lists every map with its colour space and the
frames. Normal maps are given in both conventions: _n.png (OpenGL, Y+: Godot, Unity, Blender) and
_n_dx.png (DirectX, Y−: Unreal). The height map is a 16-bit PNG (0 … heightMaxPx pixels).`}[target];
 return `${head}\n\n${status}\n\n${body}\n\nConvention of the source normal map: ${convention}.\n`;
}
/** All files for the chosen targets. PNG bytes come from the caller (so the albedo stays the
 * user's own file, byte for byte). Returns [{name, data (Uint8Array|string), type}]. */
export function bundleFiles({base,targets,png,width,height,frames,frameList=[],tags=[],scene,convention='opengl',pixelArt=true,heightMax=0,params=null}){
 base=safeBase(base);
 const out=[],falloffs=[...new Set((scene.lights||[]).map(normLight).filter(l=>l.enabled).map(l=>l.falloff))];
 const add=(name,data,type='image/png')=>out.push({name,data,type});
 const fr=frames.length?frames:[{rect:{x:0,y:0,w:width,h:height},duration:100,name:base}];
 if(targets.includes('godot')){
  add(`godot/${base}.png`,png.albedo);add(`godot/${base}_n.png`,png.normal);
  const lts=falloffs.map(f=>({falloff:f,name:`${base}_light_${f}.png`}));
  for(const lt of lts)add(`godot/${lt.name}`,png.light[lt.falloff]);
  add(`godot/${base}_lit.tscn`,godotScene({base,albedo:`${base}.png`,normal:`${base}_n.png`,lightTextures:lts,frames:fr,frameList,tags,scene,nearest:pixelArt}),'text/plain');
  add(`godot/${base}_canvas_texture.tres`,godotCanvasTexture({albedo:`${base}.png`,normal:`${base}_n.png`,nearest:pixelArt}),'text/plain');
  add('godot/README.md',readme('godot',{base,convention,files:[]}),'text/markdown');
 }
 if(targets.includes('unity')){
  add(`unity/${base}.png`,png.albedo);add(`unity/${base}_n.png`,png.normal);
  add('unity/nerulio-texture.json',JSON.stringify({generator:'Nerulio Studio',schemaVersion:1,unity:unityBlock({albedo:`${base}.png`,normal:`${base}_n.png`,width,height,frames:fr,scene,pointFilter:pixelArt})},null,1),'application/json');
  add('unity/Editor/NerulioNormalMapImporter.cs',UNITY_IMPORTER,'text/plain');
  add('unity/README.md',readme('unity',{base,convention,files:[]}),'text/markdown');
 }
 if(targets.includes('generic')){
  const files=[`${base}.png`,`${base}_n.png`,`${base}_n_dx.png`];
  add(`generic/${base}.png`,png.albedo);add(`generic/${base}_n.png`,png.normal);add(`generic/${base}_n_dx.png`,png.normalDX);
  if(png.height){add(`generic/${base}_height16.png`,png.height);files.push(`${base}_height16.png`);}
  if(png.ao){add(`generic/${base}_ao.png`,png.ao);files.push(`${base}_ao.png`);}
  const maps={albedo:{file:`${base}.png`,colorSpace:'srgb'},normal:{file:`${base}_n.png`,colorSpace:'linear',convention:'opengl'},normalDX:{file:`${base}_n_dx.png`,colorSpace:'linear',convention:'directx'}};
  if(png.height)maps.height={file:`${base}_height16.png`,colorSpace:'linear',bitDepth:16,maxPx:Math.round(heightMax*1000)/1000};
  if(png.ao)maps.ao={file:`${base}_ao.png`,colorSpace:'linear',note:'estimated from the height field (horizon-based), not ray-traced'};
  add('generic/nerulio-texture.json',JSON.stringify({generator:'Nerulio Studio',schemaVersion:1,width,height,maps,
   frames:fr.map((f,i)=>({name:f.name||`frame_${i}`,x:f.rect.x,y:f.rect.y,w:f.rect.w,h:f.rect.h,durationMs:f.duration||100})),
   animations:animationsOf(frameList,tags).map(a=>({name:a.name,loop:a.loop,frames:a.indices})),
   lighting:{ambient:scene.ambient,lights:(scene.lights||[]).map(normLight),model:'Godot 4 canvas: base·ambient + Σ falloff·colour·energy·base·max(0,N·L)'},params},null,1),'application/json');
  add('generic/README.md',readme('generic',{base,convention,files}),'text/markdown');
 }
 return out;
}
/** The falloff PNGs a bundle needs (RGBA bytes; the caller encodes them). */
export const lightTexturesFor=scene=>Object.fromEntries([...new Set((scene.lights||[]).map(normLight).filter(l=>l.enabled).map(l=>l.falloff))].map(f=>[f,falloffTexture(f,256)]));

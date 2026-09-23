// Nerulio engine-verify probe for the Texture workspace's Unity export. NOT shipped to users.
//
// unity_texture.py copies the bundle's unity/ folder into Assets/Bundle/ of a throw-away URP
// project and runs  Unity -batchmode -quit -executeMethod NerulioTextureProbe.Run  (WITHOUT
// -nographics, so the GPU renders). The probe:
//   1. makes a URP asset with the 2D Renderer (URP's own Renderer2DMenus.CreateRendererAsset), sets
//      it as the render pipeline and sets the renderer's Light Render Texture Scale to 1 (the
//      default 0.5 computes lighting and the normals buffer at half resolution, which blurs a
//      32 px sprite into 16 px of lighting - a project setting, not something the export controls);
//      NERULIO_PROBE_COLORSPACE=Linear|Gamma picks the project colour space;
//   2. runs the importer THE BUNDLE SHIPS (NerulioNormalMapImporter.Apply / CreatePreview) on the
//      exported nerulio-texture.json;
//   3. reads back the import settings, the sprite's secondary textures and the lights' serialized
//      normal-map settings;
//   4. renders the frame named NERULIO_PROBE_FRAME (default: the importer's first sprite) with an
//      orthographic camera at 1 texel per pixel: lit.png with every exported light, then for each
//      light alone light_<i>.png (normal map as imported) and flat_<i>.png (the same light with its
//      normal map switched off). flat_i is the light's own colour x falloff, so light_i / flat_i is
//      exactly the N.L factor Unity applied - the Python judge compares it with N.L predicted from
//      the exported normal map.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class NerulioTextureProbe
{
    static string Q(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") + "\"";
    static string F(float v) => v.ToString("R", CultureInfo.InvariantCulture);

    static void Shoot(Camera cam, RenderTexture rt, Light2D[] lights, string path)
    {
        // Light2D builds its mesh and culling sphere in LateUpdate, which the editor does not tick in batchmode
        MethodInfo late = typeof(Light2D).GetMethod("LateUpdate", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
        foreach (var l in lights) if (l.enabled) late?.Invoke(l, null);
        cam.Render();
        RenderTexture.active = rt;
        var shot = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
        shot.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0); shot.Apply();
        File.WriteAllBytes(path, shot.EncodeToPNG());
        RenderTexture.active = null;
        UnityEngine.Object.DestroyImmediate(shot);
    }

    static void SetQuality(Light2D l, Light2D.NormalMapQuality q)
    {
        var so = new SerializedObject(l);
        so.FindProperty("m_NormalMapQuality").intValue = (int)q;
        so.ApplyModifiedPropertiesWithoutUndo();
    }

    public static void Run()
    {
        string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "_verify"));
        Directory.CreateDirectory(outDir);
        var errors = new List<string>();
        var fields = new List<string>();
        try
        {
            string wantSpace = Environment.GetEnvironmentVariable("NERULIO_PROBE_COLORSPACE");
            if (!string.IsNullOrEmpty(wantSpace)) PlayerSettings.colorSpace = (ColorSpace)Enum.Parse(typeof(ColorSpace), wantSpace);

            // 1. URP with the 2D renderer, lighting at full resolution
            Type menus = AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetType("UnityEditor.Rendering.Universal.Renderer2DMenus")).FirstOrDefault(t => t != null);
            if (menus == null) throw new Exception("URP editor assembly (Renderer2DMenus) not found");
            MethodInfo create = menus.GetMethod("CreateRendererAsset", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
            var data = (ScriptableRendererData)create.Invoke(null, new object[] { "Assets/Nerulio2DRenderer.asset", RendererType._2DRenderer, false, "Renderer" });
            var dso = new SerializedObject(data);
            var scale = dso.FindProperty("m_LightRenderTextureScale");
            if (scale != null) { scale.floatValue = 1f; dso.ApplyModifiedPropertiesWithoutUndo(); }
            fields.Add("\"lightRenderTextureScale\":" + (scale != null ? F(scale.floatValue) : "null"));
            var urp = UniversalRenderPipelineAsset.Create(data);
            AssetDatabase.CreateAsset(urp, "Assets/NerulioURP2D.asset");
            GraphicsSettings.defaultRenderPipeline = urp;
            QualitySettings.renderPipeline = urp;
            fields.Add("\"pipeline\":" + Q(GraphicsSettings.currentRenderPipeline ? GraphicsSettings.currentRenderPipeline.GetType().Name : "none"));
            fields.Add("\"colorSpace\":" + Q(PlayerSettings.colorSpace.ToString()));
            fields.Add("\"graphics\":" + Q(SystemInfo.graphicsDeviceType.ToString()));

            // 2. the shipped importer
            string json = Directory.GetFiles(Path.Combine(Application.dataPath, "Bundle"), "nerulio-texture.json", SearchOption.AllDirectories).First();
            Type imp = AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetType("NerulioNormalMapImporter")).FirstOrDefault(t => t != null);
            if (imp == null) throw new Exception("NerulioNormalMapImporter is missing or did not compile");
            object root = imp.GetMethod("CreatePreview").Invoke(null, new object[] { json });
            if (root == null) throw new Exception("CreatePreview returned null");
            var go = (GameObject)root;

            // 3. what Unity made of it
            var sr = go.GetComponentInChildren<SpriteRenderer>();
            string albedoPath = AssetDatabase.GetAssetPath(sr.sprite.texture);
            var ti = (TextureImporter)AssetImporter.GetAtPath(albedoPath);
            var factory = new SpriteDataProviderFactories(); factory.Init();
            var provider = factory.GetSpriteEditorDataProviderFromObject(ti); provider.InitSpriteEditorDataProvider();
            var sec = provider.GetDataProvider<ISecondaryTextureDataProvider>().textures ?? new SecondarySpriteTexture[0];
            fields.Add("\"secondary\":[" + string.Join(",", sec.Select(s => "{\"name\":" + Q(s.name) + ",\"texture\":" + Q(s.texture ? AssetDatabase.GetAssetPath(s.texture) : "") + "}")) + "]");
            var nimp = (TextureImporter)AssetImporter.GetAtPath(sec.Length > 0 && sec[0].texture ? AssetDatabase.GetAssetPath(sec[0].texture) : "");
            if (nimp != null) fields.Add("\"normalSRGB\":" + (nimp.sRGBTexture ? "true" : "false"));
            // the textures as the GPU gets them (catches power-of-two resampling or max-size shrinking)
            var ntex = sec.Length > 0 ? sec[0].texture : null;
            fields.Add("\"normalSize\":[" + (ntex ? ntex.width + "," + ntex.height : "0,0") + "],\"albedoSize\":[" + sr.sprite.texture.width + "," + sr.sprite.texture.height + "]");
            var sprites = AssetDatabase.LoadAllAssetsAtPath(albedoPath).OfType<Sprite>().ToArray();
            string wantFrame = Environment.GetEnvironmentVariable("NERULIO_PROBE_FRAME");
            if (!string.IsNullOrEmpty(wantFrame))
            {
                var pick = sprites.FirstOrDefault(s => s.name == wantFrame);
                if (pick == null) throw new Exception("no sprite named " + wantFrame + " (have " + string.Join(",", sprites.Select(s => s.name)) + ")");
                sr.sprite = pick;
            }
            fields.Add("\"spriteSecondaryCount\":" + sr.sprite.GetSecondaryTextureCount());
            fields.Add("\"spriteMode\":" + Q(ti.spriteImportMode.ToString()) + ",\"sprites\":" + sprites.Length + ",\"frame\":" + Q(sr.sprite.name));
            fields.Add("\"spriteRect\":[" + F(sr.sprite.rect.x) + "," + F(sr.sprite.rect.y) + "," + F(sr.sprite.rect.width) + "," + F(sr.sprite.rect.height) + "]");
            fields.Add("\"material\":" + Q(sr.sharedMaterial ? sr.sharedMaterial.shader.name : "none"));
            var lights = go.GetComponentsInChildren<Light2D>();
            fields.Add("\"lights\":[" + string.Join(",", lights.Select(l => "{\"pos\":[" + F(l.transform.position.x) + "," + F(l.transform.position.y) + "],\"type\":" + Q(l.lightType.ToString()) + ",\"color\":[" + F(l.color.r) + "," + F(l.color.g) + "," + F(l.color.b) + "],\"intensity\":" + F(l.intensity) + ",\"outer\":" + F(l.pointLightOuterRadius) + ",\"nmd\":" + F(l.normalMapDistance) + ",\"quality\":" + Q(l.normalMapQuality.ToString()) + ",\"layers\":" + l.targetSortingLayers.Length + "}")) + "]");
            if (lights.Length == 0) throw new Exception("CreatePreview made no Light2D");

            // 4. render one texel per pixel
            var rect = sr.sprite.rect;
            float ppu = sr.sprite.pixelsPerUnit;
            int W = Mathf.RoundToInt(rect.width), H = Mathf.RoundToInt(rect.height);
            var cam = new GameObject("NerulioCam").AddComponent<Camera>();
            cam.orthographic = true; cam.orthographicSize = H / ppu / 2f;
            // centre of the sprite's bounds (the pivot is the frame centre, but read it back rather than assume)
            var b = sr.bounds;
            cam.transform.position = new Vector3(b.center.x, b.center.y, -10f);
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = new Color(0, 0, 0, 0);
            var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt; cam.aspect = (float)W / H;
            Shoot(cam, rt, lights, Path.Combine(outDir, "lit.png"));
            for (int i = 0; i < lights.Length; i++)
            {
                for (int j = 0; j < lights.Length; j++) lights[j].enabled = j == i;
                var q = lights[i].normalMapQuality;
                Shoot(cam, rt, lights, Path.Combine(outDir, "light_" + i + ".png"));
                SetQuality(lights[i], Light2D.NormalMapQuality.Disabled);
                Shoot(cam, rt, lights, Path.Combine(outDir, "flat_" + i + ".png"));
                SetQuality(lights[i], q);
            }
            foreach (var l in lights) l.enabled = true;
            fields.Add("\"render\":{\"w\":" + W + ",\"h\":" + H + ",\"ppu\":" + F(ppu) + ",\"bounds\":[" + F(b.min.x) + "," + F(b.min.y) + "," + F(b.max.x) + "," + F(b.max.y) + "]}");
        }
        catch (Exception e) { errors.Add((e.InnerException ?? e).ToString()); }
        File.WriteAllText(Path.Combine(outDir, "report.json"), "{" + string.Join(",", fields) + (fields.Count > 0 ? "," : "") +
            "\"unity\":" + Q(Application.unityVersion) + ",\"errors\":[" + string.Join(",", errors.Select(Q)) + "]}");
        EditorApplication.Exit(0);
    }
}

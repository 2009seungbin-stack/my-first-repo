// Nerulio engine-verify probe for the Texture workspace's Unity export. NOT shipped to users.
//
// unity_texture.py copies the bundle's unity/ folder into Assets/Bundle/ of a throw-away URP
// project and runs  Unity -batchmode -quit -executeMethod NerulioTextureProbe.Run  (WITHOUT
// -nographics, so the GPU renders). The probe:
//   1. makes a URP asset with the 2D Renderer (URP's own Renderer2DMenus.CreateRendererAsset) and
//      sets it as the render pipeline;
//   2. runs the importer THE BUNDLE SHIPS (NerulioNormalMapImporter.Apply / CreatePreview) on the
//      exported nerulio-texture.json;
//   3. reads back the import settings and the sprite's secondary textures;
//   4. renders the first frame lit by the exported Light2D(s) with an orthographic camera at 1 texel
//      per pixel into a RenderTexture and saves it as PNG.
// Judging (which way the lighting leans, against the Studio model) happens in Python.
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

    public static void Run()
    {
        string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "_verify"));
        Directory.CreateDirectory(outDir);
        var errors = new List<string>();
        var fields = new List<string>();
        try
        {
            // 1. URP with the 2D renderer
            Type menus = AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetType("UnityEditor.Rendering.Universal.Renderer2DMenus")).FirstOrDefault(t => t != null);
            if (menus == null) throw new Exception("URP editor assembly (Renderer2DMenus) not found");
            MethodInfo create = menus.GetMethod("CreateRendererAsset", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
            var data = (ScriptableRendererData)create.Invoke(null, new object[] { "Assets/Nerulio2DRenderer.asset", RendererType._2DRenderer, false, "Renderer" });
            var urp = UniversalRenderPipelineAsset.Create(data);
            AssetDatabase.CreateAsset(urp, "Assets/NerulioURP2D.asset");
            GraphicsSettings.defaultRenderPipeline = urp;
            QualitySettings.renderPipeline = urp;
            fields.Add("\"pipeline\":" + Q(GraphicsSettings.currentRenderPipeline ? GraphicsSettings.currentRenderPipeline.GetType().Name : "none"));
            fields.Add("\"colorSpace\":" + Q(PlayerSettings.colorSpace.ToString()));

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
            fields.Add("\"spriteSecondaryCount\":" + sr.sprite.GetSecondaryTextureCount());
            var nimp = (TextureImporter)AssetImporter.GetAtPath(sec.Length > 0 && sec[0].texture ? AssetDatabase.GetAssetPath(sec[0].texture) : "");
            if (nimp != null) fields.Add("\"normalSRGB\":" + (nimp.sRGBTexture ? "true" : "false"));
            fields.Add("\"spriteMode\":" + Q(ti.spriteImportMode.ToString()) + ",\"sprites\":" + AssetDatabase.LoadAllAssetsAtPath(albedoPath).OfType<Sprite>().Count());
            fields.Add("\"material\":" + Q(sr.sharedMaterial ? sr.sharedMaterial.shader.name : "none"));
            var lights = go.GetComponentsInChildren<Light2D>();
            fields.Add("\"lights\":[" + string.Join(",", lights.Select(l => "{\"pos\":[" + F(l.transform.position.x) + "," + F(l.transform.position.y) + "],\"intensity\":" + F(l.intensity) + ",\"outer\":" + F(l.pointLightOuterRadius) + ",\"nmd\":" + F(l.normalMapDistance) + ",\"quality\":" + Q(l.normalMapQuality.ToString()) + "}")) + "]");

            // 4. render one texel per pixel
            var rect = sr.sprite.rect;
            float ppu = sr.sprite.pixelsPerUnit;
            int W = Mathf.RoundToInt(rect.width), H = Mathf.RoundToInt(rect.height);
            var cam = new GameObject("NerulioCam").AddComponent<Camera>();
            cam.orthographic = true; cam.orthographicSize = H / ppu / 2f;
            cam.transform.position = new Vector3(sr.transform.position.x, sr.transform.position.y, -10f);
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Color.black;
            var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt; cam.aspect = (float)W / H;
            cam.Render();
            RenderTexture.active = rt;
            var shot = new Texture2D(W, H, TextureFormat.RGBA32, false);
            shot.ReadPixels(new Rect(0, 0, W, H), 0, 0); shot.Apply();
            File.WriteAllBytes(Path.Combine(outDir, "lit.png"), shot.EncodeToPNG());
            fields.Add("\"render\":{\"w\":" + W + ",\"h\":" + H + ",\"ppu\":" + F(ppu) + "}");
        }
        catch (Exception e) { errors.Add((e.InnerException ?? e).ToString()); }
        File.WriteAllText(Path.Combine(outDir, "report.json"), "{" + string.Join(",", fields) + (fields.Count > 0 ? "," : "") +
            "\"unity\":" + Q(Application.unityVersion) + ",\"errors\":[" + string.Join(",", errors.Select(Q)) + "]}");
        EditorApplication.Exit(0);
    }
}

// Nerulio engine-verify probe for Unity (Editor, batch mode). NOT shipped to users.
//
// tools/engine-verify/unity_runner.py copies an exported Sprite Lab "Unity" bundle into
// Assets/Bundle/ of a throw-away project, puts this file in Assets/VerifyEditor/Editor/ and runs
//   Unity -batchmode -quit -projectPath <p> -executeMethod NerulioVerifyProbe.Run -logFile <log>
// The probe drives the importer THE BUNDLE SHIPS (NerulioSpriteImporter.Apply, reached by
// reflection because its menu entry opens a file dialog, which batch mode cannot show), then reads
// back what Unity made of it: importer settings, every Sprite's rect and pivot, and the pixels
// inside each rect cut from the texture Unity decoded. Judging happens in Python.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using UnityEditor;
using UnityEngine;

public static class NerulioVerifyProbe
{
    static string Q(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") + "\"";
    static string F(float v) => v.ToString("R", CultureInfo.InvariantCulture);

    public static void Run()
    {
        string outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "_verify"));
        Directory.CreateDirectory(outDir);
        var errors = new List<string>();
        var pages = new List<string>();
        var sprites = new List<string>();
        var clips = new List<string>();
        try
        {
            Type imp = AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetType("NerulioSpriteImporter")).FirstOrDefault(t => t != null);
            if (imp == null) throw new Exception("NerulioSpriteImporter is missing or did not compile");
            string json = Directory.GetFiles(Path.Combine(Application.dataPath, "Bundle"), "*.json", SearchOption.AllDirectories)
                .FirstOrDefault(p => File.ReadAllText(p).Contains("\"unity\""));
            if (json == null) throw new Exception("no exported JSON with a \"unity\" block under Assets/Bundle");
            Type exportType = imp.GetNestedType("Export", BindingFlags.NonPublic);
            object export = JsonUtility.FromJson(File.ReadAllText(json), exportType);
            object block = exportType.GetField("unity").GetValue(export);
            Array textures = (Array)block.GetType().GetField("textures").GetValue(block);
            MethodInfo apply = imp.GetMethod("Apply", BindingFlags.NonPublic | BindingFlags.Static);
            MethodInfo toAsset = imp.GetMethod("ToAssetPath", BindingFlags.NonPublic | BindingFlags.Static);
            string folder = Path.GetDirectoryName(json);
            int n = 0;
            for (int page = 0; page < textures.Length; page++)
            {
                object tex = textures.GetValue(page);
                string image = (string)tex.GetType().GetField("image").GetValue(tex);
                string assetPath = (string)toAsset.Invoke(null, new object[] { Path.Combine(folder, image) });
                apply.Invoke(null, new object[] { assetPath, block, page });
                var ti = (TextureImporter)AssetImporter.GetAtPath(assetPath);
                pages.Add("{\"image\":" + Q(image) + ",\"asset\":" + Q(assetPath) + ",\"textureType\":" + Q(ti.textureType.ToString()) +
                          ",\"spriteImportMode\":" + Q(ti.spriteImportMode.ToString()) + ",\"filterMode\":" + Q(ti.filterMode.ToString()) +
                          ",\"compression\":" + Q(ti.textureCompression.ToString()) + ",\"mipmaps\":" + (ti.mipmapEnabled ? "true" : "false") +
                          ",\"pixelsPerUnit\":" + F(ti.spritePixelsPerUnit) + ",\"maxTextureSize\":" + ti.maxTextureSize + "}");
                var decoded = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                decoded.LoadImage(File.ReadAllBytes(Path.Combine(folder, image)));
                // Unity keeps the sprites in the order of the sprite rects; sort by name order of the importer's list.
                foreach (Sprite s in AssetDatabase.LoadAllAssetsAtPath(assetPath).OfType<Sprite>())
                {
                    Rect r = s.rect;
                    int x = Mathf.RoundToInt(r.x), y = Mathf.RoundToInt(r.y), w = Mathf.RoundToInt(r.width), h = Mathf.RoundToInt(r.height);
                    string png = "";
                    if (x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= decoded.width && y + h <= decoded.height)
                    {
                        var cut = new Texture2D(w, h, TextureFormat.RGBA32, false);
                        cut.SetPixels32(GetBlock(decoded, x, y, w, h));
                        png = "sprite_" + (n++).ToString("D4") + ".png";
                        File.WriteAllBytes(Path.Combine(outDir, png), cut.EncodeToPNG());
                    }
                    sprites.Add("{\"name\":" + Q(s.name) + ",\"page\":" + page + ",\"rect\":[" + F(r.x) + "," + F(r.y) + "," + F(r.width) + "," + F(r.height) +
                                "],\"pivotPx\":[" + F(s.pivot.x) + "," + F(s.pivot.y) + "],\"border\":[" + F(s.border.x) + "," + F(s.border.y) + "," + F(s.border.z) + "," + F(s.border.w) +
                                "],\"physicsShapes\":" + s.GetPhysicsShapeCount() + ",\"png\":" + Q(png) + "}");
                }
            }
            // Studio bundles also build AnimationClips (CreateClips); read back every keyframe.
            MethodInfo createClips = imp.GetMethod("CreateClips", BindingFlags.NonPublic | BindingFlags.Static);
            if (createClips != null)
            {
                string assetFolder = (string)toAsset.Invoke(null, new object[] { folder });
                createClips.Invoke(null, new object[] { assetFolder, block });
                foreach (string guid in AssetDatabase.FindAssets("t:AnimationClip", new[] { assetFolder }))
                {
                    var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(AssetDatabase.GUIDToAssetPath(guid));
                    var keys = new List<string>();
                    foreach (var binding in AnimationUtility.GetObjectReferenceCurveBindings(clip))
                        foreach (var k in AnimationUtility.GetObjectReferenceCurve(clip, binding))
                            keys.Add("{\"time\":" + F(k.time) + ",\"sprite\":" + Q(k.value ? k.value.name : "") + ",\"path\":" + Q(binding.path) +
                                     ",\"type\":" + Q(binding.type.Name) + ",\"property\":" + Q(binding.propertyName) + "}");
                    clips.Add("{\"name\":" + Q(clip.name) + ",\"frameRate\":" + F(clip.frameRate) + ",\"length\":" + F(clip.length) +
                              ",\"loop\":" + (AnimationUtility.GetAnimationClipSettings(clip).loopTime ? "true" : "false") + ",\"keys\":[" + string.Join(",", keys) + "]}");
                }
            }
        }
        catch (Exception e)
        {
            errors.Add((e.InnerException ?? e).ToString());
        }
        var sb = new StringBuilder();
        sb.Append("{\"unity\":").Append(Q(Application.unityVersion))
          .Append(",\"errors\":[").Append(string.Join(",", errors.Select(Q))).Append("]")
          .Append(",\"pages\":[").Append(string.Join(",", pages)).Append("]")
          .Append(",\"sprites\":[").Append(string.Join(",", sprites)).Append("]")
          .Append(",\"clips\":[").Append(string.Join(",", clips)).Append("]}");
        File.WriteAllText(Path.Combine(outDir, "report.json"), sb.ToString());
        Debug.Log("NERULIO_PROBE_DONE errors=" + errors.Count);
        EditorApplication.Exit(0);
    }

    static Color32[] GetBlock(Texture2D t, int x, int y, int w, int h)
    {
        Color32[] all = t.GetPixels32();
        var outp = new Color32[w * h];
        for (int j = 0; j < h; j++)
            Array.Copy(all, (y + j) * t.width + x, outp, j * w, w);
        return outp;
    }
}

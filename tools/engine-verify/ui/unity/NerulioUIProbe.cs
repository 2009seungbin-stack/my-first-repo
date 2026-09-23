// Nerulio UI engine-verify probe for Unity 6 (Editor, batch mode, WITH a graphics device: no
// -nographics). NOT shipped to users.
//
// unity_ui.py copies the bundle into Assets/Bundle/ of a throw-away project (com.unity.ugui 2.x,
// com.unity.2d.sprite), puts this file into an Editor folder, writes _verify/job.json and runs
//   Unity -batchmode -quit -projectPath <p> -executeMethod NerulioUIProbe.Run
// The probe calls the importer THE BUNDLE SHIPS (NerulioUIImporter.Import), reads back what Unity
// made (import settings, every sprite's rect and border in Unity's L,B,R,T order), then draws every
// case as a UI Image configured by the shipped NerulioUIImporter.ConfigureImage (Sliced/Tiled,
// fillCenter, pixelsPerUnitMultiplier = 1/scale) on a Screen Space - Camera canvas whose camera
// renders into a RenderTexture, and saves the pixels. Button prefabs are instanced in every
// selection state. Judging happens in Python.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

public static class NerulioUIProbe
{
    static string Q(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") + "\"";
    static string F(float v) => v.ToString("R", CultureInfo.InvariantCulture);
    static float N(Dictionary<string, object> d, string k) => d.TryGetValue(k, out object v) && v is double x ? (float)x : 0f;

    public static void Run()
    {
        string root = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        string outDir = Path.Combine(root, "_verify", "out");
        Directory.CreateDirectory(outDir);
        var errors = new List<string>();
        var sb = new StringBuilder();
        sb.Append("{\"unity\":").Append(Q(Application.unityVersion)).Append(",\"graphics\":").Append(Q(SystemInfo.graphicsDeviceType.ToString()))
          .Append(",\"colorSpace\":").Append(Q(PlayerSettings.colorSpace.ToString()));
        try
        {
            var job = (Dictionary<string, object>)NerulioUIImporter.Json.Parse(File.ReadAllText(Path.Combine(root, "_verify", "job.json")));
            string json = Path.Combine(Application.dataPath, "Bundle", "nerulio-ui.json");
            NerulioUIImporter.Export export = NerulioUIImporter.Import(json);
            if (export == null) throw new Exception("NerulioUIImporter.Import returned null");
            sb.Append(",\"warnings\":[").Append(string.Join(",", export.warnings.Select(Q))).Append("]");
            // import settings of every texture, and every sprite as Unity sees it
            var tex = new List<string>();
            foreach (var img in (List<object>)export.data["images"])
            {
                string p = export.assetFolder + "/" + ((Dictionary<string, object>)img)["file"];
                var ti = (TextureImporter)AssetImporter.GetAtPath(p);
                if (ti == null) { tex.Add("{\"asset\":" + Q(p) + ",\"missing\":true}"); continue; }
                tex.Add("{\"asset\":" + Q(p) + ",\"textureType\":" + Q(ti.textureType.ToString()) + ",\"spriteImportMode\":" + Q(ti.spriteImportMode.ToString()) +
                        ",\"filterMode\":" + Q(ti.filterMode.ToString()) + ",\"compression\":" + Q(ti.textureCompression.ToString()) +
                        ",\"mipmaps\":" + (ti.mipmapEnabled ? "true" : "false") + ",\"ppu\":" + F(ti.spritePixelsPerUnit) + "}");
            }
            sb.Append(",\"textures\":[").Append(string.Join(",", tex)).Append("]");
            var sprites = new List<string>();
            foreach (var kv in export.sprites)
            {
                Sprite s = kv.Value;
                sprites.Add(Q(kv.Key) + ":{\"sprite\":" + Q(s.name) + ",\"rect\":[" + F(s.rect.x) + "," + F(s.rect.y) + "," + F(s.rect.width) + "," + F(s.rect.height) +
                            "],\"border\":[" + F(s.border.x) + "," + F(s.border.y) + "," + F(s.border.z) + "," + F(s.border.w) + "],\"texture\":[" + s.texture.width + "," + s.texture.height +
                            "],\"ppu\":" + F(s.pixelsPerUnit) + "}");
            }
            sb.Append(",\"sprites\":{").Append(string.Join(",", sprites)).Append("}");

            var canvasSize = (List<object>)job["canvas"];
            int W = (int)(double)canvasSize[0], H = (int)(double)canvasSize[1];
            var shots = new List<string>();
            var (cam, canvas, rt) = Stage(W, H);
            foreach (Dictionary<string, object> c in (List<object>)job["cases"])
            {
                var slot = (List<object>)c["slot"];
                var go = new GameObject((string)c["id"], typeof(RectTransform), typeof(Image));
                var r = (RectTransform)go.transform;
                r.SetParent(canvas.transform, false);
                Place(r, (float)(double)slot[0], (float)(double)slot[1], N(c, "w"), N(c, "h"));
                NerulioUIImporter.ConfigureImage(go.GetComponent<Image>(), export, (string)c["element"], N(c, "scale"));
            }
            shots.Add(Q("cases") + ":" + Q(Shoot(cam, canvas, rt, Path.Combine(outDir, "path_unity.png"))));
            UnityEngine.Object.DestroyImmediate(canvas.gameObject);
            // buttons: the prefab the importer wrote, one instance per selection state
            var buttons = new List<string>();
            if (job.TryGetValue("buttons", out object bo))
            {
                foreach (Dictionary<string, object> b in (List<object>)bo)
                {
                    string prefabPath = export.assetFolder + "/" + b["button"] + ".prefab";
                    var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
                    if (prefab == null) { errors.Add("no button prefab at " + prefabPath); continue; }
                    int bw = (int)N(b, "w"), bh = (int)N(b, "h");
                    string[] states = { "normal", "hover", "pressed", "disabled", "focus" };
                    string[] unityStates = { "Normal", "Highlighted", "Pressed", "Disabled", "Selected" };
                    var (bcam, bcanvas, brt) = Stage(states.Length * (bw + 16) + 16, bh + 32);
                    Type stateType = typeof(Selectable).GetNestedType("SelectionState", BindingFlags.NonPublic | BindingFlags.Public);
                    MethodInfo transition = typeof(Selectable).GetMethod("DoStateTransition", BindingFlags.NonPublic | BindingFlags.Instance);
                    var info = new List<string>();
                    for (int i = 0; i < states.Length; i++)
                    {
                        var inst = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
                        var r = (RectTransform)inst.transform;
                        r.SetParent(bcanvas.transform, false);
                        Place(r, 16 + i * (bw + 16), 16, bw, bh);
                        var button = inst.GetComponent<Button>();
                        transition.Invoke(button, new object[] { Enum.Parse(stateType, unityStates[i]), true });
                        var img = inst.GetComponent<Image>();
                        var content = (RectTransform)inst.transform.Find("Content");
                        info.Add(Q(states[i]) + ":{\"slot\":[" + (16 + i * (bw + 16)) + ",16," + bw + "," + bh + "],\"sprite\":" + Q(img.overrideSprite ? img.overrideSprite.name : "") +
                                 ",\"type\":" + Q(img.type.ToString()) + ",\"transition\":" + Q(button.transition.ToString()) +
                                 ",\"content\":" + (content ? "[" + F(content.offsetMin.x) + "," + F(content.offsetMin.y) + "," + F(content.offsetMax.x) + "," + F(content.offsetMax.y) + "]" : "null") + "}");
                    }
                    string png = Path.Combine(outDir, "button_" + b["button"] + ".png");
                    Shoot(bcam, bcanvas, brt, png);
                    UnityEngine.Object.DestroyImmediate(bcanvas.gameObject);
                    buttons.Add(Q((string)b["button"]) + ":{\"png\":" + Q(Path.GetFileName(png)) + ",\"w\":" + bw + ",\"h\":" + bh + ",\"states\":{" + string.Join(",", info) + "}}");
                }
            }
            sb.Append(",\"shots\":{").Append(string.Join(",", shots)).Append("}");
            sb.Append(",\"buttons\":{").Append(string.Join(",", buttons)).Append("}");
        }
        catch (Exception e)
        {
            errors.Add((e.InnerException ?? e).ToString());
        }
        sb.Append(",\"errors\":[").Append(string.Join(",", errors.Select(Q))).Append("]}");
        File.WriteAllText(Path.Combine(outDir, "report.json"), sb.ToString());
        Debug.Log("NERULIO_PROBE_DONE errors=" + errors.Count);
        EditorApplication.Exit(0);
    }

    static void Place(RectTransform r, float x, float y, float w, float h)
    {
        // top-left anchored, y down from the canvas top (the canvas is exactly the RenderTexture)
        r.anchorMin = r.anchorMax = new Vector2(0, 1);
        r.pivot = new Vector2(0, 1);
        r.anchoredPosition = new Vector2(x, -y);
        r.sizeDelta = new Vector2(w, h);
    }

    static (Camera, Canvas, RenderTexture) Stage(int w, int h)
    {
        var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Default) { filterMode = FilterMode.Point, antiAliasing = 1 };
        rt.Create();
        var cgo = new GameObject("VerifyCamera", typeof(Camera));
        var cam = cgo.GetComponent<Camera>();
        cam.orthographic = true;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0, 0, 0, 0);
        cam.targetTexture = rt;
        cam.cullingMask = ~0;
        cam.allowMSAA = false;
        cam.allowHDR = false;
        var go = new GameObject("VerifyCanvas", typeof(Canvas), typeof(CanvasScaler));
        var canvas = go.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceCamera;
        canvas.worldCamera = cam;
        canvas.planeDistance = 10;
        canvas.pixelPerfect = false;
        cgo.transform.SetParent(go.transform, true);
        return (cam, canvas, rt);
    }

    static string Shoot(Camera cam, Canvas canvas, RenderTexture rt, string path)
    {
        Canvas.ForceUpdateCanvases();
        cam.Render();
        var prev = RenderTexture.active;
        RenderTexture.active = rt;
        var t = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
        t.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
        t.Apply();
        RenderTexture.active = prev;
        File.WriteAllBytes(path, t.EncodeToPNG());
        var size = ((RectTransform)canvas.transform).sizeDelta;
        return F(size.x) + "x" + F(size.y);
    }
}

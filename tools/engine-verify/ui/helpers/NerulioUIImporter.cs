// NerulioUIImporter.cs - applies a Nerulio Studio UI export (nerulio-ui.json) to its textures and
// builds one Button prefab per button.
// Put this file in any folder called "Editor", the export (nerulio-ui.json + PNGs) anywhere under
// Assets/, then Tools > Nerulio > Import UI export and pick nerulio-ui.json.
//
// What it does:
//  * every PNG: Sprite (2D and UI), Point filter, no compression, no mipmaps, Full Rect mesh,
//    Pixels Per Unit 100 (= the Canvas default Reference Pixels Per Unit, so 1 source pixel = 1 UI unit);
//  * an image used by exactly one element that covers all of it becomes a Single sprite, anything
//    else (an atlas, or one PNG shared by several elements) Multiple, one sprite per element named
//    after it. Unity rects start at the BOTTOM-left: y = imageHeight - (y + h);
//  * the nine-slice becomes the sprite border, in Unity's order (left, bottom, right, top);
//  * every button becomes <button>.prefab next to the JSON: Image (Sliced/Tiled) + Button with
//    Transition = Sprite Swap (hover -> Highlighted, pressed -> Pressed, focus -> Selected,
//    disabled -> Disabled) and a "Content" child inset by the padding.
// Unity has no tile-fit and one Image.Type for both axes: tile-fit is drawn as Tiled, and an element
// with different horizontal/vertical modes as Tiled; both print a warning.
// UI scale for pixel art: ConfigureImage(image, export, element, 2f) sets pixelsPerUnitMultiplier
// so corners are drawn at 2x.
// Needs com.unity.2d.sprite (every 2D template ships it) and com.unity.ugui.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;
using UnityEngine.UI;

public static class NerulioUIImporter
{
    public sealed class Export
    {
        public string jsonPath, assetFolder;
        public Dictionary<string, object> data;
        public Dictionary<string, Sprite> sprites = new Dictionary<string, Sprite>();
        public List<string> warnings = new List<string>();
        public Dictionary<string, object> Element(string name) => (Dictionary<string, object>)((Dictionary<string, object>)data["elements"])[name];
    }

    [MenuItem("Tools/Nerulio/Import UI export (nerulio-ui.json)")]
    public static void ImportSelected()
    {
        string jsonPath = EditorUtility.OpenFilePanel("Nerulio UI export", Application.dataPath, "json");
        if (string.IsNullOrEmpty(jsonPath)) return;
        Export e = Import(jsonPath);
        if (e != null) Debug.Log($"Nerulio: {e.sprites.Count} sprite(s) ready.");
    }

    /// Applies every image and builds the button prefabs. Also callable from your own editor scripts.
    public static Export Import(string jsonPath)
    {
        var export = new Export { jsonPath = jsonPath };
        export.data = Json.Parse(File.ReadAllText(jsonPath)) as Dictionary<string, object>;
        if (export.data == null || !"nerulio-ui".Equals(Str(export.data, "format")))
        {
            Debug.LogError("Nerulio: that file is not a nerulio-ui export.");
            return null;
        }
        string folder = Path.GetDirectoryName(Path.GetFullPath(jsonPath));
        export.assetFolder = ToAssetPath(folder);
        if (export.assetFolder == null) { Debug.LogError("Nerulio: the export is not inside this project's Assets folder."); return null; }
        var images = (List<object>)export.data["images"];
        var elements = (Dictionary<string, object>)export.data["elements"];
        for (int i = 0; i < images.Count; i++)
        {
            var img = (Dictionary<string, object>)images[i];
            var mine = elements.Where(kv => Num((Dictionary<string, object>)kv.Value, "image") == i).ToList();
            if (mine.Count == 0) continue;
            string texturePath = export.assetFolder + "/" + Str(img, "file");
            Apply(export, texturePath, (int)Num(img, "width"), (int)Num(img, "height"), mine);
        }
        foreach (var kv in elements)
        {
            var e = (Dictionary<string, object>)kv.Value;
            string mh = Mode(e, "horizontal"), mv = Mode(e, "vertical");
            if (mh == "tile-fit" || mv == "tile-fit") export.warnings.Add($"{kv.Key}: Unity has no tile-fit; it is drawn as Tiled (partial tiles)");
            if (mh != mv) export.warnings.Add($"{kv.Key}: Unity uses one Image.Type for both axes ({mh}/{mv}); drawn as Tiled");
        }
        if (export.data.TryGetValue("buttons", out object buttons) && buttons is Dictionary<string, object> bd)
            foreach (var kv in bd) CreateButtonPrefab(export, kv.Key, (Dictionary<string, object>)kv.Value);
        foreach (string w in export.warnings) Debug.LogWarning("Nerulio: " + w);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        return export;
    }

    static void Apply(Export export, string texturePath, int width, int height, List<KeyValuePair<string, object>> mine)
    {
        var importer = AssetImporter.GetAtPath(texturePath) as TextureImporter;
        if (importer == null) { export.warnings.Add($"{texturePath} is not an imported texture"); return; }
        var first = (Dictionary<string, object>)mine[0].Value;
        var r0 = (Dictionary<string, object>)first["rect"];
        bool single = mine.Count == 1 && Num(r0, "x") == 0 && Num(r0, "y") == 0 && Num(r0, "w") == width && Num(r0, "h") == height;
        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = single ? SpriteImportMode.Single : SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = 100f;
        // Pixel art: no filtering, no compression, no mipmaps. Change these if your art is not pixel art.
        importer.filterMode = FilterMode.Point;
        importer.mipmapEnabled = false;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.alphaIsTransparency = true;
        importer.wrapMode = TextureWrapMode.Clamp;
        importer.maxTextureSize = Math.Max(importer.maxTextureSize, NextPow2(Math.Max(width, height)));
        var settings = new TextureImporterSettings();
        importer.ReadTextureSettings(settings);
        settings.spriteMeshType = SpriteMeshType.FullRect;
        settings.spriteAlignment = (int)SpriteAlignment.Center;
        importer.SetTextureSettings(settings);
        if (single) importer.spriteBorder = Border(first);
        importer.SaveAndReimport();
        if (!single)
        {
            var factory = new SpriteDataProviderFactories();
            factory.Init();
            ISpriteEditorDataProvider provider = factory.GetSpriteEditorDataProviderFromObject(importer);
            provider.InitSpriteEditorDataProvider();
            var old = provider.GetSpriteRects().ToDictionary(s => s.name, s => s.spriteID);
            var rects = new List<SpriteRect>();
            foreach (var kv in mine)
            {
                var e = (Dictionary<string, object>)kv.Value;
                var r = (Dictionary<string, object>)e["rect"];
                float w = Num(r, "w"), h = Num(r, "h");
                rects.Add(new SpriteRect
                {
                    name = kv.Key,
                    spriteID = old.TryGetValue(kv.Key, out GUID id) ? id : GUID.Generate(),
                    // Unity textures start at the bottom-left corner
                    rect = new Rect(Num(r, "x"), height - Num(r, "y") - h, w, h),
                    pivot = new Vector2(0.5f, 0.5f),
                    alignment = SpriteAlignment.Center,
                    border = Border(e)
                });
            }
            provider.SetSpriteRects(rects.ToArray());
            provider.Apply();
            importer.SaveAndReimport();
        }
        var assets = AssetDatabase.LoadAllAssetsAtPath(texturePath).OfType<Sprite>().ToList();
        foreach (var kv in mine)
        {
            Sprite s = single ? assets.FirstOrDefault() : assets.FirstOrDefault(a => a.name == kv.Key);
            if (s != null) export.sprites[kv.Key] = s;
            else export.warnings.Add($"{kv.Key}: no sprite was created in {texturePath}");
        }
    }

    /// Unity's sprite border order: left, bottom, right, top (source pixels).
    public static Vector4 Border(Dictionary<string, object> element)
    {
        var ns = element.TryGetValue("nineSlice", out object o) ? o as Dictionary<string, object> : null;
        float L = Num(ns, "left"), R = Num(ns, "right"), T = Num(ns, "top"), B = Num(ns, "bottom");
        return new Vector4(L, B, R, T);
    }

    static string Mode(Dictionary<string, object> e, string axis)
    {
        var st = e.TryGetValue("stretch", out object o) ? o as Dictionary<string, object> : null;
        string m = st != null ? Str(st, axis) : null;
        return string.IsNullOrEmpty(m) ? "stretch" : m;
    }

    /// Image.Type for an element: Sliced when both axes stretch, Tiled otherwise.
    public static Image.Type ImageType(Dictionary<string, object> element) =>
        Mode(element, "horizontal") == "stretch" && Mode(element, "vertical") == "stretch" ? Image.Type.Sliced : Image.Type.Tiled;

    /// Sets an Image up for one element: sprite, type, fill centre, and the pixel-art scale
    /// (uiScale 2 draws the corners at 2x; the Canvas Reference Pixels Per Unit must be 100).
    public static void ConfigureImage(Image image, Export export, string element, float uiScale = 1f)
    {
        var e = export.Element(element);
        image.sprite = export.sprites.TryGetValue(element, out Sprite s) ? s : null;
        image.type = ImageType(e);
        image.fillCenter = !e.TryGetValue("drawCenter", out object dc) || !(dc is bool b) || b;
        image.pixelsPerUnitMultiplier = 1f / Mathf.Max(0.0001f, uiScale);
        image.preserveAspect = false;
    }

    static void CreateButtonPrefab(Export export, string name, Dictionary<string, object> states)
    {
        string normal = Str(states, "normal");
        if (normal == null || !export.sprites.ContainsKey(normal)) { export.warnings.Add($"button {name}: no normal element"); return; }
        var e = export.Element(normal);
        var r = (Dictionary<string, object>)e["rect"];
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        try
        {
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(Num(r, "w"), Num(r, "h"));
            var image = go.GetComponent<Image>();
            ConfigureImage(image, export, normal);
            var button = go.GetComponent<Button>();
            button.targetGraphic = image;
            button.transition = Selectable.Transition.SpriteSwap;
            Sprite Get(string state) { string el = Str(states, state); return el != null && export.sprites.TryGetValue(el, out Sprite sp) ? sp : null; }
            button.spriteState = new SpriteState
            {
                highlightedSprite = Get("hover"),
                pressedSprite = Get("pressed"),
                selectedSprite = Get("focus"),
                disabledSprite = Get("disabled"),
            };
            var content = new GameObject("Content", typeof(RectTransform));
            var crt = (RectTransform)content.transform;
            crt.SetParent(rt, false);
            crt.anchorMin = Vector2.zero;
            crt.anchorMax = Vector2.one;
            var pad = e.TryGetValue("padding", out object p) && p is Dictionary<string, object> pd ? pd : e["nineSlice"] as Dictionary<string, object>;
            crt.offsetMin = new Vector2(Num(pad, "left"), Num(pad, "bottom"));
            crt.offsetMax = new Vector2(-Num(pad, "right"), -Num(pad, "top"));
            string path = export.assetFolder + "/" + name + ".prefab";
            PrefabUtility.SaveAsPrefabAsset(go, path);
        }
        finally { UnityEngine.Object.DestroyImmediate(go); }
    }

    static string ToAssetPath(string absolute)
    {
        string full = Path.GetFullPath(absolute).Replace('\\', '/');
        string root = Path.GetFullPath(Application.dataPath).Replace('\\', '/');
        return full.StartsWith(root, StringComparison.OrdinalIgnoreCase) ? "Assets" + full.Substring(root.Length) : null;
    }

    static int NextPow2(int v) { int p = 32; while (p < v) p *= 2; return p; }
    static float Num(Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out object v) && v is double x ? (float)x : 0f;
    static string Str(Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out object v) ? v as string : null;

    /// Minimal JSON reader (objects -> Dictionary<string, object>, arrays -> List<object>, numbers -> double).
    public static class Json
    {
        public static object Parse(string s) { int i = 0; object v = Value(s, ref i); return v; }
        static void Ws(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
        static object Value(string s, ref int i)
        {
            Ws(s, ref i);
            if (i >= s.Length) throw new FormatException("unexpected end of JSON");
            char c = s[i];
            if (c == '{')
            {
                var d = new Dictionary<string, object>(); i++; Ws(s, ref i);
                if (s[i] == '}') { i++; return d; }
                while (true)
                {
                    Ws(s, ref i); string k = (string)Value(s, ref i); Ws(s, ref i); i++; // ':'
                    d[k] = Value(s, ref i); Ws(s, ref i);
                    if (s[i++] == '}') return d;
                }
            }
            if (c == '[')
            {
                var l = new List<object>(); i++; Ws(s, ref i);
                if (s[i] == ']') { i++; return l; }
                while (true) { l.Add(Value(s, ref i)); Ws(s, ref i); if (s[i++] == ']') return l; }
            }
            if (c == '"')
            {
                var sb = new StringBuilder(); i++;
                while (s[i] != '"')
                {
                    if (s[i] == '\\')
                    {
                        i++;
                        char e = s[i++];
                        if (e == 'u') { sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16)); i += 4; }
                        else sb.Append(e == 'n' ? '\n' : e == 't' ? '\t' : e == 'r' ? '\r' : e == 'b' ? '\b' : e == 'f' ? '\f' : e);
                    }
                    else sb.Append(s[i++]);
                }
                i++;
                return sb.ToString();
            }
            if (string.CompareOrdinal(s, i, "true", 0, 4) == 0) { i += 4; return true; }
            if (string.CompareOrdinal(s, i, "false", 0, 5) == 0) { i += 5; return false; }
            if (string.CompareOrdinal(s, i, "null", 0, 4) == 0) { i += 4; return null; }
            int st = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            return double.Parse(s.Substring(st, i - st), CultureInfo.InvariantCulture);
        }
    }
}

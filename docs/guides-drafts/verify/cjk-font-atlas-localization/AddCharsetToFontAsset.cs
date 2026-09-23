using System.IO;
using TMPro;
using UnityEditor;
using UnityEngine;

public static class AddCharsetToFontAsset
{
    // Select a TMP font asset whose Atlas Population Mode is Dynamic, then run this menu item.
    [MenuItem("Tools/Fonts/Add charset.txt to selected TMP Font Asset")]
    static void AddFromMenu() =>
        Add(Selection.activeObject as TMP_FontAsset, "Assets/Localization/charset.txt");

    public static string Add(TMP_FontAsset fontAsset, string charsetPath)
    {
        string chars = File.ReadAllText(charsetPath).TrimEnd('\r', '\n');
        fontAsset.TryAddCharacters(chars, out string missing);
        EditorUtility.SetDirty(fontAsset);
        AssetDatabase.SaveAssets();
        if (!string.IsNullOrEmpty(missing))
            Debug.LogWarning($"{fontAsset.name} has no glyph for: {missing}");
        return missing;
    }
}

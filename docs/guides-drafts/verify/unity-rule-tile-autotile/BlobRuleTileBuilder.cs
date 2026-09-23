// Assets/Editor/BlobRuleTileBuilder.cs  (needs 2D Tilemap Extras, com.unity.2d.tilemap.extras)
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

public static class BlobRuleTileBuilder
{
    // Blob mask bits (image y down): N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128, as Unity cell offsets (y up).
    static readonly (int bit, Vector3Int pos)[] Dirs =
    {
        (1, new Vector3Int(0, 1, 0)), (2, new Vector3Int(1, 1, 0)), (4, new Vector3Int(1, 0, 0)),
        (8, new Vector3Int(1, -1, 0)), (16, new Vector3Int(0, -1, 0)), (32, new Vector3Int(-1, -1, 0)),
        (64, new Vector3Int(-1, 0, 0)), (128, new Vector3Int(-1, 1, 0)),
    };

    // sprites[i] shows the neighbourhood masks[i] (-1 = unused cell). One rule per sprite.
    public static RuleTile Build(Sprite[] sprites, int[] masks, Sprite defaultSprite, string assetPath)
    {
        var rules = new List<RuleTile.TilingRule>();
        for (int i = 0; i < sprites.Length; i++)
        {
            if (masks[i] < 0) continue;
            var rule = new RuleTile.TilingRule
            {
                m_Sprites = new[] { sprites[i] },
                m_NeighborPositions = new List<Vector3Int>(),
                m_Neighbors = new List<int>(),
            };
            for (int d = 0; d < 8; d++)
            {
                bool corner = d % 2 == 1;
                // A corner only counts when both sides next to it are connected; otherwise leave it empty.
                if (corner && ((masks[i] & Dirs[d - 1].bit) == 0 || (masks[i] & Dirs[(d + 1) % 8].bit) == 0))
                    continue;
                rule.m_NeighborPositions.Add(Dirs[d].pos);
                rule.m_Neighbors.Add((masks[i] & Dirs[d].bit) != 0
                    ? RuleTile.TilingRuleOutput.Neighbor.This       // green arrow
                    : RuleTile.TilingRuleOutput.Neighbor.NotThis);  // red cross
            }
            rules.Add(rule);
        }
        var tile = ScriptableObject.CreateInstance<RuleTile>();
        tile.m_DefaultSprite = defaultSprite;
        tile.m_TilingRules = rules.OrderByDescending(r => r.m_Neighbors.Count).ToList(); // most specific first
        AssetDatabase.CreateAsset(tile, assetPath);
        return tile;
    }
}

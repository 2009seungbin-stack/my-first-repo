Set **Default Texture Filter** to `Nearest` and your sprites stop blurring. See [the jitter guide](guide:sample-guide#why) and [Pixel Lab](tool:pixel-lab).

A second intro paragraph with *emphasis* and a [link](https://docs.godotengine.org/en/stable/).

## The short fix {#short-fix}

:::steps
1. **Open Project Settings.** Go to *Project > Project Settings > Rendering > Textures*.
2. **Set the filter.** Change `Default Texture Filter` to `Nearest`.
  - Sub point one
  - Sub point two
3. **Restart the scene.** Press F6.
:::

> **Tip:** Snap 2D transforms too, see [below](#why).

## Why it blurs {#why}

| Setting | Default | Pixel art |
|---|---|---:|
| Filter | Linear | Nearest |
| Mipmaps \| none | Off | Off |

```gdscript
# player.gd
extends AnimatedSprite2D
func _ready() -> void:
    play("run") # <b>not html</b>
```

- One
- Two with `code` and **bold**
  continued line

1. First
2. Second

:::nerulio ws=sprite
Drop the sheet on the Studio. It detects the grid.

- Tag the rows
- Export for Godot 4
:::

## FAQ {#faq}

### Why is my sprite still blurry?

Check the node's own `texture_filter` property.

### Does this work in Godot 4.7?

Yes.

## Sources {#sources}

- [Godot docs: 2D](https://docs.godotengine.org/en/stable/)

---
title: "Three image models from late October, and what they change for game art"
date: 2026-10-31
summary: "FLUX 3 Image Klein, Canva Craft and the MAI-Image-2.7 preview, read from a sprite and store-art point of view: running locally, the license threshold, and how to treat an editing-only model."
status: draft
sources:
  - title: "Black Forest Labs — FLUX 3 Image Klein: open weights, 5.6B parameters (2026-10-15)"
    url: "https://bfl.ai/blog/flux-3-image-klein"
  - title: "Hugging Face — black-forest-labs/flux-3-image-klein model card"
    url: "https://huggingface.co/black-forest-labs/flux-3-image-klein"
  - title: "TechCrunch — Canva releases its first image generation model (2026-10-22)"
    url: "https://techcrunch.com/2026/10/22/canva-releases-its-first-image-generation-model/"
  - title: "Microsoft AI — MAI Image 2.7 debuts above GPT Image 2.5 Flare on Artificial Analysis and #3 on Arena (2026-10-27)"
    url: "https://microsoft.ai/news/mai-image-2-7-debut/"
---
Between October 10 and 31, three new image models arrived: an open-weights model you run on your own PC, a model built into a design tool, and an editing-only preview. Each company leads with its own evaluation, so this piece skips the leaderboard comparison and focuses on what an indie developer or pixel artist can actually change in their workflow.

## 1. FLUX 3 Image Klein — open weights that fit an 8 GB card

**What happened.** Black Forest Labs released FLUX 3 Image Klein on October 15. The image generator has 5.6B parameters, and one model handles text-to-image, editing, and generation with up to 10 reference images. Bounding boxes can place elements or confine an edit to one area. According to the announcement, the INT8 build runs on GeForce RTX cards with as little as 8 GB of VRAM through ComfyUI or Diffusers. There is a base checkpoint for fine-tuning and a step-distilled checkpoint for fast generation.

The license is the FLUX Kommunity License: free commercial use for individuals and companies with less than $5M in annual revenue; larger organizations need a self-hosted license or the API.

**Why it matters for game assets.** For a small team the biggest change is not price but that **iteration can stay on your own machine**. A character's front, side and back views or an expression set no longer require uploading your concept art to an outside service each time. Multiple reference images help keep one character consistent, and a bounded edit lets you change one prop while leaving the rest of the image alone.

What it produces, though, is a high-resolution illustration, not pixels on a grid. Dropped into a game as is, it becomes "art that looks like pixel art": soft edges and colors bleeding into many near-identical shades.

**What to do.**
- Check whether your team is under the revenue threshold, and read the license text Black Forest Labs published before any commercial use. This article is only a summary.
- Use generations for concepts and silhouettes, and rebuild final sprites on the grid. Reducing to the target resolution with a limited palette in [Pixel Lab](/en/game/pixel-lab/) and then cleaning up stray pixels by hand is the least painful order.
- Record the model name, checkpoint, date and reference images next to the asset file. You can reuse that note when a store form or a publisher asks.

## 2. Canva Craft — a design-tool model aimed at text and layout

**What happened.** TechCrunch reports that Canva released its own image model, Canva Craft, on October 22. It works in two stages: it first plans spatial relationships, scale, visual hierarchy and the text to include, then generates the image. It supports up to 2K resolution and 30 aspect ratios, and Canva highlights legible text and precise edits that leave the rest of the image unchanged. It was trained on human-designed Canva templates rather than photographs, and results can be converted into layered designs with Magic Layers. All users can try it in the Dream Lab tab, and Canva says it will also be available through the Canva API.

**Why it matters for game assets.** This is news for **store and marketing art** more than in-game sprites. Steam capsules, launch banners and vertical social images live or die by text and layout, which is exactly what Canva says Craft is good at. If the result splits into layers, swapping a logo or a line of copy across several sizes gets easier.

**What to do.**
- Keep your logo and key art as your own originals; use the model to experiment with backgrounds and composition.
- The TechCrunch article does not cover commercial-use terms. Check the AI-generated content clauses in Canva's terms before using it for store art.
- Before upload, [compress](/en/image/compress/) each export and confirm it matches the exact size the store asks for.

## 3. MAI-Image-2.7 preview — editing first, generation later

**What happened.** Microsoft AI released MAI Image 2.7 in preview on October 27. For now it is **editing only**; text-to-image is described as "coming soon". You can try it on Arena, Artificial Analysis and MAI Playground. Microsoft highlights restyling or relighting a whole scene, changing text and symbols inside an image, and restoring or enhancing existing assets. The announcement does not mention pricing or an API.

**Why it matters for game assets.** Turning existing art into another time of day or mood comes up constantly: a daytime background at night, an old promo image refreshed. If an editing model handles that well, more existing assets can be reused instead of redrawn.

**What to do.**
- It is a preview with no announced API, so do not build a production pipeline on it. Testing a few representative images is enough for now.
- Before uploading unreleased art to a public demo, read how that service's terms treat uploaded images.
- If you ship an edited result, keep the original next to it. For pixel art, first see whether a predictable method such as [Palette swap](/en/palette-swap/) gets the same effect.

## Takeaway: one habit to change this week

All three moved toward fast drafts and revisions rather than "drawing it for you". So the change worth making this week is not the model but the **record**: for every asset where AI generated or edited something, keep one line with the model, date, license terms and original file. When a license changes or a store asks about AI use, that line is your only evidence. When you turn generations into a sheet, aligning frame sizes and transparency first with the [Sprite sheet slicer](/en/sprite-slicer/) and [Remove background](/en/image/remove-bg/) shortens the step into the engine.

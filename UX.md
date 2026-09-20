# FileForge contextual UX

## Entry and visible choices

Home keeps one upload surface and four existing popular cards. It does not display a 16-tool expansion grid. Four original workspaces remain in the navigation; Pixel is presented as Game. The magnifying-glass button and Ctrl/⌘+K open Explore. Explore has search, category filters, favorite IDs and three recent tool IDs; none are auto-expanded onto home. There is no forced welcome modal or tour.

A specialized URL opens its own localized name, input guidance and action. All sixteen recipe routes reuse the image input/preview shell; that implementation detail does not add another top-level workspace. The focused UI hides unrelated image tools and exposes run, settings, comparison and download. Results show only related next tasks. Single-image results can be consumed into another editor; ZIP preview thumbnails are not silently treated as full-resolution source assets.

## Settings and output trust

Settings start with essential controls; advanced controls use a disclosure element. A completed run closes its settings so the result is visible. Sprite detection is a candidate step: users can edit rectangles, add/delete/merge and reorder before exporting. Detection uses alpha connectivity, not character recognition; separate limbs or touching subjects may need correction. Opaque sheets require prior background cleanup or manual/grid slicing.

Sprite sheet/normalize inputs offer explicit up/down controls usable on touch and keyboard, plus desktop drag reordering. Frame alignment preserves cropped pixel size and fails if the selected canvas is too small. Palette shading preservation is explicitly a luminance-offset approximation. Marketplace crop/fit previews and limits do not claim platform approval or guaranteed print quality.

Every output requires an explicit download. Processing errors do not create success results. All-blank margin detection is an error rather than an invented crop. Existing target-size compression keeps its original target-not-met behavior.

## Compare/share

Before/after uses an Original/Result toggle. Pixel-oriented previews disable smoothing and use pixelated rendering. A 1200×630 PNG share card includes localized labels and a small configured brand. Supported file-sharing browsers use Web Share; others download the card. No clipboard-image feature is claimed. For ZIP workflows the card depicts the first-item preview, not every item in the archive; its displayed dimensions are preview dimensions. Asset downloads have no watermark.

## Language and state

ko/en/ja labels, descriptions and limitations are supplied for each new tool. A language change rerenders labels without re-reading user files or replacing the result Blob. Current options, frame edits and order remain in memory. Setting links serialize primitive option values, not file contents. Browser back/forward and language paths remain in the existing intent layer.

Favorite/recent storage is guarded against unavailable localStorage; session-only choices still work. Dialog focus returns to its invoking element. Search and category buttons have accessible labels/states; color swatches expose their hex values rather than color alone.

## Mobile and constraints

At a 390-pixel viewport, recipe settings become a bounded bottom panel and the main action wraps rather than causing horizontal overflow. New action controls target at least 44 pixels. The result remains reachable after closing settings. Desktop and ko/en/ja mobile screenshots are captured by the recipe browser suite.

Actual iOS Safari, Android device performance, screen readers and OS-native file sharing were not tested in the local sandbox. A headless viewport test is not a physical-device compatibility guarantee. The original PDF/image generic docks are preserved, rather than rewritten during this expansion.

## Static intent pages

Sixteen canonical new paths plus four aliases feed the existing locale-aware static generator. There are 208 total HTML entry files including old entries, language prefixes and policies; this is not 208 features. Sitemaps contain canonical representative intents, not query combinations or unfinished-tool URLs. Existing canonical/hreflang behavior is preserved.

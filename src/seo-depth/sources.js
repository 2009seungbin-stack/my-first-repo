/** Official documentation hosts that intent content may cite in `versions.sources` and inline
 * [text](https://…) links (tests/seo-depth.test.mjs). One host per line: add only the publisher's own
 * documentation (engine, tool, format owner, standards body, platform help centre), with a comment
 * when the reason is not obvious. github.com only for the official repository of that project. */
export const SOURCE_HOSTS=new Set([
 'creativecommons.org', // CC0 1.0 legal and human-readable terms for original avatar parts
 'ambientcg.com',
 'aomedia.org',
 'aseprite.org',
 'caniuse.com',
 'codeandweb.com',
 'datatracker.ietf.org',
 'defold.com',
 'developer.apple.com',
 'developer.gimp.org', // GIMP's own specification of the .gpl palette format
 'developer.mozilla.org',
 'developers.kakao.com', // Kakao JavaScript Share setup and app key/domain requirements
 'developers.line.biz', // LINE's own share URL and media restrictions
 'developers.google.com',
 'doc.mapeditor.org',
 'doc.starling-framework.org', // Starling framework API reference: owner of the Sparrow/Starling TextureAtlas XML format
 'docs.blender.org',
 'docs.godotengine.org',
 'docs.phaser.io',
 'docs.substance3d.com',
 'docs.unity.com',
 'docs.unity3d.com',
 'ezgif.com', // ezgif's own tool pages (formats, limits, retention), for game/ezgif-sprite-cutter-alternative
 'en.esotericsoftware.com',
 'esotericsoftware.com',
 'ffmpeg.org',
 'gamemaker.io',
 'gdevelop.io',
 'github.com',
 'godotengine.org',
 'help.instagram.com',
 'help.x.com',
 'helpx.adobe.com',
 'ldtk.io',
 'learn.microsoft.com',
 'libgdx.com',
 'lospec.com',
 'love2d.org',
 'manual.gamemaker.io',
 'newdocs.phaser.io',
 'opensource.adobe.com',
 'phaser.io',
 'pixijs.com',
 'pixijs.download',
 'registry.khronos.org',
 'rpgmakerofficial.com', // RPG Maker MZ official help (Gotcha Gotcha Games): Asset Standards

 'spec.lottiefiles.com',
 'tech.ebu.ch', // EBU R 95, the broadcast safe-area recommendation (ui group)
 'www.angelcode.com', // BMFont, the owner of the .fnt format (ui group)
 'www.gnu.org', // GNU gettext manual, the owner of the .po format (ui group)
 'support.apple.com',
 'support.discord.com',
 'support.google.com',
 'unity.com',
 'w3c.github.io',
 'web.dev',
 'wiki.gdevelop.io',
 'www.adobe.com',
 'www.adobe.io',
 'www.aseprite.org',
 'www.blender.org',
 'www.codeandweb.com',
 'www.facebook.com',
 'www.ffmpeg.org',
 'www.iso.org',
 'www.khronos.org',
 'www.linkedin.com',
 'www.love2d.org',
 'www.mapeditor.org',
 'www.pdfa.org',
 'www.rfc-editor.org',
 'www.rpgmakerweb.com',
 'www.spritefusion.com', // Sprite Fusion's own documentation (compared on game/sprite-fusion-alternative)
 'www.w3.org',
]);

# Studio vertical — sources, automation and coverage

Branch `nerulio/n2-data-studio`. Research done 2026-09-28/29 by opening every page listed here
(retrieval date in each seed source). Seed files: `data/seed/studio/{os-releases,daws-a,apps-b,
plugins-a,plugins-b,plugins-c,plugins-d,plugins-e,interfaces}.json`. Preflight rules:
`docs/n2/preflight-contract.md`.

## 1. Coverage (validate-seed passes for all files)

| Entity type | Count | Notes |
| --- | --- | --- |
| app | 11 | Ableton Live, Logic Pro, FL Studio, Cubase, Pro Tools, Fender Studio Pro (ex-Studio One), REAPER, Bitwig Studio, Blender, Godot, OBS Studio |
| plugin | 158 | FabFilter 14, u-he 17, Native Instruments 12, iZotope 20, Arturia 4, Plugin Alliance 8, Slate 5, XLN 8, SSL 7, UA 2 families, Valhalla 10, Soundtoys 18, Xfer 1, Vital 1, Cableguys 1, Toontrack 4, oeksound 3, Surge XT 1, Waves 12, Eventide 7, Softube 3 |
| audio_device | 35 | Steinberg UR 8, Focusrite 7 families, UA 2 families, RME 4, MOTU 3, Audient 6, SSL 5 |
| os_release | 12 | macOS 13, 14, 15, 26, 27; Windows 10 (family + 22H2), Windows 11 (family + 23H2, 24H2, 25H2, 26H1) |
| vendor | 36 | |
| **total** | **252** | 9 seed files |

- Facts: 1,078 (os_support 204, homepage 174, min_macos 142, apple_silicon 141, min_windows 140,
  formats 133, latest_version 59, latest_driver 19, license_model 9, plugin_formats 7, OS facts 45).
- Versions: 158 · relations: 209 (`made_by`, `part_of`) · sources: 231 (225 OFFICIAL, 5
  OFFICIAL_API, 1 FEED) — every fact/row/version cites one of them.
- **Compatibility rows: 1,183** — supported 1,043 · unsupported 113 · unknown 26 ·
  works_with_issues 1. Targets: macOS 13 133, 14 165, 15 159, 26 159, **27 64**; Windows 10 family
  89 + 22H2 32; Windows 11 family 189 + 23H2 1, 24H2 18, 25H2 2; host DAWs 172 (plug-in → app rows
  from vendor "tested/supported DAW" lists: Arturia, Slate, XLN, SSL, Cableguys).
- macOS 27 (released 2026-09-14) statements captured: supported — Ableton Live 11/12 (Apple
  silicon), Waves V17; unsupported / not yet — Native Instruments, Pro Tools, Focusrite, SSL
  interfaces and plug-ins; unknown / testing — Steinberg (Cubase, UR), Universal Audio, Slate.

## 2. Automated sources (collectors/)

| Adapter | Endpoint | Documented? | Terms / robots | Cadence | Output |
| --- | --- | --- | --- | --- | --- |
| `studio-github-releases` | `https://api.github.com/repos/{godotengine/godot, obsproject/obs-studio, surge-synthesizer/releases-xt}/releases?per_page=30` | Yes — GitHub REST "List releases" | GitHub API terms, 60 unauthenticated req/h; 3 requests/run | 24 h | `app:godot`, `app:obs-studio`, `plugin:surge-synth-team-surge-xt`: latest stable version (OFFICIAL — the projects' own releases) + up to 12 versions (betas/RCs as `prerelease`); release-page links only, never assets |
| `blender-releases` | `https://projects.blender.org/api/v1/repos/blender/blender/tags?limit=50` | Yes — Forgejo API, swagger at `/api/swagger` (HTTP 200) | robots.txt is behind a Cloudflare browser challenge (could not be read by a script); 1 request/run | 24 h | `app:blender`: latest `vX.Y.Z` tag + 12 versions; date = tag commit timestamp (labelled) |
| `reaper-whatsnew` | `https://www.reaper.fm/whatsnew.txt` | Official changelog linked from reaper.fm/download.php; plain text, "vX.YY - Month D YYYY" headings | robots.txt → 404 (no restrictions); 1 request (~1.5 MB)/run | 24 h | `app:reaper`: latest version + 12 dated versions (tolerates "Apr"/"Feburary" headings in old entries) |
| `studio-compat-kb-watch` | `https://{host}/api/v2/help_center/{locale}/articles/{id}.json` for 22 tracked vendor compatibility articles (Ableton, Steinberg, PreSonus, iZotope, Arturia, Plugin Alliance, Slate, XLN, UA, Focusrite, SSL, Audient) | Yes — Zendesk Help Center API (public for published articles) | 1 request per article per run, 1.5 s per-host spacing; stores title, `edited_at` and a 16-hex body hash only | 24 h | sources only (no facts): a changed hash means the curated rows citing that article need re-verification |
| `studio-vendor-manual` | — (`mode:'manual'`) | — | — | weekly Jun–Oct, monthly otherwise | MANUAL_SOURCE: curated seed; procedure in the adapter header |

Live runs 2026-09-28 (`node tools/platform/collect.mjs --adapter <id> --limit 5`): all four auto
adapters returned `error:null`, `validation:[]` — github-releases 3 snapshots/3 entities (Godot
4.7.2, OBS 32.2.2 + 33.0.0-beta4, Surge XT 1.3.4), blender-releases 1/1 (5.2.2, 4.5.14 LTS), reaper-whatsnew 1/1
(7.80, 2026-09-13), kb-watch 22 snapshots/0 entities (all 22 articles fetched).

Why the rest is manual: vendors publish compatibility as HTML tables or free-form articles, often
with conditions ("compatible with known issues", "testing in progress", "requires 8.8.0"). Mapping
that to a status must not be guessed by a scraper; the kb watcher tells curators *when* to look.

## 3. Manual source inventory (all OFFICIAL, opened 2026-09-28/29)

Access: "HTML" = normal page; "Zendesk JSON" = the Help Center API used to read the article
because the HTML sits behind a Cloudflare challenge (same content); "embedded JSON" = structured
data inside the HTML page.

| Area | Page(s) | Access | Notes |
| --- | --- | --- | --- |
| macOS releases | support.apple.com/en-us/100100 (security releases, dates 2024+), /121012 (2022-23), /109033 (names + latest versions), /127255 (macOS 27 compatible Macs: Apple silicon only), /122867 (macOS 26 compatible Macs) | HTML | macOS 27 "Golden Gate" released 2026-09-14 |
| Windows releases | learn.microsoft.com release-health (Windows 11, Windows 10) and lifecycle pages (Home/Pro) | HTML | 25H2 current, 24H2 Home/Pro end 2026-10-13, 26H1 new-devices only, Windows 10 retired 2025-10-14 |
| Ableton Live | help.ableton.com articles 115001261150 (Mac compatibility), 115001663530 (requirements), 209775965 (Windows), 5937501570460 (plug-in formats); ableton.com release notes, shop, imprint | Zendesk JSON + HTML | macOS 27 supported on Apple silicon for Live 11/12 |
| Logic Pro | Mac App Store page (version history, "Requires macOS 15.6"), support.apple.com/109503 (release notes), Logic Pro user guide (Audio Units), apple.com/logic-pro | HTML | |
| FL Studio | image-line.com download (26.1.6), pricing, KB ans=82/654/668, manual "Plugin Standards" | HTML | Windows on ARM not supported |
| Cubase + Steinberg UR | steinberg.net/system-requirements (embedded JSON, 66 products), helpcenter.steinberg.de macOS 27 / Tahoe / Sequoia / Windows 11 / VST 2 articles | embedded JSON + Zendesk JSON | Steinberg: refrain from macOS 27; Cubase 14 listed incompatible on Tahoe 26.1+ |
| Pro Tools | kb.avid.com: OS compatibility chart, system requirements, macOS known issues, macOS Golden Gate support; avid.com/pro-tools (AAX, licensing) | HTML | Pro Tools "not yet supported" on macOS 27 (page dated 2026-08-01) |
| Fender Studio Pro (Studio One) | Fender Studio Pro 8 Quick Start Guide PDF (fmicassets.com), support.presonus.com Tahoe article, upgrade article | PDF + Zendesk JSON | fender.com pages return 403 to scripts; latest version & plug-in formats not captured |
| REAPER | reaper.fm download/about/purchase pages, whatsnew.txt | HTML + feed | |
| Bitwig Studio | bitwig.com download, overview, buy, 6.1.1 release notes | HTML | formats stated only as "VST/CLAP" |
| Blender / Godot / OBS | blender.org requirements, download, license; docs.godotengine.org system requirements, godotengine.org license + governance; obsproject.com download, GitHub license | HTML + APIs | Blender 5.x Apple silicon only |
| FabFilter | fabfilter.com product pages (14), download page (versions/dates), about | HTML | no macOS 26/27 statement found → no macOS rows |
| u-he | u-he.com product pages + release notes (17 products) | HTML | Linux builds are beta |
| Native Instruments | support.native-instruments.com (Freshdesk) macOS and Windows compatibility articles; native-instruments.com product pages | HTML | NI: not supported on macOS 27; Windows ARM not supported |
| iZotope | support.izotope.com macOS / Windows compatibility | Zendesk JSON | per-product minimum versions for macOS 13–26 |
| Arturia | support.arturia.com Tahoe, Sequoia, Apple Silicon, instruments/effects compatibility | Zendesk JSON | all current products validated on Tahoe |
| Plugin Alliance | support.plugin-alliance.com requirements, Tahoe, Apple Silicon; products.json (names only) | Zendesk JSON + Shopify JSON | macOS 13–26, Windows 10–11 |
| Slate Digital | support.slatedigital.com requirements, OS, DAWs, Golden Gate; product pages | Zendesk JSON + HTML | macOS 27: no issues found, not yet official |
| XLN Audio | support.xlnaudio.com system requirements | Zendesk JSON | |
| SSL | support.solidstatelogic.com plug-in compatibility, macOS 27 (360), SSL 1/2/12/18 compatibility | Zendesk JSON | macOS 27 unsupported (public beta AU builds offered) |
| Universal Audio | help.uaudio.com OS compatibility, requirements (Apollo X, Volt, UADx, UA Connect), version history, Tahoe article | Zendesk JSON | macOS 27 testing, minor UADx display issues |
| Focusrite | support.focusrite.com macOS and Windows compatibility; downloads.focusrite.com | Zendesk JSON + HTML | not officially supported on macOS 27 yet |
| RME | rme-audio.de/downloads.html | HTML | drivers 1.277 / 1.0.26 (Win x64+Arm), DriverKit 4.30 |
| MOTU | motu.com M2 downloads + M2/M4/M6 specs | HTML | Windows 11 23H2+ x86-64/ARM64 |
| Audient | support.audient.com Tahoe announcement, iD and EVO compatibility | Zendesk JSON | |
| Valhalla DSP | valhalladsp.com shop + 10 product pages | HTML | macOS list explicitly includes Ventura–Tahoe; "ready for Tahoe" Mac builds named |
| Soundtoys | soundtoys.com product pages (18) | HTML | open-ended requirements only (macOS 10.15+, Windows 10+) → no OS rows |
| Xfer / Vital / Cableguys | xferrecords.com Serum 2, vital.audio, cableguys.com ShaperBox 3 | HTML | |
| Toontrack | toontrack.com product pages (SD3, EZdrummer 3, EZkeys 2, EZbass) | HTML | |
| oeksound | oeksound.com soothe3, spiff, bloom | HTML | Apple Silicon to macOS 26; Intel only to macOS 15; no Windows ARM |
| Surge XT | surge-synthesizer.github.io, GitHub releases-xt, GitHub license | HTML + API | |
| Waves | waves.com/support/tech-specs/system-requirements + 12 product pages | HTML | per-version OS lists: V17 includes macOS 27, M-series only on Mac |
| Eventide | eventideaudio.com plug-in pages (7) | HTML | |
| Softube | softube.com plug-in pages (3) | HTML | macOS 14, 15, 26 listed |

## 4. Changes to `platform/verticals/studio.js`

- Added property `cpu_arch` (list, static: "CPU architectures") and listed `cpu_arch` and `status`
  in the `os_release` type's props. Needed for the preflight target gate: macOS 27 installs only on
  Apple silicon (`["arm64"]`), macOS 26 still on some Intel Macs.
- No other keys changed.

Seed conventions used on top of SEED-FORMAT.md (documented in preflight-contract.md): compatibility
rows carry an extra `min_subject_version`; `subject_version` / `target_version` use `*`, `12.*`,
`2025.10.x`, `>=8.8`, `<14`, exact versions and `latest`; `env` uses `arch` (`arm64` | `x86_64`)
and `format` only when the vendor states them; format lists use `VST2 VST3 AU AUv3 AAX AudioSuite
CLAP LV2 Standalone`, plus `VST` when the vendor does not say which VST version.

## 5. Known gaps and risks

- **Not covered (no usable official source found in time):** DaVinci Resolve (Blackmagic's tech
  specs page lists hardware panels, not the app), Spectrasonics (compatibility KB is rendered by
  script), Celemony and Antares (requirement URLs 404 / not found), Kilohearts (script-rendered
  page), Baby Audio, Output, Sonnox, Tokyo Dawn Labs, Goodhertz, Dexed; MOTU UltraLite/828 and
  NI Komplete Audio interfaces (no requirement page opened).
- **Stale-prone rows:** every macOS 27 row (vendors are mid-testing; expect many `unknown` /
  `unsupported` rows to flip to `supported` within weeks). The kb watcher covers 22 of the
  articles; Avid, NI (Freshdesk) and product pages are not watched.
- `latest_version` for Cubase (15.0.6) is the newest version named in Steinberg's Tahoe chart
  (2026-07-22), not a release feed. NI, iZotope, Arturia, Plugin Alliance, Slate and XLN entities
  have no latest_version (no official version list opened).
- Vendor-wide statements (FabFilter requirements, Plugin Alliance macOS 13–26, Arturia validation,
  XLN list) are applied to every product of that vendor with a note saying so.
- "VST" without a version (Bitwig, Arturia) is stored as `VST` — see preflight-contract §4.
- `validate-seed.mjs <dir>` reports false duplicates on Windows (relative vs absolute paths are
  not de-duplicated); running it without arguments works.
- The scratch web-search budget ran out during the run; remaining research used direct page
  fetches only.

# Studio upgrade preflight — resolution contract (proposal)

Status: proposal from the studio data branch (`nerulio/n2-data-studio`, 2026-09-28). It describes how
the web preflight (and the future desktop scanner, `nerulio.preflight/1`) turns a list of installed
apps / plug-ins / audio interfaces plus an OS upgrade into one of four results per item, using only
the curated `compatibility` rows and facts in `data/seed/studio/*.json`. Nothing here invents a
status: when no official row applies, the answer is `UNKNOWN`.

Results: **READY** · **UPDATE_FIRST** · **UNKNOWN** · **KNOWN_INCOMPATIBLE**.

## 1. Input

```jsonc
{
  "schema": "nerulio.preflight/1",
  "from": {"os": "macos", "version": "15.7.1"},          // informational (used for "already on target")
  "to":   {"os": "macos", "version": "27.0"},            // or {"os":"windows","version":"11 25H2"} / build "26200"
  "arch": "arm64",                                        // arm64 | x86_64 (Windows on Arm = arm64)
  "items": [
    {"kind": "app",    "name": "Ableton Live 12 Suite", "vendor": "Ableton", "version": "12.4.6"},
    {"kind": "plugin", "name": "Kontakt 8", "vendor": "Native Instruments", "version": "8.7.0", "format": "au"},
    {"kind": "plugin", "name": "Pro-Q 4", "vendor": "FabFilter", "version": "4.13", "format": "vst3"},
    {"kind": "audio_device", "name": "Scarlett 2i2 4th Gen", "vendor": "Focusrite", "version": null}
  ]
}
```
Only names, vendors, versions, formats and architecture are accepted (no paths, serials, file
contents — architecture §7). `format` ∈ `vst2 vst3 au auv3 aax clap lv2 standalone` (scanner maps
`.vst`→vst2, `.vst3`, `.component`→au, `.aaxplugin`→aax, `.clap`). `version` may be null.

## 2. Resolve the target OS

1. macOS: major number → `os_release:macos-<major>` (`27.0` → `macos-27`, `15.7.1` → `macos-15`).
   Keep the full version as `target_version` for rows with point-release ranges (Pro Tools rows use
   `26.3.x`, Cubase rows `*`).
2. Windows: map the feature update (`25H2`, or build prefix `26200` → 25H2, `26100` → 24H2,
   `22631` → 23H2, `28000` → 26H1, `19045` → Windows 10 22H2) → `os_release:windows-11-25h2` etc.
   The family entity (`os_release:windows-11` / `windows-10`) is the fallback target: vendor
   statements that only say "Windows 11" are stored against the family.
3. **Target-level gate** (before any item): if the target os_release has a `cpu_arch` fact that does
   not include `arch`, every item is `KNOWN_INCOMPATIBLE` with reason `os_not_installable_on_cpu`
   (e.g. macOS 27 has `cpu_arch: ["arm64"]` → Intel Macs cannot install it at all). Other target
   notes are surfaced as warnings (e.g. Windows 11 26H1 is not offered as an in-place update;
   Windows 10 22H2 `status: retired`).

## 3. Resolve each item to an entity

Normalisation = `normName()` from `platform/schema.js` (NFKC, lower-case, strip spaces/punctuation).

1. Candidate set = entities of the matching type (`app` | `plugin` | `audio_device`).
2. Score each candidate on `names.en`, `names.ko` and every alias (all normalised):
   - exact match on name or alias: 100; the input with the vendor name removed ("FabFilter Pro-Q 4"
     → "Pro-Q 4") also counts as exact;
   - input starts with an alias followed by an edition word (`Suite`, `Pro`, `Standard`, `Elements`,
     `Artist`, `Advanced`, `Player`): 80 (e.g. "Ableton Live 12 Suite" → alias "Ableton Live 12");
   - `vendor` given and equal (normalised) to the made_by vendor's name/alias: +20; different: −50.
3. Take the best score ≥ 80; ties → the candidate whose vendor matches; still tied → `UNKNOWN`
   with reason `ambiguous_name` and the candidates listed. No match → `UNKNOWN`, `not_in_catalog`.
4. Families: some entities are product families (e.g. "Focusrite Scarlett 4th Gen" with aliases for
   every model, "UAD Native plug-ins (UADx)"). Aliases carry the model names so model input matches.

The alias lists in the seed are written for this matcher: short forms ("Pro-Q 4", "ProQ4"), vendor
forms ("FabFilter Pro-Q"), previous product names ("Studio One" for Fender Studio Pro) and edition
names. Major versions of one product line share one entity (`plugin:native-instruments-kontakt`
covers Kontakt 6/7/8) and are distinguished by `subject_version` in the rows.

## 4. Select compatibility rows

Rows are `{subject, subject_version, target, target_version, env{arch?,format?}, status,
min_subject_version?, ver, src, note}`. For an item resolved to entity `E`:

1. `subject == E` and `target` ∈ {exact os_release, family os_release}.
2. `env.arch` absent or equal to the request `arch`; `env.format` absent or equal to the item
   format. A row format of `vst` (vendor did not say VST2 or VST3) matches `vst2` and `vst3`.
   Items without a format match only rows without `env.format`, or rows whose formats all agree.
3. `subject_version` matches the item version (grammar §6). Unknown item version matches only
   `*`-rows and rows that carry `min_subject_version`.
4. `target_version` matches the full target OS version (`*`, `latest`, `>=24H2`, `26.3.x`).
5. Rank the remaining rows: exact target > family target; more `env` keys > fewer; exact
   `subject_version` > range (`12.*`, `>=8.8`, `<14`) > `*`; `OFFICIAL` > `COMMUNITY_VERIFIED` >
   `AUTOMATED` > others; newest source `retrieved` date. The top row decides; the others are shown
   as "also stated by …" when they disagree.
6. `COMMUNITY` (unverified) reports never decide; they are listed separately as
   "community-submitted Nerulio reports (n)".

## 5. Decide

| Winning row | Item version | Result |
| --- | --- | --- |
| `supported`, no `min_subject_version` | any | **READY** |
| `supported`, `min_subject_version = M` | known and ≥ M | **READY** |
| `supported`, `min_subject_version = M` | known and < M | **UPDATE_FIRST** ("update to ≥ M before upgrading the OS") |
| `supported`, `min_subject_version = M` | unknown | **UPDATE_FIRST** with reason `verify_version` ("make sure you have ≥ M") |
| `works_with_issues` | any (min rule as above) | **READY** + `warnings[]` (the row note, e.g. "MIDI I/O does not work") |
| `unsupported` / `broken` | matches | **KNOWN_INCOMPATIBLE** |
| `unknown` (vendor "testing in progress", "do not update yet") | any | **UNKNOWN** with reason `vendor_testing` |
| `unverified_after_update` | any | **UNKNOWN** with reason `needs_reverification` |
| no row | — | fallbacks below, else **UNKNOWN** `no_statement` |

Fallbacks when no row matches (always labelled `derived`, never shown as a vendor statement):
- target macOS major < the item's `min_macos` major, or target Windows below `min_windows` →
  **KNOWN_INCOMPATIBLE** `below_minimum_requirement` (e.g. Logic Pro 12.3.1 requires macOS 15.6).
- `arch = arm64` on macOS and `apple_silicon = none` → **KNOWN_INCOMPATIBLE**; `apple_silicon =
  rosetta` → **READY** + warning "runs only under Rosetta 2" (and **UNKNOWN** for a macOS release
  where Apple no longer ships Rosetta once such an os_release fact exists).
- A newer statement for an *older* OS never implies support for a newer one.

Overall result = the worst item result in the order KNOWN_INCOMPATIBLE > UPDATE_FIRST > UNKNOWN >
READY, plus the target-level gate.

## 6. Version grammar and comparison

`subject_version`, `target_version` and `min_subject_version` use:

| Pattern | Meaning | Examples in the seed |
| --- | --- | --- |
| `*` | any version | vendor-wide statements |
| `12.*`, `2025.10.x`, `26.3.x` | same leading segments | Live 12, Pro Tools 2025.10, macOS 26.3 |
| `>=8.8`, `<14`, `>=2025.12` | open range | Kontakt 8.8+, Cubase before 14, Pro Tools 2025.12+ |
| `8.1.0`, `12.3.1`, `20` | exact (a bare major matches that major: `20` = `20.*`) | App Store build, FL Studio 20 |
| `latest` (target_version of app targets) | the host's current release | "tested on the latest Cubase" |
| `>=24H2`, `>=22H2` | Windows feature-update order: 21H2 < 22H2 < 23H2 < 24H2 < 25H2 < 26H1 | Cubase 15, Fender Studio Pro |

Comparison: split on `.`, `-`, `+` and spaces; compare numeric segments numerically, missing
segments = 0 (`4.7` = `4.7.0`); a non-numeric suffix on the last numeric segment marks a
pre-release that sorts **before** the release (`33.0.0-beta4` < `33.0.0`, `1.0.2b` < `1.0.2`);
build metadata after `+` is ignored (`2.0.2+b72db03fb` = `2.0.2`). Year-based versions (Pro Tools
`2026.4.1`) and `v`-prefixed tags are handled by the same rule after stripping a leading `v`.
Driver-style versions stored with a platform prefix in `versions[]` (`win-1.277`) are compared
after removing the prefix.

## 7. Output

```jsonc
{
  "schema": "nerulio.preflight/1", "to": "os_release:macos-27", "arch": "arm64",
  "overall": "KNOWN_INCOMPATIBLE",
  "items": [
    {"input": "Kontakt 8 8.7.0 (au)", "entity": "plugin:native-instruments-kontakt",
     "result": "KNOWN_INCOMPATIBLE", "reason": "vendor_statement",
     "row": {"status": "unsupported", "src": "src:native-instruments-macos-compatibility", "retrieved": "2026-09-28",
             "note": "NI: Hardware & Software is not supported on macOS 27 Golden Gate …"}},
    {"input": "Ableton Live 12 Suite 12.4.6", "entity": "app:ableton-live", "result": "READY",
     "row": {"status": "supported", "subject_version": "12.*", "env": {"arch": "arm64"}, "src": "src:ableton-mac-compatibility"}}
  ]
}
```
Every decided item links its source page and the date Nerulio last checked it; `UNKNOWN` items
invite a community report (which never overrides the official row).

## 8. Worked examples from the current seed

| Upgrade | Item | Winning row / fact | Result |
| --- | --- | --- | --- |
| macOS 15 → 27, x86_64 | anything | `macos-27.cpu_arch = [arm64]` | KNOWN_INCOMPATIBLE (target gate) |
| macOS 15 → 26, arm64 | Kontakt 8.7.0 | supported, `8.*`, min 8.8.0 | UPDATE_FIRST (to 8.8.0) |
| macOS 15 → 26 | Cubase 14.0.41 | unsupported, `14.*` (Steinberg Tahoe chart) | KNOWN_INCOMPATIBLE |
| macOS 15 → 26 | Cubase 15.0.6 | supported, `15.*`, min 15.0.6 | READY |
| macOS 26 → 27 | Cubase 15 | unknown (Steinberg: refrain from updating) | UNKNOWN (`vendor_testing`) |
| macOS 26 → 27 | Pro Tools 2026.4.1 | unsupported (Avid: not yet supported) | KNOWN_INCOMPATIBLE |
| macOS 26 → 27, arm64 | Ableton Live 12 | supported `12.*` arm64 | READY |
| macOS 15 → 26 | Massive X | unknown ("Testing in progress") | UNKNOWN |
| macOS 15 → 26, x86_64 | Clarett Thunderbolt | works_with_issues (MIDI I/O) | READY + warning |
| Win 11 24H2, arm64 | Kontakt | unsupported arm64 (NI: Windows ARM not supported) | KNOWN_INCOMPATIBLE |
| macOS 15 → 26 | Pro Tools 2025.6 | min 2025.10 (Avid: 2025.10+ on Tahoe) | UPDATE_FIRST |
| macOS 15 → 26 | FabFilter Pro-Q 4 | no macOS row (only "macOS 10.13 or higher") | UNKNOWN (`no_statement`) |

The last line is intentional: an open-ended minimum requirement is not a compatibility statement
for a release that did not exist when it was written.

## 9. What the core needs (suggested changes, not made on this branch)

1. Compatibility table: add `min_subject_version TEXT` (the seed already carries it as an extra
   field) and document the version grammar above for `subject_version` / `target_version`.
2. Accept `env.format` values `vst` (unspecified VST version) and `auv3`, and `env.arch` `arm64` /
   `x86_64` as an enum in `platform/seed.js`.
3. When `studio-compat-kb-watch` records a changed body hash for an article, move every row whose
   `src` is listed in that article's `cites` to `unverified_after_update` (state machine in the
   architecture doc §4) and queue it for a curator.
4. A small `platform/preflight.js` implementing §2–§6 as a pure function over repositories, with
   the §8 table as its first test vectors.

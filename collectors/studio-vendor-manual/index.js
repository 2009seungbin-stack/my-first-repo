// @ts-check
/** MANUAL_SOURCE: DAW, plug-in and audio-interface facts and compatibility rows.
 *
 * Why manual: vendors publish OS/DAW compatibility as HTML tables or free-form knowledge-base
 * articles (Avid kb.avid.com, Native Instruments' Freshdesk KB, FabFilter/u-he product pages,
 * RME/MOTU download pages, Apple/Microsoft release pages). None offers a documented, structured
 * compatibility feed, and wording such as "not yet supported", "testing in progress" or "compatible
 * with known issues" needs a human to map it to supported / unsupported / unknown /
 * works_with_issues without inventing a status. Automated parts live in separate adapters:
 * studio-github-releases (Godot, OBS), blender-releases, reaper-whatsnew and
 * studio-compat-kb-watch (flags when a tracked Zendesk compatibility article changes).
 *
 * How curators update the studio seed (data/seed/studio/*.json, docs/n2/SEED-FORMAT.md):
 *  1. New OS release (e.g. macOS 28, Windows 11 26H2): add an os_release entity to
 *     os-releases.json from Apple's security-releases page / Microsoft release-health page.
 *  2. Vendor publishes or edits a compatibility statement: open it, then add/adjust `compatibility`
 *     rows (subject × os_release, env {arch, format} only when stated, `min_subject_version` when
 *     the vendor names the first compatible version), cite the page with today's `retrieved` date.
 *     Only OS versions the vendor explicitly names get rows; "macOS 12 or later" is a min_macos
 *     fact, not a row for every later release.
 *  3. When studio-compat-kb-watch reports a changed body hash for an article, re-read it and
 *     update every row citing the listed source ids.
 *  4. Run `node tools/platform/validate-seed.mjs` (no arguments) and the n2 tests before import.
 * Review cadence: weekly during the first two months after a major macOS/Windows release
 * (June beta → October), monthly otherwise.
 */
export const MANUAL_PAGES=Object.freeze([
 {vendor:'Apple',what:'macOS release dates',url:'https://support.apple.com/en-us/100100'},
 {vendor:'Microsoft',what:'Windows 11 release information',url:'https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information'},
 {vendor:'Avid',what:'Pro Tools OS compatibility chart',url:'https://kb.avid.com/pkb/articles/compatibility/Pro-Tools-Operating-System-Compatibility-Chart'},
 {vendor:'Avid',what:'macOS Golden Gate support',url:'https://kb.avid.com/pkb/articles/en_US/Knowledge/macOS-Golden-Gate'},
 {vendor:'Native Instruments',what:'macOS compatibility',url:'https://support.native-instruments.com/support/solutions/articles/69000879296-native-instruments-macos-compatibility'},
 {vendor:'Native Instruments',what:'Windows compatibility',url:'https://support.native-instruments.com/support/solutions/articles/69000879301-compatibility-of-native-instruments-products-on-windows'},
 {vendor:'Steinberg',what:'system requirements (structured data embedded in the page)',url:'https://www.steinberg.net/system-requirements/'},
 {vendor:'FabFilter',what:'current versions',url:'https://www.fabfilter.com/download'},
 {vendor:'u-he',what:'product pages and release notes',url:'https://u-he.com/products/'},
 {vendor:'RME',what:'driver downloads',url:'https://rme-audio.de/downloads.html'},
 {vendor:'MOTU',what:'M2 downloads',url:'https://motu.com/en-us/download/product/408/'},
 {vendor:'Image-Line',what:'FL Studio download and requirements',url:'https://www.image-line.com/fl-studio/download'},
 {vendor:'Bitwig',what:'download and requirements',url:'https://www.bitwig.com/download/'},
]);
export default {
 id:'studio-vendor-manual',
 vertical:'studio',
 mode:'manual',
 freshnessHours:24*7,
 hosts:[],
 minIntervalMs:0,
 terms:'Manual curation from official vendor pages; see MANUAL_PAGES and docs/n2/sources-studio.md.',
 async collect(){throw Error('manual source: maintained by curators, see the header comment');},
};

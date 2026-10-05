# Scanner-compatible inventories

Four sample JSON files use the v1 inventory contract in src/preflight/scanner.schema.json.
All components are fictional and have demo IDs; they are not statements about the compatibility of real vendors.

Use the corresponding Preflight vertical's JSON import to load them. Optional target fields include renderer, language, OS version, DAW/plugin formats and runtimes.

A real local scanner should export exactly what it observed, including component ID/name/version/category/platform/architecture/native, optional installPath/installType/builtForHost and dependencies. Omit unknown versions instead of inventing them. Inventories are untrusted data; the website discards imported status/evidence/verdict fields and runs the engine against its own curated records.

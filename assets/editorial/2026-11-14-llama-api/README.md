# llama.cpp 0.9 → 1.0 declaration probes

Measured by an AI agent on 2026-11-14, without separate human review. Only C++ declaration availability is checked. The probes do not link a DLL, validate an ABI, load a model, run inference, compare GPU support or measure performance.

## Fixed inputs and recorded environment

- Official llama.cpp v0.9.0 source: `cd959bae99ff4bed22bef2604f45241c09bbb8c8`.
- Official llama.cpp v1.0.0 source: `b1b770d90d94cad9e9ea5b993bdbc383a522fb28`.
- Seven exact public headers per version. The Git blob hashes/sizes in the pins file were checked before compilation; SHA-256, URLs and commits are in measurements.json.
- Protocol source: `f2953754eff160383b971bf5bc4c5bb289b94dcc`, with sourceModifiedAfterCommit false. The copied protocol and pins retain their measured bytes.
- Windows NT build 26200, Python 3.10.11, Microsoft C/C++ cl.exe 19.51.36256.0 x64 (file version), Visual C++ include folder 14.51.36231, Windows SDK headers 10.0.26100.0.
- C++17, /Zs syntax only. Deprecation warnings are retained and are not promoted to errors. Compiler binary hash and actual include version labels are in measurements.json. No compiler, SDK or upstream header files are redistributed here.

## Observations

Eleven small C++ probes were checked against each version, 22 invocations. All eleven passed on v0.9.0. On v1.0.0, the current-API positive control and four replacement-name probes passed; six legacy probes failed. Five failures identify a removed function name (C2065); the sixth identifies the removed defrag_thold field (C2039). Inspect the exact logs. These address-taking probes establish declaration availability, not complete call-site or runtime compatibility.

## Reproduce

The script uses only Python's standard library and a configured C++ compiler. From an x64 Visual Studio developer shell with C++/SDK headers available:

    python measure-llama-api.py --compiler cl --output ./new-evidence

The output directory must be new/empty. The script fetches the fourteen official headers from fixed commits, verifies their pinned Git blob hashes and compiles each original probe. A configured clang++ or g++ can also be selected, but no GCC/Clang result is claimed by this dataset. Additional include directories can be supplied with repeated --system-include flags. Compiler diagnostics can differ across versions/languages; use the positive controls before interpreting a failure.

The downloaded headers remain under the new output's _upstream directory. They retain the upstream project's license; consult https://github.com/ggml-org/llama.cpp/blob/b1b770d90d94cad9e9ea5b993bdbc383a522fb28/LICENSE . This evidence ZIP excludes those headers and proprietary compiler/SDK files. The original probes, measurement script and this explanatory text are offered under CC0-1.0.

## Archive integrity

manifest.json lists SHA-256 and byte counts for the 37 evidence members other than the manifest and ZIP. evidence.zip includes those 37 files plus the manifest, with unique relative paths. All production deployment and AdSense outcomes are outside this dataset.

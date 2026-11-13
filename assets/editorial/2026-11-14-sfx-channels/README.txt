SFX mono sample channel case, measured 2026-11-14 Korea time.

Inputs: generated 440 Hz, 0.5 s, 44100 Hz PCM16 tones; integer peak 8192. No external recording or third-party music.
Legacy source: 0d356532384eed4722147b226fa6405e71320fee
Fixed source: 3b4180be5bdb2580c113a41774cdb3f104847e73
Reproduce each source with tools/editorial/measure-sfx-channels.py --ui legacy|fixed --browser chromium|firefox.
Install Node dependencies, requirements-test.txt, and Playwright browsers. Each JSON records its actual command, script hash, settings, worker PCM and decoded output.

Only selected UI screenshots are included; all generated input/output WAVs, project settings and measurement reports are exact copies. Figures are derived from the Chromium downloaded WAV channel 1 (Matplotlib 3.10.9). All output WAVs are centered two-channel files, not preserved original stereo.

Two browsers agree on the reported integer peaks, not on all samples or file hashes. Browser decoding is included. Opposite-phase average has a tiny floating residual; the PCM16 export quantizes to zero and the importer shows a near-cancellation notice. Outputs contain 22712 frames including the renderer tail; inputs contain 22050 frames.
No listening, physical-device, native-engine, indexing or AdSense approval claim.

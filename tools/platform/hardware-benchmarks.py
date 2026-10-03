"""Reduce Blender's documented CC0 daily JSONL snapshot to single-device medians.

Usage: python tools/platform/hardware-benchmarks.py archive.zip [output.json]
No marketplace scraping; no network calls. See docs/n2/hardware-tools.md.
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
import zipfile

VERSION = "4.5.0"
SCENES = {"monster", "junkshop", "classroom"}


def submission(row):
    data = row.get("data")
    if not isinstance(data, list) or len(data) != 3:
        return None
    if {d.get("scene", {}).get("label") for d in data} != SCENES:
        return None
    keys, scores = [], []
    for d in data:
        if d.get("blender_version", {}).get("version") != VERSION:
            return None
        info = d.get("device_info", {})
        devices = info.get("compute_devices", [])
        # Reject multi-device / multi-socket systems, even when device names match.
        if len(devices) != 1 or d.get("system_info", {}).get("num_cpu_sockets", 1) != 1:
            return None
        name = devices[0].get("name", "")
        backend = info.get("device_type")
        if not name or backend not in {"CPU", "OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"}:
            return None
        score = d.get("stats", {}).get("samples_per_minute")
        if not isinstance(score, (int, float)) or not math.isfinite(score) or score <= 0:
            return None
        keys.append((name, backend))
        scores.append(score)
    if len(set(keys)) != 1:
        return None
    return keys[0], sum(scores)


def aggregate(archive):
    buckets, seen = collections.defaultdict(list), set()
    with zipfile.ZipFile(archive) as z:
        filename = next(n for n in z.namelist() if n.endswith(".jsonl"))
        if "Creative Commons 0" not in z.read("README.txt").decode():
            raise ValueError("Snapshot license must be CC0")
        for line in z.open(filename):
            row = json.loads(line)
            result = submission(row)
            if not result or not row.get("id") or row["id"] in seen:
                continue
            seen.add(row["id"])
            key, score = result
            buckets[key].append(score)
    devices = []
    for (name, backend), scores in sorted(buckets.items()):
        if len(scores) < 3:
            continue
        digest = hashlib.sha256((name + "|" + backend).encode()).hexdigest()[:16]
        devices.append(dict(id=digest, name=name, type="cpu" if backend == "CPU" else "gpu",
                            backend=backend, score=round(statistics.median(scores), 3), samples=len(scores)))
    if not any(d["type"] == "cpu" for d in devices) or not any(d["type"] == "gpu" for d in devices):
        raise ValueError("Snapshot has no usable CPU/GPU coverage")
    return dict(source="https://opendata.blender.org/snapshots/opendata-latest.zip",
                license="CC0-1.0", snapshot=filename, asOf=filename[9:19],
                archiveSha256=hashlib.sha256(Path(archive).read_bytes()).hexdigest(),
                version=VERSION, scenes=sorted(SCENES), minimumSamples=3, devices=devices)


if __name__ == "__main__":
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "data/hardware/blender.js")
    payload = aggregate(sys.argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("// Generated CC0 Blender Open Data aggregate; see docs/n2/hardware-tools.md.\nexport default "
                   + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"{out}: {len(payload['devices'])} device/backend groups, snapshot {payload['asOf']}")

"""Fixture verifies aggregation excludes incompatible versions, partial and multi-device runs."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("aggregate", Path(__file__).resolve().parents[1] / "tools/platform/hardware-benchmarks.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(id_, score=10, backend="CPU"):
    return {"id": id_, "data": [{"blender_version": {"version": "4.5.0"}, "scene": {"label": s},
             "stats": {"samples_per_minute": score}, "device_info": {"device_type": backend,
             "compute_devices": [{"name": "Fixture " + backend, "type": backend}]},
             "system_info": {"num_cpu_sockets": 1}} for s in ["monster", "junkshop", "classroom"]]}


class AggregationTest(unittest.TestCase):
    def test_only_comparable_complete_single_device_runs(self):
        good = row("good")
        self.assertEqual(module.submission(good), (("Fixture CPU", "CPU"), 30))
        for mutate in [lambda x: x["data"].pop(),
                       lambda x: x["data"][1]["blender_version"].update(version="4.4.0"),
                       lambda x: x["data"][1]["device_info"]["compute_devices"].append({"name": "Other"}),
                       lambda x: x["data"][1]["system_info"].update(num_cpu_sockets=2),
                       lambda x: x["data"][1]["stats"].update(samples_per_minute=float("nan")),
                       lambda x: x["data"][1]["device_info"]["compute_devices"][0].update(name="Other")]:
            changed = copy.deepcopy(good); mutate(changed)
            self.assertIsNone(module.submission(changed))

    def test_median_of_submission_sums_deduplicates_ids(self):
        rows = [row("a", 10), row("b", 20), row("c", 100), row("c", 1000),
                row("d", 5, "OPTIX"), row("e", 10, "OPTIX"), row("f", 20, "OPTIX")]
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "fixture.zip"
            with zipfile.ZipFile(archive, "w") as z:
                z.writestr("README.txt", "Creative Commons 0")
                z.writestr("opendata-2026-10-03-000000+0000.jsonl", "\n".join(json.dumps(r) for r in rows))
            result = module.aggregate(archive)
        self.assertEqual(result["asOf"], "2026-10-03")
        cpu = next(d for d in result["devices"] if d["type"] == "cpu")
        self.assertEqual(cpu["score"], 60);self.assertEqual(cpu["samples"], 3)


if __name__ == "__main__":
    unittest.main()

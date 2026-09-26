"""send.py <name> <batchfile> [wait_s] : append batch file lines to cmd_<name>.txt, wait until done, print new log lines."""
import os, sys, time
J = os.path.dirname(os.path.abspath(__file__))
name, batch = sys.argv[1], sys.argv[2]
maxwait = float(sys.argv[3]) if len(sys.argv) > 3 else 60
lines = [l for l in open(batch, encoding="utf-8").read().splitlines() if l.strip()]
logf = os.path.join(J, f"log_{name}.txt")
start = len(open(logf, encoding="utf-8").read())
marker = f"END{time.time_ns()}"
lines.append(f"eval '{marker}'")
with open(os.path.join(J, f"cmd_{name}.txt"), "a", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
last = lines[-1][:60]
t = time.time()
while time.time() - t < maxwait:
    txt = open(logf, encoding="utf-8").read()[start:]
    if ("done " + last) in txt:
        break
    time.sleep(0.5)
out = [l for l in txt.splitlines() if not l.startswith("console: [.WebGL") and "GPU stall" not in l]
sys.stdout.reconfigure(encoding="utf-8")
print("\n".join(l[:4000] for l in out))

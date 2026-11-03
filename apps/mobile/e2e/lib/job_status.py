"""Reads GET /api/jobs JSON on stdin; prints the newest job's status for the kind in argv[1] (or 'none')."""
import json
import sys

jobs = [j for j in json.load(sys.stdin)["jobs"] if j["kind"] == sys.argv[1]]
print(jobs[0]["status"] if jobs else "none")

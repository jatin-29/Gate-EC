#!/usr/bin/env python3
"""Build the static site into dist/.

    python3 scripts/build.py && python3 -m http.server -d dist 8000

Reads data/<branch>/taxonomy.json and data/<branch>/papers/*.json, validates them,
and writes compact per-branch files the web app loads:
    dist/data/<branch>.json       questions + answers (loaded up front)
    dist/data/<branch>-exp.json   explanations keyed by question id (loaded on demand)
"""
import hashlib
import json
import pathlib
import re
import shutil
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
BRANCHES = ["ec", "ee", "in"]


def fail(msg):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(1)


def build_branch(branch):
    tax = json.loads((ROOT / "data" / branch / "taxonomy.json").read_text())
    valid = {s["id"]: {t["id"] for t in s["topics"]} for s in tax["subjects"]}
    papers, questions, explanations = [], [], {}
    warnings = []
    for f in sorted((ROOT / "data" / branch / "papers").glob("*.json")):
        p = json.loads(f.read_text())
        if p["key"] != f.stem:
            fail(f"{f}: key {p['key']!r} does not match file name")
        count = 0
        for q in p["questions"]:
            qid = f"{branch}-{p['key']}-{q['n']}"
            if q["subject"] not in valid or q["topic"] not in valid[q["subject"]]:
                fail(f"{qid}: unknown subject/topic {q['subject']}/{q['topic']}")
            if q["type"] not in ("mcq", "msq", "nat", "desc"):
                fail(f"{qid}: bad type {q['type']}")
            if q["answer"] is None:
                warnings.append(qid)
            row = {"id": qid, "p": p["key"], "n": q["n"], "m": q["marks"], "t": q["type"],
                   "s": q["subject"], "tp": q["topic"], "q": q["question"], "a": q["answer"],
                   "ref": q.get("ref") or f"Q{q['n']}"}
            if q.get("difficulty"):
                row["d"] = q["difficulty"]
            if q.get("figmiss"):
                row["fm"] = 1
            if q.get("reveal"):
                row["r"] = q["reveal"]
            if q.get("note"):
                row["nt"] = q["note"]
            if q["type"] in ("mcq", "msq"):
                row["o"] = q["options"]
            questions.append(row)
            if q.get("explanation"):
                explanations[qid] = q["explanation"]
            count += 1
        papers.append({"key": p["key"], "title": p["title"], "kind": p["kind"],
                       "year": p["year"], "set": p["set"], "count": count})
    ids = [q["id"] for q in questions]
    if len(ids) != len(set(ids)):
        fail(f"{branch}: duplicate question ids")
    # newest paper first; extra-practice banks last
    papers.sort(key=lambda p: (p["kind"] == "extra", -(p["year"] or 0), p["set"] or 0, p["key"]))
    order = {p["key"]: i for i, p in enumerate(papers)}
    questions.sort(key=lambda q: (order[q["p"]], q["n"]))
    out = DIST / "data"
    out.mkdir(parents=True, exist_ok=True)
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    (out / f"{branch}.json").write_text(dump({
        "branch": branch, "title": tax["title"], "subjects": tax["subjects"],
        "papers": papers, "questions": questions}))
    (out / f"{branch}-exp.json").write_text(dump(explanations))
    print(f"{branch}: {len(papers)} papers, {len(questions)} questions, "
          f"{len(explanations)} explanations, {len(warnings)} without answer key")
    return len(questions)


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "web", DIST)
    shutil.copytree(ROOT / "data" / "img", DIST / "img")
    (DIST / ".nojekyll").write_text("")
    total = sum(build_branch(b) for b in BRANCHES)
    version = hashlib.sha1(str(time.time()).encode()).hexdigest()[:8]
    for page in DIST.glob("*.html"):
        page.write_text(page.read_text().replace("__BUILD__", version))
    # Version every module import too. GitHub Pages lets browsers cache files for ~10 minutes, and a
    # new app.js importing a stale cached practice.js fails to load at all.
    for js in (DIST / "js").glob("*.js"):
        js.write_text(re.sub(r'(from "\./[\w-]+\.js)"', rf'\1?v={version}"', js.read_text()))
    print(f"built dist/ ({total} questions, build {version})")


if __name__ == "__main__":
    main()

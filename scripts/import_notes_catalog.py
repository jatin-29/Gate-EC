#!/usr/bin/env python3
"""Write data/notes/<branch>.json: links to the short-notes / formula-sheet PDFs (hosted by
PrepFusion, not copied here) grouped by our subject ids, with per-topic priority and PYQ counts.

    python3 scripts/import_notes_catalog.py [local-catalog.json]
"""
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = "https://notes.prepfusion.in/rx/catalog.json"
BASE = "https://notes.prepfusion.in/rx/"

# catalogue subject id -> our subject id
SUBJECT = {
    "network-theory": "network-theory",
    "analog-electronics-ec": "analog-electronics", "analog-electronics-ee": "analog-electronics", "analog-electronics-in": "analog-electronics",
    "digital-electronics-ec": "digital-electronics", "digital-electronics-ee": "digital-electronics", "digital-electronics-in": "digital-electronics",
    "microprocessors-8085": "digital-electronics", "computer-organization": "digital-electronics",
    "signals-and-systems-ec-in": "signals-and-systems", "signals-and-systems-ee": "signals-and-systems",
    "control-systems-ec-ee": "control-systems", "control-systems-in": "control-systems",
    "engineering-mathematics-ec": "engineering-mathematics", "engineering-mathematics-ee": "engineering-mathematics",
    "engineering-mathematics-in": "engineering-mathematics",
    "general-aptitude": "general-aptitude",
    "edc": "electronic-devices-circuits", "communications": "communication-systems",
    "emft": "electromagnetic-fields", "emft-ee": "electromagnetic-fields", "emft-in": "electromagnetic-fields",
    "electrical-machines-ee": "electrical-machines", "electrical-machines-in": "electrical-machines",
    "power-electronics": "power-electronics", "power-systems": "power-systems", "measurements": "measurements",
}
COMPLETE = {"gate-ec-complete": "ec", "gate-ee-complete": "ee", "gate-in-collected": "in"}


def files(f):
    return {k: {"path": v["path"], "hash": v["hash"], "pages": v.get("pages")} for k, v in (f or {}).items()}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None   # optional: a local copy of catalog.json
    if src:
        cat = json.load(open(src))
    else:
        req = urllib.request.Request(CATALOG, headers={"User-Agent": "gate-pyq-importer"})
        cat = json.load(urllib.request.urlopen(req, timeout=60))
    out = {b: {"complete": None, "subjects": {}} for b in ("ec", "ee", "in")}
    for s in cat["subjects"]:
        if s["id"] in COMPLETE:
            out[COMPLETE[s["id"]]]["complete"] = {"title": s["title"], "files": files(s.get("bundle"))}
            continue
        sid = SUBJECT.get(s["id"])
        if not sid:
            print("skipped", s["id"])
            continue
        entry = {
            "title": s["title"], "files": files(s.get("bundle")),
            "chapters": [{
                "title": c["title"], "files": files(c.get("files")),
                "topics": [{"title": t["title"], "priority": t.get("priority"), "pyqs": t.get("pyqs"), "marks": t.get("marks")} for t in c.get("topics", [])],
            } for c in s.get("chapters", [])],
        }
        for b in s["branches"]:
            out[b.lower()]["subjects"].setdefault(sid, []).append(entry)
    dst = ROOT / "data" / "notes"
    dst.mkdir(parents=True, exist_ok=True)
    for b, d in out.items():
        (dst / f"{b}.json").write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(b, len(d["subjects"]), "subjects", sum(len(v) for v in d["subjects"].values()), "note sets")


if __name__ == "__main__":
    main()

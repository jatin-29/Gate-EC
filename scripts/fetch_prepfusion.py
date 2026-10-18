#!/usr/bin/env python3
"""Download the question catalogue from hub.prepfusion.in into a local cache.

    python3 scripts/fetch_prepfusion.py CACHE_DIR [--workers 12]

Fetches the public library tree, then every question (statement, options, answer,
solution) for the EC, EE and IN branches plus the shared General Aptitude sessions.
Results are cached as JSON under CACHE_DIR so an interrupted run resumes where it
stopped. Run scripts/import_prepfusion.py afterwards to convert the cache into data/.
"""
import argparse
import concurrent.futures as cf
import json
import pathlib
import time
import urllib.parse

import requests

BASE = "https://hub.prepfusion.in"
BRANCHES = ("EC", "EE", "IN")


def leaves_of(lib):
    out = []

    def walk(node, path, subject):
        if "leaf" in node:
            out.append({"subject": subject, "path": path + [node["label"]], **node["leaf"], "count": node["questionCount"]})
        for child in node.get("children", []):
            walk(child, path + [node["label"]], subject)

    for s in lib["subjects"]:
        for t in s["tree"]:
            walk(t, [], s["key"])
    return [l for l in out if l["subject"] == "aptitude" or any(p in BRANCHES for p in l["path"])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cache")
    ap.add_argument("--workers", type=int, default=12)
    a = ap.parse_args()
    cache = pathlib.Path(a.cache)
    cache.mkdir(parents=True, exist_ok=True)
    sess = requests.Session()
    sess.mount("https://", requests.adapters.HTTPAdapter(pool_connections=a.workers, pool_maxsize=a.workers * 2))

    def get(url):
        for attempt in range(5):
            try:
                r = sess.get(url, timeout=40)
                if r.status_code == 200:
                    return r.json()
                if r.status_code == 404:
                    return None
            except requests.RequestException:
                pass
            time.sleep(1 + attempt)
        raise RuntimeError("failed: " + url)

    lib = get(f"{BASE}/api/library")
    leaves = leaves_of(lib)
    (cache / "leaves.json").write_text(json.dumps(leaves))
    print(len(leaves), "chapter files,", sum(l["count"] for l in leaves), "questions")

    def job(leaf):
        d = cache / leaf["bookId"] / leaf["fileId"].replace("/", "__")
        d.mkdir(parents=True, exist_ok=True)
        meta = d / "_file.json"
        if meta.exists():
            f = json.loads(meta.read_text())
        else:
            f = get(f"{BASE}/api/books/{leaf['bookId']}/file?fileId={urllib.parse.quote(leaf['fileId'])}")
            meta.write_text(json.dumps(f))
        for q in f["questions"]:
            p = d / f"{q['ordinal']}.json"
            if not p.exists():
                p.write_text(json.dumps(get(f"{BASE}/api/books/{leaf['bookId']}/question?fileId={urllib.parse.quote(leaf['fileId'])}&ordinal={q['ordinal']}")))
        return len(f["questions"])

    done = 0
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for n in ex.map(job, leaves):
            done += n
            pass
    print("\ndone")


if __name__ == "__main__":
    main()

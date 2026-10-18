#!/usr/bin/env python3
"""Convert a scraped "all years" JSON dump into per-paper files under data/<branch>/.

    python3 scripts/import_raw.py ec RAW.json RAW_IMAGE_DIR [--only 2025 2026]

RAW.json maps a paper key ("2024", "2017-set-1", "dummy_aptitude", ...) to a list of
raw question records. RAW_IMAGE_DIR is the directory holding `gate_questions/...` image
files. Images are content-hashed into data/img/. Subjects/topics are normalised against
data/<branch>/taxonomy.json. See README for the resulting paper format.
"""
import argparse
import hashlib
import html as htmllib
import json
import pathlib
import re
import shutil
import sys

from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
LATEX = re.compile(r"\[latex\](.*?)\[/latex\]", re.S)
DISPLAY_HINT = re.compile(r"\\begin\{(?:b|p|v|V)?matrix\}|\\begin\{(?:array|cases|aligned|align)")
WRAPPER_CLASSES = {"question_text", "option_data", "mtq_explanation-text"}
ALLOWED = {"br", "b", "i", "img", "pre", "code", "sub", "sup", "table", "tr", "td", "th", "tbody", "thead"}


# Records the source left without a subject: (branch, paper key, question no.) -> subject string.
OVERRIDES = {
    ("ec", "2008", 11): "Network Theory - Network Functions",
    ("ec", "2006", 35): "Network Theory - Network Functions",
}


class Importer:
    def __init__(self, branch, img_root):
        self.branch = branch
        self.img_root = pathlib.Path(img_root)
        self.out_img = ROOT / "data" / "img"
        self.out_img.mkdir(parents=True, exist_ok=True)
        tax = json.loads((ROOT / "data" / branch / "taxonomy.json").read_text())
        self.subjects = {}
        self.topic_alias = {}
        for s in tax["subjects"]:
            for n in [s["name"]] + s["aliases"]:
                self.subjects[n.lower()] = s
            self.topic_alias[s["id"]] = {}
            for t in s["topics"]:
                for n in [t["name"]] + t["aliases"]:
                    self.topic_alias[s["id"]][n.lower()] = t
        self.missing_imgs = set()
        self.unknown = {}

    # -- images ------------------------------------------------------------
    def image(self, src):
        src = src.replace("\\", "/")
        f = self.img_root / src
        if not f.is_file():
            self.missing_imgs.add(src)
            return None
        data = f.read_bytes()
        name = hashlib.sha1(data).hexdigest()[:16] + f.suffix.lower()
        dst = self.out_img / name
        if not dst.exists():
            dst.write_bytes(data)
        return "img/" + name

    # -- html cleaning -----------------------------------------------------
    def clean(self, raw):
        if not raw:
            return ""
        raw = re.sub(r"<noscript>.*?</noscript>", "", raw, flags=re.S)
        stash = []

        def hold(m):
            tex = htmllib.unescape(m.group(1)).strip()
            stash.append(tex)
            return "\u0000%d\u0000" % (len(stash) - 1)

        raw = LATEX.sub(hold, raw)
        soup = BeautifulSoup(raw, "html.parser")
        for tag in list(soup.find_all(True)):
            if tag.name == "div" and WRAPPER_CLASSES & set(tag.get("class") or []):
                tag.unwrap()
            elif tag.name == "img":
                new = self.image(tag.get("src", ""))
                if new:
                    tag.attrs = {"src": new, "loading": "lazy", "alt": ""}
                else:
                    tag.decompose()
            elif tag.name not in ALLOWED:
                tag.unwrap()          # divs, links, stray pseudo-tags such as <x,y>
            else:
                tag.attrs = {}
        out = soup.decode(formatter="html")
        out = re.sub(r"(?:\s*<br/?>\s*){3,}", "<br/><br/>", out)
        out = re.sub(r"^(?:\s*<br/?>)+|(?:<br/?>\s*)+$", "", out.strip())

        def back(m):
            tex = stash[int(m.group(1))]
            esc = htmllib.escape(tex, quote=False)
            if DISPLAY_HINT.search(tex):
                return "\\[" + esc + "\\]"
            return "\\(" + esc + "\\)"

        return re.sub(r"\u0000(\d+)\u0000", back, out).strip()

    # -- taxonomy ----------------------------------------------------------
    def classify(self, raw_subject):
        subj_raw, _, topic_raw = (raw_subject or "").partition(" - ")
        subj = self.subjects.get(subj_raw.strip().lower())
        if subj is None:
            self.unknown[raw_subject] = self.unknown.get(raw_subject, 0) + 1
            return None, None
        topic = self.topic_alias[subj["id"]].get(topic_raw.strip().lower())
        if topic is None:
            self.unknown[raw_subject] = self.unknown.get(raw_subject, 0) + 1
            topic = self.topic_alias[subj["id"]]["miscellaneous"]
        return subj, topic

    # -- answers -----------------------------------------------------------
    @staticmethod
    def answer(q):
        if q.get("type") == "numerical":
            lo, hi = q.get("answer_min"), q.get("answer_max")
            if lo in (None, "") or hi in (None, ""):
                return "nat", None
            lo, hi = float(lo), float(hi)
            return "nat", {"min": lo, "max": hi}
        ans = q.get("answer")
        if ans is None:
            ans = [o["letter"] for o in q.get("options", []) if o.get("is_correct")] or None
        if isinstance(ans, list):
            return ("msq" if len(ans) > 1 else "mcq"), (ans if len(ans) > 1 else ans[0])
        return "mcq", ans or None

    def convert(self, key, rows):
        out = []
        for row in rows:
            m = re.search(r"(\d+)", row.get("number", ""))
            if not m or not row.get("text"):
                continue
            raw_subject = OVERRIDES.get((self.branch, key, int(m.group(1))), row.get("subject"))
            subj, topic = self.classify(raw_subject)
            if subj is None:
                continue
            marks = re.search(r'data-value="(\d)"', row.get("html", ""))
            qtype, ans = self.answer(row)
            rec = {
                "n": int(m.group(1)),
                "marks": int(marks.group(1)) if marks else 1,
                "type": qtype,
                "subject": subj["id"],
                "topic": topic["id"],
                "question": self.clean(row["html"]),
            }
            if qtype != "nat":
                rec["options"] = [self.clean(o.get("html") or o.get("text", "")) for o in row.get("options", [])]
            rec["answer"] = ans
            exp = self.clean(row.get("explanation_html"))
            if exp:
                rec["explanation"] = exp
            out.append(rec)
        return out


def paper_meta(branch, key):
    up = branch.upper()
    if key.startswith("dummy_"):
        what = {"aptitude": "General Aptitude", "engineering_mathematics": "Engineering Mathematics"}[key[6:]]
        return {"key": "extra-" + key[6:].replace("_", "-"), "kind": "extra", "year": None, "set": None,
                "title": f"Extra practice: {what} (other branches)"}
    m = re.fullmatch(r"(\d{4})(?:-set-(\d))?", key)
    year, st = int(m.group(1)), (int(m.group(2)) if m.group(2) else None)
    return {"key": key, "kind": "paper", "year": year, "set": st,
            "title": f"GATE {up} {year}" + (f" (Set {st})" if st else "")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("branch")
    ap.add_argument("raw_json")
    ap.add_argument("raw_images")
    ap.add_argument("--only", nargs="*", help="paper keys to import (default: all)")
    a = ap.parse_args()
    imp = Importer(a.branch, a.raw_images)
    raw = json.loads(pathlib.Path(a.raw_json).read_text())
    dst = ROOT / "data" / a.branch / "papers"
    dst.mkdir(parents=True, exist_ok=True)
    for key, rows in raw.items():
        if a.only and key not in a.only:
            continue
        meta = paper_meta(a.branch, key)
        qs = imp.convert(key, rows)
        meta["branch"] = a.branch
        meta["questions"] = qs
        (dst / (meta["key"] + ".json")).write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"{meta['key']:>28}: {len(qs)} questions")
    if imp.unknown:
        print("unmapped subject/topic (sent to Miscellaneous or skipped):", imp.unknown, file=sys.stderr)
    if imp.missing_imgs:
        print(f"{len(imp.missing_imgs)} images missing from the dump (tags dropped)", file=sys.stderr)


if __name__ == "__main__":
    main()

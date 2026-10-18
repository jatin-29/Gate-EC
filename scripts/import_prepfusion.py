#!/usr/bin/env python3
"""Convert the cache written by fetch_prepfusion.py into data/<branch>/.

    python3 scripts/import_prepfusion.py CACHE_DIR

Writes data/<branch>/taxonomy.json, data/<branch>/papers/<year>.json and the content-
hashed images in data/img/. One paper per exam year; the shared General Aptitude
sessions are included in every branch. Re-running regenerates everything.
"""
import argparse
import collections
import concurrent.futures as cf
import hashlib
import html
import json
import pathlib
import re
import shutil
import sys
import urllib.parse

import requests
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://hub.prepfusion.in"
BRANCH_TITLES = {"ec": "Electronics & Communication Engineering", "ee": "Electrical Engineering", "in": "Instrumentation Engineering"}

SUBJECT_NAMES = {"Signals": "Signals and Systems", "Maths": "Engineering Mathematics"}
SUBJECT_ORDER = ["Engineering Mathematics", "Network Theory", "Signals and Systems", "Electronic Devices & Circuits",
                 "Analog Electronics", "Digital Electronics", "Control Systems", "Communication Systems",
                 "Electromagnetic Fields", "Electrical Machines", "Power Systems", "Power Electronics",
                 "Measurements", "General Aptitude"]
COLORS = {"Engineering Mathematics": "#6366f1", "Network Theory": "#0ea5e9", "Signals and Systems": "#14b8a6",
          "Electronic Devices & Circuits": "#f59e0b", "Analog Electronics": "#ef4444", "Digital Electronics": "#8b5cf6",
          "Control Systems": "#22c55e", "Communication Systems": "#ec4899", "Electromagnetic Fields": "#f97316",
          "Electrical Machines": "#a855f7", "Power Systems": "#eab308", "Power Electronics": "#f43f5e",
          "Measurements": "#06b6d4", "General Aptitude": "#84cc16"}

# --- inline text: $..$, $$..$$, \(..\), \[..\] are maths; \% etc. are un-escaped -------------------
MATH = re.compile(r"(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$|(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]|(?<!\\)\$([^$]*?)(?<!\\)\$|(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)")
BLOCK_ENV = re.compile(r"\\begin\{(?:array|align|aligned|cases|[bpvV]?matrix|gather|split)\*?\}")
FIGURE = re.compile(r"\\QuestionFigure(?:NoNumber)?(?:\[[^\]]*\])?\{[^{}]+\}")


def unescape_text(s):
    return re.sub(r"\\\\|\\([^A-Za-z*])", lambda m: m.group(0) if m.group(1) is None else m.group(1), s)


def tex(expr, display):
    expr = re.sub(r"\\renewcommand\{[^{}]*\}\{[^{}]*\}", "", expr)   # KaTeX has no \renewcommand
    expr = html.escape(expr.strip(), quote=False)
    return f"\\[{expr}\\]" if display or BLOCK_ENV.search(expr) else f"\\({expr}\\)"


def text_html(s):
    out, pos = [], 0
    for m in MATH.finditer(s):
        out.append(html.escape(unescape_text(s[pos:m.start()]), quote=False))
        body = next(g for g in m.groups() if g is not None)
        out.append(tex(body, m.group(1) is not None or m.group(2) is not None))
        pos = m.end()
    out.append(html.escape(unescape_text(s[pos:]), quote=False))
    return "".join(out)


class Renderer:
    def __init__(self):
        self.images = {}  # published name -> source URL

    def image(self, book, src, solution=False, size=""):
        url = f"{BASE}/assets/{'solution/' if solution else ''}{book}/{urllib.parse.quote(src)}"
        ext = pathlib.PurePosixPath(src).suffix.lower()
        name = hashlib.sha1(url.encode()).hexdigest()[:16] + (ext if ext == ".svg" else ".webp")  # rasters are re-encoded below
        self.images[name] = url
        m = re.search(r"([\d.]+)\s*\\(?:column|text)width", size or "")
        width = round(min(float(m.group(1)), 1.0) * 640) if m else 420   # source sizes are LaTeX fractions of the page width
        return f'<img src="img/{name}" loading="lazy" alt="" style="width:min(100%,{width}px)">'

    def nodes(self, nodes, book, sol=False):
        return "".join(self.node(n, book, sol) for n in nodes or [])

    def node(self, n, book, sol):
        t = n.get("type")
        if t == "text":
            return text_html(n["value"])
        if t == "math":
            return tex(n["value"], n.get("display"))
        if t == "bold":
            return f"<strong>{self.nodes(n.get('content'), book, sol)}</strong>"
        if t == "underline":
            return f"<u>{self.nodes(n.get('content'), book, sol)}</u>"
        if t == "break":
            return "<br/>"
        if t == "image":
            return self.image(book, n["src"], sol, n.get("size", ""))
        if t == "list":
            tag = "ol" if n.get("ordered") else "ul"
            items = "".join(
                "<li>" + (f'<span class="item-label">{text_html(it["label"])}</span> ' if it.get("label") else "") + self.nodes(it.get("content"), book, sol) + "</li>"
                for it in n.get("items", []))
            return f"<{tag}>{items}</{tag}>"
        if t == "table":
            def cell(c):
                span = f' colspan="{c["colspan"]}"' if c.get("colspan", 1) > 1 else ""
                return f"<td{span}>{self.nodes(c.get('content'), book, sol)}</td>"

            rows = "".join("<tr>" + "".join(cell(c) for c in row) + "</tr>" for row in n.get("rows", []))
            return f'<div class="table-scroll"><table class="qtable">{rows}</table></div>'
        if t in ("method", "keypoints", "mistakes"):
            title = f"Method {n.get('label', '')}".strip() if t == "method" else "Key points" if t == "keypoints" else "Mistakes to avoid"
            return f'<div class="sol-block sol-{t}"><div class="sol-block-title">{html.escape(title)}</div>{self.nodes(n.get("content"), book, sol)}</div>'
        if isinstance(n.get("content"), list):
            return self.nodes(n["content"], book, sol)
        return ""

    def option(self, o, book):
        if o.get("content"):
            return self.nodes(o["content"], book)
        imgs = iter(o.get("images") or [])
        value, out, pos = o.get("value", ""), [], 0
        for m in FIGURE.finditer(value):
            out.append(text_html(value[pos:m.start()]))
            im = next(imgs, None)
            if im:
                out.append(self.image(book, im["src"]))
            pos = m.end()
        out.append(text_html(value[pos:]))
        return "".join(out)


def clean_html(s):
    s = re.sub(r"(?:\s*<br/>\s*){3,}", "<br/><br/>", s)
    return re.sub(r"^(?:\s*<br/>)+|(?:<br/>\s*)+$", "", s.strip())


# --- answers -----------------------------------------------------------------------------------
NUM = r"-?\d+(?:\.\d+)?"


def parse_range(s):
    s = re.sub(r"\\text\{[^}]*\}", "", s)
    s = re.sub(r"\\[,;:!]", " ", s).replace("$", "")
    m = re.fullmatch(rf"\s*({NUM})\s*\\times\s*10\^\{{?(-?\d+)\}}?\s*", s)
    if m:
        v = float(m.group(1)) * 10 ** int(m.group(2))
        return [v, v]
    s = re.sub(r"\\[a-zA-Z]+", "", s).strip()
    m = re.fullmatch(rf"({NUM})\s+to\s+({NUM})", s, re.I)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        return [min(a, b), max(a, b)]
    m = re.fullmatch(NUM, s)
    return [float(s), float(s)] if m else None


def parse_answer(q):
    raw = (q.get("answer") or "").strip()
    raw = re.sub(r"[\u2010-\u2015\u2212]", "-", raw)
    raw = re.sub(r"\\text\{\s*(or)\s*\}", r" \1 ", raw, flags=re.I).strip()
    kind = q["questionType"]
    if not raw:
        return None, "Answer key not available"
    if raw == "MTA":
        return None, "Marks awarded to all (official key: MTA)"
    if raw == "*":
        return None, "No single correct answer in the official key"
    if kind == "NAT":
        rs = [parse_range(p) for p in re.split(r"\s+or\s+", raw, flags=re.I)]
        return (rs, None) if all(rs) else (None, f"Answer: {raw}")
    letters = [p.strip().upper() for p in re.split(r"\s*,\s*|\s+or\s+", raw, flags=re.I) if p.strip()]
    if not letters or not all(re.fullmatch(r"[A-H]", x) for x in letters):
        return None, f"Answer: {raw}"
    if kind == "MSQ":
        return (letters if len(letters) > 1 else letters[0]), None
    return (letters if len(letters) > 1 else letters[0]), None   # "C or D": either accepted


# --- General Aptitude has no topics in the source; split verbal / numerical heuristically ----------
VERBAL = re.compile(r"\b(word|words|sentences?|meaning|grammatical|grammar|blank|paragraph|passage|antonym|synonym|idiom|phrase|analog(?:y|ous)|"
                    r"choose the|select the|most appropriate|odd one|underlined|infer|author|tone|essay|narrator|poem|argument|opposite|spelling|"
                    r"verb|noun|adjective|adverb|pronoun|preposition|tense|fill in|conclusion|inference|logically|implies|assumption|story|writer|"
                    r"best expresses|mentioned|rearrange)\b", re.I)
NUMERICAL = re.compile(r"\\\(|\\\[|<table|<img|\d+\s*(%|km|m\b|cm|hours?|minutes?|years?|rupees)|ratio|probability|percent|average|speed|profit|"
                       r"loss|area|volume|perimeter|how many|number of|sum of|product of|digit|integer|prime|divisible|angle|triangle|circle|square|"
                       r"rectangle|cube|dice|coin|cards?|graph|chart|median|mean|simplif|solve|equation|\d+\s*[+\-×x*/÷]\s*\d+", re.I)


def ga_topic(question_html):
    text = re.sub(r"<[^>]+>", " ", question_html)
    num, verb = bool(NUMERICAL.search(question_html)), bool(VERBAL.search(text))
    if num != verb:
        verbal = verb
    elif verb:
        verbal = not re.search(r"\\\(|<table|<img|\d+\s*(%|km)", question_html)
    else:
        verbal = bool(re.search(r"[A-Za-z]{3,}", text)) and not re.search(r"\d", text)
    return "verbal-ability" if verbal else "numerical-ability"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


MAX_IMG_WIDTH = 1200
PLACEHOLDER = '<span class="missing-fig">[figure unavailable]</span>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cache")
    a = ap.parse_args()
    cache = pathlib.Path(a.cache)
    leaves = json.loads((cache / "leaves.json").read_text())
    R = Renderer()
    bucket = collections.defaultdict(list)           # (branch, year) -> [records]
    topic_names = collections.defaultdict(collections.Counter)   # (branch, subject, topic id) -> name counts
    topic_order = {}                                  # (branch, subject, topic id) -> sort key

    for leaf in leaves:
        d = cache / leaf["bookId"] / leaf["fileId"].replace("/", "__")
        path = leaf["path"]
        if leaf["subject"] == "aptitude":
            branches, subject, topic, session = ["ec", "ee", "in"], "General Aptitude", None, path[-1]
        elif leaf["subject"] == "maths":
            branches, subject, topic, session = [path[1].lower()], "Engineering Mathematics", path[0], None
            chapter = leaf["fileId"].split("/")[0]
        else:
            subject = SUBJECT_NAMES.get(path[0], path[0])
            branches, topic, session = [path[1].lower()], path[2], None
            chapter = leaf["fileId"].split("/")[0]
        branches = [b for b in branches if b in BRANCH_TITLES]
        if not branches:
            continue
        for f in sorted(d.glob("[0-9]*.json"), key=lambda p: int(p.stem)):
            q = json.loads(f.read_text())
            book = leaf["bookId"]
            body = q["body"]
            cd = q.get("commonData")
            question = R.nodes((cd or {}).get("body"), book) + ("<br/><br/>" if cd else "") + R.nodes(body, book)
            if session:
                tid = ga_topic(question)
                tname = "Numerical Ability" if tid == "numerical-ability" else "Verbal Ability"
                ref = f"{session} · Q{q['questionNum']}"
            else:
                tid = re.sub(r"^ch\d+_", "", chapter).lower() if leaf["subject"] != "maths" else slug(topic)
                tid = slug(tid)
                tname = topic
                ref = f"{topic} Q{q['questionNum']}"
            ans, note = parse_answer(q) if q["questionType"] != "DESC" else (None, None)
            rec = {
                "marks": int(q.get("marks") or 1), "type": {"MCQ": "mcq", "MSQ": "msq", "NAT": "nat", "DESC": "desc"}[q["questionType"]],
                "subject": slug(subject), "topic": tid, "ref": ref, "no": int(q["questionNum"]),
                "question": clean_html(question),
                "answer": ans,
            }
            diff = (q.get("solution") or {}).get("difficulty")
            if str(diff) in ("1", "2", "3"):
                rec["difficulty"] = int(diff)
            if rec["type"] == "desc" and (q.get("answer") or "").strip():
                rec["reveal"] = clean_html(text_html(q["answer"].strip()))
            if rec["type"] in ("mcq", "msq"):
                rec["options"] = [clean_html(R.option(o, book)) for o in q.get("options") or []]
            if note:
                rec["note"] = note
            sol = (q.get("solution") or {}).get("body")
            if sol:
                rec["explanation"] = clean_html(R.nodes(sol, book, True))
            for b in branches:
                topic_names[(b, subject, tid)][tname] += 1
                if (b, subject, tid) not in topic_order:
                    topic_order[(b, subject, tid)] = (int(re.match(r"ch(\d+)", chapter).group(1)) if not session else (0 if tid == "verbal-ability" else 1))
                bucket[(b, int(q["year"]))].append((subject, tid, rec))

    # images ---------------------------------------------------------------------------------
    img_dir = ROOT / "data" / "img"
    img_cache = cache / "_img"
    img_dir.mkdir(parents=True, exist_ok=True)
    img_cache.mkdir(exist_ok=True)
    sess = requests.Session()
    sess.mount("https://", requests.adapters.HTTPAdapter(pool_connections=12, pool_maxsize=24))

    def dl(item):
        name, url = item
        dst = img_cache / name
        if dst.exists():
            return name, True
        for _ in range(3):
            try:
                r = sess.get(url, timeout=40)
                if r.status_code == 200:
                    dst.write_bytes(r.content)
                    return name, True
                if r.status_code == 404:
                    return name, False
            except requests.RequestException:
                pass
        return name, False

    with cf.ThreadPoolExecutor(12) as ex:
        have = dict(ex.map(dl, R.images.items()))
    missing = {n for n, ok in have.items() if not ok}
    print(f"{len(R.images)} images, {len(missing)} missing")
    drop = re.compile(r'<img src="img/(' + "|".join(re.escape(m) for m in missing) + r')"[^>]*>') if missing else None
    used = set()

    # taxonomy + papers ----------------------------------------------------------------------
    for b, title in BRANCH_TITLES.items():
        subs = collections.defaultdict(dict)
        for (bb, subject, tid), names in topic_names.items():
            if bb == b:
                subs[subject][tid] = names.most_common(1)[0][0]
        taxonomy = []
        for subject in sorted(subs, key=lambda s: SUBJECT_ORDER.index(s)):
            topics = sorted(subs[subject].items(), key=lambda kv: (topic_order[(b, subject, kv[0])], kv[1]))
            taxonomy.append({"id": slug(subject), "name": subject, "color": COLORS[subject], "aliases": [],
                             "topics": [{"id": tid, "name": name, "aliases": []} for tid, name in topics]})
        out = ROOT / "data" / b
        if (out / "papers").exists():
            shutil.rmtree(out / "papers")
        (out / "papers").mkdir(parents=True, exist_ok=True)
        (out / "taxonomy.json").write_text(json.dumps({"branch": b, "title": title, "subjects": taxonomy}, indent=1, ensure_ascii=False) + "\n")
        sidx = {s["id"]: i for i, s in enumerate(taxonomy)}
        for (bb, year), rows in sorted(bucket.items()):
            if bb != b:
                continue
            tidx = {(s["id"], t["id"]): i for s in taxonomy for i, t in enumerate(s["topics"])}
            rows.sort(key=lambda r: (sidx[slug(r[0])], tidx[(slug(r[0]), r[1])], r[2]["ref"].split(" · ")[0] if r[0] == "General Aptitude" else "", r[2]["no"]))
            qs = []
            for n, (_, _, rec) in enumerate(rows, 1):
                rec = dict(rec, n=n)
                if drop:
                    for k in ("question", "options"):
                        if k in rec:
                            before = json.dumps(rec[k])
                            rec[k] = drop.sub(PLACEHOLDER, rec[k]) if k == "question" else [drop.sub(PLACEHOLDER, o) for o in rec[k]]
                            if json.dumps(rec[k]) != before:
                                rec["figmiss"] = True
                    if "explanation" in rec:
                        rec["explanation"] = drop.sub(PLACEHOLDER, rec["explanation"])
                for k in ("question", "explanation", "options"):
                    if k in rec:
                        used.update(re.findall(r'src="img/([^"]+)"', rec[k] if isinstance(rec[k], str) else " ".join(rec[k])))
                qs.append(rec)
            paper = {"key": str(year), "kind": "paper", "year": year, "set": None, "title": f"GATE {b.upper()} {year}",
                     "branch": b, "questions": qs}
            (out / "papers" / f"{year}.json").write_text(json.dumps(paper, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(b, sum(len(r) for (bb, _), r in bucket.items() if bb == b), "questions")
    shutil.rmtree(img_dir)
    img_dir.mkdir()
    for name in sorted(used):
        if name.endswith(".svg"):
            shutil.copyfile(img_cache / name, img_dir / name)
            continue
        im = Image.open(img_cache / name)
        if im.width > MAX_IMG_WIDTH:
            im = im.resize((MAX_IMG_WIDTH, round(im.height * MAX_IMG_WIDTH / im.width)), Image.LANCZOS)
        im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB").save(img_dir / name, "WEBP", quality=90, method=4)
    print(len(used), "images copied to data/img")


if __name__ == "__main__":
    main()

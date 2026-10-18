# GATE PYQ — EC, EE & IN

Topic-wise GATE previous-year questions for **Electronics & Communication (EC)**, **Electrical (EE)** and **Instrumentation (IN)**, 1987–2026, with answers and worked solutions. A static site: no backend, no build tools beyond one Python script. Progress, bookmarks and notes stay in the browser's `localStorage`.

## Features

- **Topic segregation**: every question is filed under a subject and a topic from a hand-curated taxonomy (`data/<branch>/taxonomy.json`), generated from the source's subject and chapter structure.
- **Topics page**: all subjects and topics with question counts and your progress.
- **Practice**: filter by subject/topic, year, type (MCQ/MSQ/NAT), marks, status (unattempted, correct, incorrect, bookmarked, with notes) and free text. Keyboard shortcuts: `←` `→` navigate, `1`–`4`/`A`–`D` pick options, `Enter` check/next, `B` bookmark.
- **Weightage**: topic × year heat-map of how many questions/marks each topic carried. Click a cell to practise those questions.
- **Progress**: accuracy by subject, weakest topics, 14-day activity. Backup/restore as JSON in Settings.
- Dark/light theme, scientific calculator, mobile layout.

## Run locally

```sh
python3 scripts/build.py          # writes dist/
python3 -m http.server -d dist 8000
```

Open http://localhost:8000. Requires only Python 3.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds and publishes `dist/` on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Updating / adding questions

Source of truth is `data/<branch>/papers/<year>.json` (one paper per year; General Aptitude sessions are included in every branch). They are generated from hub.prepfusion.in:

```sh
python3 scripts/fetch_prepfusion.py /tmp/pf-cache     # resumable download (~7k requests)
python3 scripts/import_prepfusion.py /tmp/pf-cache    # rewrites data/ (needs: pip install requests pillow beautifulsoup4)
python3 scripts/build.py                              # validates and builds dist/
```

You can also hand-write a paper file in the same format and commit it:

```jsonc
{ "key": "2027", "kind": "paper", "year": 2027, "set": null, "title": "GATE EC 2027", "branch": "ec",
  "questions": [{
    "n": 1, "ref": "Calculus Q1", "marks": 1,
    "type": "mcq",                // "mcq" | "msq" | "nat" | "desc"
    "subject": "engineering-mathematics", "topic": "calculus",   // ids from taxonomy.json
    "question": "HTML; maths as \\(inline\\) or \\[display\\] TeX; images as <img src=\"img/<file>\">",
    "options": ["…", "…", "…", "…"],        // mcq/msq only
    "answer": "A",                // "A" | ["C","D"] (mcq: either) | ["A","C"] (msq: all) | [[0.25,0.30]] (nat ranges) | null
    "difficulty": 2, "explanation": "optional HTML", "note": "shown when answer is null"
  }]}
```

Images go in `data/img/`. Re-importing overwrites `data/`, so keep hand-written papers in a separate commit.

## Known gaps

- IN has no Instrumentation-specific subjects (transducers, measurements, etc.) because the source does not provide them.
- About 8% of EC/EE/IN questions lose a figure that returns 404 at the source; they are tagged "Figure missing".
- General Aptitude has no topic data in the source; Verbal vs Numerical is a keyword heuristic.
- Some questions have no single answer (`*`/MTA in the official key) and show a note instead of a verdict.

## Layout

```
web/       static app (HTML, CSS, ES modules)
data/      taxonomy + per-paper JSON + images (source of truth)
scripts/   build.py (site build + validation), fetch_prepfusion.py, import_prepfusion.py
dist/      build output, git-ignored
```

## Data and licensing

Questions, answer keys, solutions and figures were downloaded from hub.prepfusion.in (PrepFusion Study Hub). The underlying questions are from the official GATE papers set by IISc/IITs, but the compilation, solutions and figures are PrepFusion's and carry no stated licence. Check you are comfortable republishing them before making this repository or site public.

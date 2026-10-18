# GATE PYQ — EC & EE

Topic-wise GATE previous-year questions for **Electronics & Communication (EC)** and **Electrical (EE)**, 2001–2025, with answers and worked solutions. A static site: no backend, no build tools beyond one Python script. Progress, bookmarks and notes stay in the browser's `localStorage`.

## Features

- **Topic segregation**: every question is filed under a subject and a topic from a hand-curated taxonomy (`data/<branch>/taxonomy.json`; 11 subjects / 78 topics for EC, 12 / 87 for EE). Variant spellings in the source data are folded into one topic.
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

## Adding papers (e.g. GATE 2026)

Each paper is one file, `data/<branch>/papers/<key>.json`; `<key>` is `2026`, or `2026-set-2` for multi-set years. Drop the file in, commit, and the workflow rebuilds the site (`python3 scripts/build.py` validates it locally).

```jsonc
{
  "key": "2026", "kind": "paper", "year": 2026, "set": null,
  "title": "GATE EC 2026", "branch": "ec",
  "questions": [{
    "n": 1,                       // question number in the paper
    "marks": 1,
    "type": "mcq",                // "mcq" | "msq" | "nat"
    "subject": "control-systems", // ids from taxonomy.json
    "topic": "root-locus",
    "question": "HTML; maths as \\(inline\\) or \\[display\\] KaTeX; images as <img src=\"img/<file>\">",
    "options": ["…", "…", "…", "…"],           // omit for "nat"
    "answer": "A",                // "A" | ["A","C"] for msq | {"min": 0.25, "max": 0.25} for nat | null if no key
    "explanation": "optional HTML"
  }]
}
```

Put images in `data/img/` and reference them as `img/<file>`.

To convert a dump in the original scraped format (the one used for the initial import) use the importer; it normalises subjects/topics through the taxonomy and content-hashes images:

```sh
python3 scripts/import_raw.py ec path/to/gate_ec_all_years.json path/to/image_root --only 2026
```

Changing the topic list: edit `scripts/make_taxonomy.py` and run it. Aliases there map raw source names onto canonical topics.

## Layout

```
web/       static app (HTML, CSS, ES modules)
data/      taxonomy + per-paper JSON + images (source of truth)
scripts/   build.py (site build + validation), import_raw.py, make_taxonomy.py
dist/      build output, git-ignored
```

## Data and licensing

The question text, answer keys, explanations and images were imported from the dataset published at pyq.akshat.sh (itself compiled from practicepaper.in); the underlying questions are from the official GATE papers set by IISc/IITs. That dataset carries no licence, so check you are comfortable republishing it before making this repository or site public.

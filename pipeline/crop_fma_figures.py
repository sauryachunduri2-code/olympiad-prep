"""Crop figures out of an AAPT F=ma exam PDF.

Questions with a diagram in the stem get `qNN-diagram.png`: the union of the
vector drawings above the answer choices, padded to keep axis labels.
Questions whose answer choices are themselves graphs get `qNN-full.png`: the
whole question region, because the choices only exist as drawings.

Usage: python -I crop_fma_figures.py exam.pdf out_dir graph_question_numbers
       e.g. ... exam.pdf figures/fma-2024 4,6,7,13
"""
import re
import sys
from pathlib import Path

import pymupdf

QUESTION_START = re.compile(r"^(\d{1,2})\.\s")
CHOICE_A = re.compile(r"^\(A\)")
LEFT_MARGIN_MAX = 80
DPI = 200
PAD_X, PAD_Y = 28, 8
LABEL_MAX_W, LABEL_MAX_H = 60, 20
LABEL_REACH_X, LABEL_REACH_Y = 28, 22


def lines(page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            yield text, pymupdf.Rect(line["bbox"])


def question_regions(page):
    """Yield (number, region, choices_top) for each question on the page."""
    found = [(int(m.group(1)), r.y0) for t, r in lines(page)
             if (m := QUESTION_START.match(t)) and r.x0 < LEFT_MARGIN_MAX]
    footer = next(r.y0 for t, r in lines(page) if t.startswith("Copyright"))
    for i, (number, top) in enumerate(found):
        bottom = found[i + 1][1] if i + 1 < len(found) else footer
        region = pymupdf.Rect(40, top - 4, page.rect.width - 40, bottom - 2)
        choices_top = next(
            (r.y0 for t, r in lines(page) if CHOICE_A.match(t) and region.contains(r)),
            None,
        )
        if choices_top is None or "(E)" not in page.get_text("text", clip=region):
            raise ValueError(f"Q{number}: choices not found inside its region")
        yield number, region, choices_top


def with_labels(page, union, region, choices_top):
    """Grow `union` to take in short text labels (M, 2M, omega...) beside the drawing."""
    labels = [r for t, r in lines(page)
              if r.width <= LABEL_MAX_W and r.height <= LABEL_MAX_H
              and region.contains(r) and r.y1 <= choices_top - 10
              and not QUESTION_START.match(t)]
    for _ in range(3):
        reach = pymupdf.Rect(union.x0 - LABEL_REACH_X, union.y0 - LABEL_REACH_Y,
                             union.x1 + LABEL_REACH_X, union.y1 + LABEL_REACH_Y)
        for label in labels:
            if reach.intersects(label):
                union |= label
    return union


def clear_of_text(page, rect, figure):
    """Keep padding from slicing into the stem lines directly above or below the figure."""
    prose = [r for t, r in lines(page) if r.width > LABEL_MAX_W and rect.intersects(r)]
    above = [r.y1 for r in prose if r.y1 <= figure.y0 + 2]
    below = [r.y0 for r in prose if r.y0 >= figure.y1 - 2]
    top = max([rect.y0] + [y + 1 for y in above])
    bottom = min([rect.y1] + [y - 1 for y in below])
    return pymupdf.Rect(rect.x0, top, rect.x1, bottom)


def crop(page, rect, path):
    page.get_pixmap(dpi=DPI, clip=rect).save(path)


def main(pdf, out_dir, graph_numbers):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = {}
    for page in pymupdf.open(pdf):
        for number, region, choices_top in question_regions(page):
            if number in graph_numbers:
                path = out / f"q{number:02d}-full.png"
                crop(page, region, path)
                written[number] = path.name
                continue
            boxes = [d["rect"] for d in page.get_drawings()
                     if region.intersects(d["rect"]) and d["rect"].y1 <= choices_top + 1]
            if not boxes:
                continue
            union = pymupdf.Rect(boxes[0])
            for box in boxes[1:]:
                union |= box
            union = with_labels(page, union, region, choices_top)
            padded = pymupdf.Rect(union.x0 - PAD_X, union.y0 - PAD_Y,
                                  union.x1 + PAD_X, union.y1 + PAD_Y) & region
            union = clear_of_text(page, padded, union)
            path = out / f"q{number:02d}-diagram.png"
            crop(page, union, path)
            written[number] = path.name
    for number in sorted(written):
        print(number, written[number])


if __name__ == "__main__":
    pdf, out_dir, graphs = sys.argv[1:4]
    main(pdf, out_dir, {int(n) for n in graphs.split(",")})

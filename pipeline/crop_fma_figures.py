"""Crop figures out of an AAPT F=ma exam PDF.

Questions with a diagram in the stem get `qNN-diagram.png`: the union of the
vector drawings above the answer choices, padded to keep axis labels.
Questions whose answer choices are themselves graphs or drawings get
`qNN-full.png`: the whole question, because the choices only exist as drawings.

A question can run across a page break (2023 Q15, Q23). Its pieces are cropped
from each page and stacked into one image.

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
REGION_LEFT = 20  # 2023 sets two-digit question numbers left of x = 40
HEADER_BOTTOM = 50
DPI = 200
PAD_X, PAD_Y = 28, 8
LABEL_MAX_W, LABEL_MAX_H = 60, 20
LABEL_REACH_X, LABEL_REACH_Y = 28, 22
STACK_GAP = 6


def lines(page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            yield text, pymupdf.Rect(line["bbox"])


class Segment:
    """One page's worth of a question."""

    def __init__(self, page, rect):
        self.page = page
        self.rect = rect
        self.has_last_choice = "(E)" in page.get_text("text", clip=rect)
        self.choices_top = next(
            (r.y0 for t, r in lines(page) if CHOICE_A.match(t) and rect.contains(r)), None
        )


def find_segments(doc):
    """Map question number to its list of Segments, in reading order."""
    found = {}
    waiting = None  # question whose answer choices have not appeared yet
    for page in doc:
        page_lines = list(lines(page))
        starts = [(int(m.group(1)), r.y0) for t, r in page_lines
                  if (m := QUESTION_START.match(t)) and r.x0 < LEFT_MARGIN_MAX]
        footer = next(r.y0 for t, r in page_lines if t.startswith("Copyright"))
        width = page.rect.width
        if waiting is not None:
            end = (starts[0][1] if starts else footer) - 2
            seg = Segment(page, pymupdf.Rect(REGION_LEFT, HEADER_BOTTOM, width - REGION_LEFT, end))
            found[waiting].append(seg)
            if seg.has_last_choice:
                waiting = None
        for i, (number, top) in enumerate(starts):
            bottom = (starts[i + 1][1] if i + 1 < len(starts) else footer) - 2
            seg = Segment(page, pymupdf.Rect(REGION_LEFT, top - 4, width - REGION_LEFT, bottom))
            found[number] = [seg]
            if not seg.has_last_choice:
                if i + 1 < len(starts):
                    raise ValueError(f"Q{number}: choices not found before the next question")
                waiting = number
    if waiting is not None:
        raise ValueError(f"Q{waiting}: choices never appear")
    return found


def with_labels(page, union, region, choices_top):
    """Grow `union` to take in short text labels (M, 2M, omega...) beside the drawing."""
    limit = region.y1 if choices_top is None else choices_top - 10
    labels = [r for t, r in lines(page)
              if r.width <= LABEL_MAX_W and r.height <= LABEL_MAX_H
              and region.contains(r) and r.y1 <= limit
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


def diagram_rect(seg, phase):
    """Padded box around the stem diagram in one segment, or None if it has none."""
    if phase == "after":
        return None
    limit = seg.choices_top + 1 if phase == "choices" else seg.rect.y1
    boxes = [d["rect"] for d in seg.page.get_drawings()
             if seg.rect.intersects(d["rect"]) and d["rect"].y1 <= limit]
    if not boxes:
        return None
    union = pymupdf.Rect(boxes[0])
    for box in boxes[1:]:
        union |= box
    union = with_labels(seg.page, union, seg.rect,
                        seg.choices_top if phase == "choices" else None)
    padded = pymupdf.Rect(union.x0 - PAD_X, union.y0 - PAD_Y,
                          union.x1 + PAD_X, union.y1 + PAD_Y) & seg.rect
    return clear_of_text(seg.page, padded, union)


def render(pieces, path):
    """Save one image from (page, rect) pieces, stacked top to bottom."""
    if len(pieces) == 1:
        page, rect = pieces[0]
        page.get_pixmap(dpi=DPI, clip=rect).save(path)
        return
    width = max(rect.width for _, rect in pieces)
    height = sum(rect.height for _, rect in pieces) + STACK_GAP * (len(pieces) - 1)
    canvas = pymupdf.open()
    sheet = canvas.new_page(width=width, height=height)
    y = 0
    for page, rect in pieces:
        sheet.show_pdf_page(pymupdf.Rect(0, y, rect.width, y + rect.height),
                            page.parent, page.number, clip=rect)
        y += rect.height + STACK_GAP
    sheet.get_pixmap(dpi=DPI).save(path)


def main(pdf, out_dir, graph_numbers):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = {}
    for number, segs in sorted(find_segments(pymupdf.open(pdf)).items()):
        if number in graph_numbers:
            path = out / f"q{number:02d}-full.png"
            render([(s.page, s.rect) for s in segs], path)
            written[number] = path.name
            continue
        choices_at = next(i for i, s in enumerate(segs) if s.choices_top is not None)
        pieces = []
        for i, seg in enumerate(segs):
            phase = "before" if i < choices_at else "choices" if i == choices_at else "after"
            rect = diagram_rect(seg, phase)
            if rect is not None:
                pieces.append((seg.page, rect))
        if pieces:
            path = out / f"q{number:02d}-diagram.png"
            render(pieces, path)
            written[number] = path.name
    for number in sorted(written):
        print(number, written[number])


if __name__ == "__main__":
    pdf, out_dir, graphs = sys.argv[1:4]
    main(pdf, out_dir, {int(n) for n in graphs.split(",")})

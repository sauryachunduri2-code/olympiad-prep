"""Read the answer key from an AAPT F=ma solutions PDF.

The solutions booklet reprints every question and marks the correct choice by
setting its letter in red bold. Figure labels use the same letters in plain
black, so color is the only reliable signal.

A few questions mark two letters: AAPT sometimes accepts a second answer after
the fact (2023 Q15). Letters come out in choice order, so the explanation text
says which was the original answer; the tagging step must name it.

Usage: python -I extract_fma_key.py solutions.pdf
Prints a JSON object mapping question number to the list of accepted letters.
"""
import json
import re
import sys

import pymupdf

RED = 0xFF0000
QUESTION_START = re.compile(r"^(\d{1,2})\.\s")


def extract_key(path):
    key = {}
    question = None
    for page in pymupdf.open(path):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = line["spans"]
                text = "".join(s["text"] for s in spans)
                match = QUESTION_START.match(text)
                if match:
                    question = int(match.group(1))
                for span in spans:
                    letter = span["text"].strip()
                    if span["color"] == RED and letter in tuple("ABCDE"):
                        key.setdefault(question, []).append(letter)
    return key


if __name__ == "__main__":
    key = extract_key(sys.argv[1])
    missing = [n for n in range(1, 26) if n not in key]
    if missing:
        sys.exit(f"no marked answer for questions {missing}")
    print(json.dumps(key, sort_keys=True))

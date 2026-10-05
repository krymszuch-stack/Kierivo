"""Narzędzia tekstu: zawijanie i pomiar szerokości."""

from __future__ import annotations

from reportlab.pdfbase.pdfmetrics import stringWidth


def text_width(text: str, font: str, size: float, char_space: float = 0.0) -> float:
    if not text:
        return 0.0
    return stringWidth(text, font, size) + char_space * max(0, len(text) - 1)


def wrap_text(text: str, font: str, size: float, max_width: float,
              char_space: float = 0.0, *, break_long_words: bool = False) -> list[str]:
    """Zawija tekst; opcjonalnie dzieli długie tokeny zamiast je skracać."""
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        if break_long_words:
            expanded: list[str] = []
            for word in words:
                if text_width(word, font, size, char_space) <= max_width:
                    expanded.append(word)
                    continue
                chunk = ""
                for character in word:
                    candidate = chunk + character
                    if chunk and text_width(candidate, font, size, char_space) > max_width:
                        expanded.append(chunk)
                        chunk = character
                    else:
                        chunk = candidate
                if chunk:
                    expanded.append(chunk)
            words = expanded
        cur = words[0]
        for w in words[1:]:
            cand = f"{cur} {w}"
            if text_width(cand, font, size, char_space) <= max_width:
                cur = cand
            else:
                lines.append(cur)
                cur = w
        # Sprawdź czy ostatnie słowo przekracza max_width
        if text_width(cur, font, size, char_space) > max_width and len(cur) > 1:
            # Truncuj znak po znaku z elipsą
            truncated = ""
            for ch in cur:
                candidate = truncated + ch + "…"
                if text_width(candidate, font, size, char_space) <= max_width:
                    truncated += ch
                else:
                    break
            cur = truncated + "…" if truncated else cur[:1] + "…"
        lines.append(cur)
    return lines


def wrap_to_width_spans(spans: list[tuple[str, str, float]], max_width: float) -> list[list[tuple[str, str, float]]]:
    """Zawijanie mieszanych przebiegów (tekst, font, size) — używane przez nagłówki ofert."""
    out: list[list[tuple[str, str, float]]] = []
    line: list[tuple[str, str, float]] = []
    used = 0.0
    for text, font, size in spans:
        w = text_width(text, font, size)
        if line and used + w > max_width:
            out.append(line)
            line, used = [], 0.0
        line.append((text, font, size))
        used += w
    if line:
        out.append(line)
    return out

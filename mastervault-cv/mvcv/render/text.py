"""Narzędzia tekstu: zawijanie i pomiar szerokości."""

from __future__ import annotations

from reportlab.pdfbase.pdfmetrics import stringWidth


def text_width(text: str, font: str, size: float, char_space: float = 0.0) -> float:
    if not text:
        return 0.0
    return stringWidth(text, font, size) + char_space * max(0, len(text) - 1)


def wrap_text(text: str, font: str, size: float, max_width: float,
              char_space: float = 0.0) -> list[str]:
    """Zawijanie po słowach. Długie słowa przekraczające max_width są przycinane z elipsą."""
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
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

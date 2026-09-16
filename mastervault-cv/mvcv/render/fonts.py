"""Rejestr fontów z awaryjnym fallbackiem (Windows -> DejaVu)."""

from __future__ import annotations

import os

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_FONT_DIRS = [r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu", "/usr/share/fonts"]

# alias -> kandydaci (rodzina, plik, fallback-aliases)
_CANDIDATES: dict[str, list[str]] = {
    "Georgia": ["georgia.ttf", "Georgia.ttf"],
    "Georgia-Bold": ["georgiab.ttf", "Georgiab.ttf"],
    "Georgia-Italic": ["georgiai.ttf"],
    "SegoeUI": ["segoeui.ttf"],
    "SegoeUI-Bold": ["segoeuib.ttf"],
    "SegoeUI-Semibold": ["segoeuisl.ttf", "segoeuib.ttf"],
    "DejaVuSans": ["DejaVuSans.ttf"],
    "DejaVuSans-Bold": ["DejaVuSans-Bold.ttf"],
    "DejaVuSans-Oblique": ["DejaVuSans-Oblique.ttf"],
}

_registered = False


def alias_for(family: str) -> str:
    """Nazwa rodziny logicznej -> zarejestrowany alias ReportLab."""
    return {
        "Sans": "SegoeUI", "Sans-Bold": "SegoeUI-Bold", "Sans-Semibold": "SegoeUI-Semibold",
        "Serif": "Georgia", "Serif-Bold": "Georgia-Bold", "Serif-Italic": "Georgia-Italic",
        "Mono": "Consolas",
    }.get(family, family)


def _find(fname: str) -> str | None:
    for d in _FONT_DIRS:
        p = os.path.join(d, fname)
        if os.path.isfile(p):
            return p
    return None


def register_fonts() -> dict[str, str]:
    """Zarejestruj TTF-y; aliasy wskazują na najlepszy dostępny plik."""
    global _registered
    resolved: dict[str, str] = {}
    for alias, files in _CANDIDATES.items():
        for f in files:
            path = _find(f)
            if path:
                try:
                    pdfmetrics.registerFont(TTFont(alias, path))
                    resolved[alias] = path
                    break
                except Exception:  # noqa: BLE001 — zły plik fontu, próbuj dalej
                    continue
    # fallback łańcuchowy, gdyby Segoe/Georgia były niedostępne
    chain = [
        ("Georgia", "DejaVuSans"), ("Georgia-Bold", "DejaVuSans-Bold"),
        ("Georgia-Italic", "DejaVuSans-Oblique"),
        ("SegoeUI", "DejaVuSans"), ("SegoeUI-Bold", "DejaVuSans-Bold"),
        ("SegoeUI-Semibold", "DejaVuSans-Bold"),
    ]
    for alias, fb in chain:
        if alias not in resolved and fb in resolved:
            pdfmetrics.registerFont(TTFont(alias, resolved[fb]))
            resolved[alias] = resolved[fb]
    _required = ("Georgia", "Georgia-Bold", "SegoeUI", "SegoeUI-Bold", "SegoeUI-Semibold")
    missing = [a for a in _required if a not in resolved]
    if missing:
        raise RuntimeError(f"Nie znaleziono wymaganych fontów: {missing}")
    _registered = True
    return resolved

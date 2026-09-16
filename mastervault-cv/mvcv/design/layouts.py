"""Presety layoutów — siatka CV, niezależna od treści i kolorów.

Układy wspierane przez silnik:
1. ``single``         — jedna kolumna (CV formalne / ATS)
2. ``sidebar``        — sidebar lewy (32/68)
3. ``sidebar-30``     — sidebar lewy węższy (30/70)
4. ``sidebar-35``     — sidebar lewy szerszy (35/65)
5. ``sidebar-wide``   — sidebar lewy asymetryczny (42/58)
6. ``sidebar-right``  — główna treść po lewej (65%), sidebar po prawej (35%)
7. ``banner-sidebar`` — pełny banner nagłówkowy u góry strony + sidebar (32/68) poniżej
8. ``two-column``     — zbalansowane dwie kolumny (48/52)

Reguła responsywności i druku: silnik dopasowuje treść przez governance i metrykę fontów,
gwarantując idealny podział na arkuszu A4 portrait.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LayoutPreset:
    name: str
    kind: str                  # single | sidebar
    sidebar_ratio: float       # szerokość sidebaru jako część strony
    sidebar_pos: str = "left"  # left | right
    has_banner: bool = False   # czy nagłówek rozciąga się na pełną szerokość u góry


SINGLE = LayoutPreset("single", "single", 0.0)
SIDEBAR = LayoutPreset("sidebar", "sidebar", 0.32, sidebar_pos="left")
SIDEBAR_30 = LayoutPreset("sidebar-30", "sidebar", 0.30, sidebar_pos="left")
SIDEBAR_35 = LayoutPreset("sidebar-35", "sidebar", 0.35, sidebar_pos="left")
SIDEBAR_WIDE = LayoutPreset("sidebar-wide", "sidebar", 0.42, sidebar_pos="left")
ASYMMETRIC = LayoutPreset("asymmetric", "sidebar", 0.42, sidebar_pos="left")
SIDEBAR_RIGHT = LayoutPreset("sidebar-right", "sidebar", 0.35, sidebar_pos="right")
BANNER_SIDEBAR = LayoutPreset("banner-sidebar", "sidebar", 0.32, sidebar_pos="left", has_banner=True)
BANNER_RIGHT = LayoutPreset("banner-right", "sidebar", 0.35, sidebar_pos="right", has_banner=True)
TWO_COLUMN = LayoutPreset("two-column", "sidebar", 0.48, sidebar_pos="left")

LAYOUTS: dict[str, LayoutPreset] = {
    l.name: l for l in (
        SINGLE, SIDEBAR, SIDEBAR_30, SIDEBAR_35, SIDEBAR_WIDE,
        ASYMMETRIC, SIDEBAR_RIGHT, BANNER_SIDEBAR, BANNER_RIGHT, TWO_COLUMN,
    )
}


def get_layout(name: str) -> LayoutPreset:
    if name not in LAYOUTS:
        raise KeyError(f"Nieznany layout {name!r}. Dostępne: {', '.join(LAYOUTS)}")
    return LAYOUTS[name]

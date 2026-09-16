"""Tokeny wizualne — jedyna droga, w której dane spotykają się z wyglądem.

Architektura trójwarstwowa:

    ResumeData  ->  Layout Preset  ->  Visual Theme

* ``ColorTokens``      — rola kolorów (nie konkretne elementy!),
* ``TypographyTokens`` — rodzinne kroje i skala,
* ``LayoutTokens``      — siatka, marginesy, proporcje kolumn,
* ``ResumeTheme``      — spójny preset gotowy do renderu.

Reguły projektowe egzekwowane przez tokeny:
* tekst zawsze bardzo wysoki kontrast (>= 4.5:1 dla body),
* akcent <= ~25% powierzchni (u nas: linie, pigułki, inicjały — nigdy tło treści),
* kolorowe tło tylko w sidebarze / nagłówku,
* maks. 3–4 kolory bazowe + pochodne,
* gradienty oszczędnie: tło strony i pasek akcentu.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ColorTokens:
    bg_main: str
    bg_gradient: tuple[str, str]           # subtelny gradient tła strony (135deg)
    sidebar_bg: str                        # tło sidebaru (kolor tylko tu / w nagłówku)
    sidebar_text: str
    sidebar_muted: str                     # wyciszone etykiety w sidebarze (wysoki kontrast na tle sidebaru)
    text_primary: str
    text_secondary: str                    # nie jaśniejszy niż ~#5f6368 na jasnym tle
    accent: str
    accent_alt: str                        # drugi kolor gradientu akcentu
    accent_soft: str                       # wypełnienie pigułek (tint akcentu)
    accent_border: str                     # obrys pigułek
    on_accent: str
    border: str
    hairline: str

    def rgb(self, name: str) -> tuple[float, float, float]:
        from reportlab.lib.colors import HexColor

        return HexColor(getattr(self, name)).rgb()


@dataclass(frozen=True)
class TypographyTokens:
    serif: str = "Georgia"
    serif_bold: str = "Georgia-Bold"
    serif_italic: str = "Georgia-Italic"
    sans: str = "SegoeUI"
    sans_bold: str = "SegoeUI-Bold"
    sans_semibold: str = "SegoeUI-Semibold"

    name_size: float = 24.0
    title_size: float = 9.2
    h2_size: float = 10.6
    body_size: float = 9.6
    small_size: float = 8.4
    pill_size: float = 8.6
    micro_size: float = 7.4

    body_leading: float = 13.6
    summary_leading: float = 14.2
    name_leading: float = 27.0


@dataclass(frozen=True)
class LayoutTokens:
    kind: str = "sidebar"          # sidebar | single | asymmetric
    sidebar_ratio: float = 0.32    # uniwersalne 32/68; nie schodzić poniżej 28%
    page_margin: float = 46.0      # pt, margines treści
    sidebar_pad: float = 20.0      # wewnętrzny padding sidebaru
    gutter: float = 26.0           # przerwa między kolumnami
    top_margin: float = 40.0
    bottom_margin: float = 40.0


@dataclass(frozen=True)
class ResumeTheme:
    name: str
    colors: ColorTokens
    typography: TypographyTokens
    layout: LayoutTokens
    avatar: str = "circle"          # circle | square | none
    sidebar_style: str = "tint"     # tint | dark | none
    use_gradients: bool = True
    font_overrides: dict = field(default_factory=dict)


# --------------------------------------------------------------------- presety

def _t(name: str, colors: ColorTokens, *, avatar: str = "circle",
       sidebar_style: str = "tint", serif: bool = False,
       single: bool = False, wide: bool = False) -> ResumeTheme:
    typo = TypographyTokens(
        serif="Georgia" if serif else "SegoeUI",
        serif_bold="Georgia-Bold" if serif else "SegoeUI-Bold",
        serif_italic="Georgia-Italic" if serif else "SegoeUI",
    )
    ratio = 0.0 if single else (0.42 if wide else 0.32)
    kind = "single" if single else "sidebar"
    ly = LayoutTokens(kind=kind, sidebar_ratio=ratio)
    return ResumeTheme(
        name=name,
        colors=colors,
        typography=typo,
        layout=ly,
        avatar="none" if single else avatar,
        sidebar_style="none" if single else sidebar_style,
    )


PARCHMENT = _t(
    "parchment",
    ColorTokens(
        bg_main="#f7f5ef", bg_gradient=("#f7f5ef", "#ffffff"),
        sidebar_bg="#f1ede2", sidebar_text="#202124", sidebar_muted="#666a70",
        text_primary="#202124", text_secondary="#5f6368",
        accent="#31579b", accent_alt="#6b61b8", accent_soft="#e7ebf4",
        accent_border="#bcc8de", on_accent="#ffffff", border="#d7d3ca", hairline="#d7d3ca",
    ),
    sidebar_style="tint",
)

GRAPHITE = _t(
    "graphite",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f4f4f6"),
        sidebar_bg="#23272e", sidebar_text="#f2f3f5", sidebar_muted="#a3a8b0",
        text_primary="#1c1e21", text_secondary="#5f6368",
        accent="#31579b", accent_alt="#6b61b8", accent_soft="#e7ebf4",
        accent_border="#bcc8de", on_accent="#ffffff", border="#d9d9de", hairline="#dcdce0",
    ),
    sidebar_style="dark",
)

CLASSIC = _t(
    "classic",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#ffffff"),
        sidebar_bg="#ffffff", sidebar_text="#202124", sidebar_muted="#666a70",
        text_primary="#202124", text_secondary="#5f6368",
        accent="#31579b", accent_alt="#31579b", accent_soft="#eef1f7",
        accent_border="#c9d3e6", on_accent="#ffffff", border="#cfcfcf", hairline="#d9d9d9",
    ),
    single=True,
)

EDITORIAL = _t(
    "editorial",
    ColorTokens(
        bg_main="#fffdfa", bg_gradient=("#fffdfa", "#f6f2ec"),
        sidebar_bg="#1e1e1e", sidebar_text="#f7f3ed", sidebar_muted="#c4bbb0",
        text_primary="#171717", text_secondary="#5c564e",
        accent="#171717", accent_alt="#4a4741", accent_soft="#f2eee7",
        accent_border="#b8afa4", on_accent="#ffffff", border="#c7bfb5", hairline="#ddd4c8",
    ),
    avatar="circle", sidebar_style="dark", serif=True,
)

COBALT = _t(
    "cobalt",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f4f8fc"),
        sidebar_bg="#204f9a", sidebar_text="#ffffff", sidebar_muted="#c4d9ee",
        text_primary="#1b2e4b", text_secondary="#4b6584",
        accent="#204f9a", accent_alt="#337eae", accent_soft="#e8f0fe",
        accent_border="#a8c7fa", on_accent="#ffffff", border="#d0e1fd", hairline="#dbe7fb",
    ),
    avatar="circle", sidebar_style="dark", wide=True,
)

SAND = _t(
    "sand",
    ColorTokens(
        bg_main="#f0e8df", bg_gradient=("#f0e8df", "#faf7f2"),
        sidebar_bg="#d3c8b5", sidebar_text="#3c2f23", sidebar_muted="#786c5e",
        text_primary="#2d2319", text_secondary="#635547",
        accent="#685444", accent_alt="#8b806e", accent_soft="#e5dcce",
        accent_border="#c4b8a5", on_accent="#ffffff", border="#cbbfae", hairline="#d7ccbc",
    ),
    avatar="circle", sidebar_style="tint", serif=True, wide=True,
)

INK = _t(
    "ink",
    ColorTokens(
        bg_main="#fbf9f4", bg_gradient=("#fbf9f4", "#f0ede4"),
        sidebar_bg="#202a34", sidebar_text="#f5f2ea", sidebar_muted="#a4b0be",
        text_primary="#171717", text_secondary="#555d66",
        accent="#202a34", accent_alt="#38495a", accent_soft="#e4e8ec",
        accent_border="#b8c2cc", on_accent="#ffffff", border="#cfd6dc", hairline="#d8dfe4",
    ),
    avatar="square", sidebar_style="dark", wide=True,
)

PASTEL = _t(
    "pastel",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f6faff"),
        sidebar_bg="#9bcae1", sidebar_text="#2e2159", sidebar_muted="#4a3b7a",
        text_primary="#2e2159", text_secondary="#5a4c87",
        accent="#2e2159", accent_alt="#8171b8", accent_soft="#ffe09b",
        accent_border="#efb6d2", on_accent="#ffffff", border="#cce3f0", hairline="#dbe9f2",
    ),
    avatar="square", sidebar_style="tint",
)

BLUEPRINT = _t(
    "blueprint",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f0f7fc"),
        sidebar_bg="#337eae", sidebar_text="#ffffff", sidebar_muted="#cce2f0",
        text_primary="#1b3952", text_secondary="#4b6b85",
        accent="#2a6495", accent_alt="#337eae", accent_soft="#e1f0fa",
        accent_border="#99c9eb", on_accent="#ffffff", border="#bcdbf0", hairline="#cde3f3",
    ),
    avatar="circle", sidebar_style="dark",
)

CORAL = _t(
    "coral",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#fffaf8"),
        sidebar_bg="#faf7f4", sidebar_text="#252525", sidebar_muted="#777068",
        text_primary="#222222", text_secondary="#555555",
        accent="#f05235", accent_alt="#ff4b22", accent_soft="#ffebe7",
        accent_border="#f8aba0", on_accent="#ffffff", border="#eedfd8", hairline="#f2e7e2",
    ),
    avatar="circle", sidebar_style="tint",
)

OLIVE = _t(
    "olive",
    ColorTokens(
        bg_main="#ead1bc", bg_gradient=("#ead1bc", "#f7ede3"),
        sidebar_bg="#5b6540", sidebar_text="#efe1cd", sidebar_muted="#cfc3af",
        text_primary="#3c191c", text_secondary="#613e40",
        accent="#3c191c", accent_alt="#5b6540", accent_soft="#eed9c7",
        accent_border="#cbb39e", on_accent="#ffffff", border="#cbb5a0", hairline="#d8c5b3",
    ),
    avatar="square", sidebar_style="dark", serif=True, wide=True,
)

CREAM = _t(
    "cream",
    ColorTokens(
        bg_main="#f7f7f5", bg_gradient=("#f7f7f5", "#ffffff"),
        sidebar_bg="#ecece8", sidebar_text="#252525", sidebar_muted="#666a70",
        text_primary="#222222", text_secondary="#555555",
        accent="#222222", accent_alt="#555555", accent_soft="#e6e6e2",
        accent_border="#cccccc", on_accent="#ffffff", border="#d8d8d4", hairline="#deded9",
    ),
    avatar="square", sidebar_style="tint",
)

TEAL = _t(
    "teal",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f0f8f8"),
        sidebar_bg="#18536c", sidebar_text="#ffffff", sidebar_muted="#c4d9ee",
        text_primary="#142c36", text_secondary="#43606c",
        accent="#18536c", accent_alt="#51a78e", accent_soft="#e0f2f1",
        accent_border="#80cbc4", on_accent="#ffffff", border="#b2dfdb", hairline="#ccebe7",
    ),
    avatar="circle", sidebar_style="dark", wide=True,
)

PHOTO = _t(
    "photo",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f7f9fa"),
        sidebar_bg="#f4f0e8", sidebar_text="#203348", sidebar_muted="#6c7a89",
        text_primary="#203348", text_secondary="#536473",
        accent="#203348", accent_alt="#34495e", accent_soft="#e8eef3",
        accent_border="#bcc3c9", on_accent="#ffffff", border="#d2d9de", hairline="#dee3e7",
    ),
    avatar="circle", sidebar_style="tint", serif=True,
)

DOTS = _t(
    "dots",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f8f8f8"),
        sidebar_bg="#e4e4e4", sidebar_text="#36383d", sidebar_muted="#6c757d",
        text_primary="#36383d", text_secondary="#60646a",
        accent="#36383d", accent_alt="#555555", accent_soft="#f0f0f0",
        accent_border="#cccccc", on_accent="#ffffff", border="#d0d0d0", hairline="#dadada",
    ),
    avatar="circle", sidebar_style="tint",
)

ROSE = _t(
    "rose",
    ColorTokens(
        bg_main="#fff8f7", bg_gradient=("#fff8f7", "#ffffff"),
        sidebar_bg="#f7ecea", sidebar_text="#321c26", sidebar_muted="#7a5866",
        text_primary="#321c26", text_secondary="#6b4c58",
        accent="#b95872", accent_alt="#9d3333", accent_soft="#fbe8ec",
        accent_border="#e8b4c2", on_accent="#ffffff", border="#eed2d8", hairline="#f4dde2",
    ),
    avatar="circle", sidebar_style="tint", serif=True,
)

NAVY = _t(
    "navy",
    ColorTokens(
        bg_main="#f6f7fb", bg_gradient=("#f6f7fb", "#ffffff"),
        sidebar_bg="#162640", sidebar_text="#f6f7fb", sidebar_muted="#9bb8d2",
        text_primary="#162640", text_secondary="#4b5d78",
        accent="#e56b5d", accent_alt="#c44d3f", accent_soft="#fdece9",
        accent_border="#f5aba2", on_accent="#ffffff", border="#ccd6e4", hairline="#d8e0ec",
    ),
    avatar="circle", sidebar_style="dark", wide=True,
)

LILAC = _t(
    "lilac",
    ColorTokens(
        bg_main="#f5f1ff", bg_gradient=("#f5f1ff", "#ffffff"),
        sidebar_bg="#ebe4fc", sidebar_text="#302b4f", sidebar_muted="#6f6793",
        text_primary="#302b4f", text_secondary="#5c5384",
        accent="#8171b8", accent_alt="#6b61b8", accent_soft="#ebe5f9",
        accent_border="#cfc4ec", on_accent="#ffffff", border="#ddd5f4", hairline="#e6dff8",
    ),
    avatar="square", sidebar_style="tint",
)

RUST = _t(
    "rust",
    ColorTokens(
        bg_main="#eee9e2", bg_gradient=("#eee9e2", "#faf7f4"),
        sidebar_bg="#e2dbd1", sidebar_text="#2d2927", sidebar_muted="#736a65",
        text_primary="#2d2927", text_secondary="#5e5550",
        accent="#b9573e", accent_alt="#98442e", accent_soft="#f9ebe7",
        accent_border="#e4b5a9", on_accent="#ffffff", border="#d7cec3", hairline="#ded7cd",
    ),
    avatar="circle", sidebar_style="tint",
)

MINT = _t(
    "mint",
    ColorTokens(
        bg_main="#e9f4ef", bg_gradient=("#e9f4ef", "#f8fbf9"),
        sidebar_bg="#daf0e5", sidebar_text="#193b36", sidebar_muted="#46716a",
        text_primary="#193b36", text_secondary="#3d625b",
        accent="#26755f", accent_alt="#51a78e", accent_soft="#def3eb",
        accent_border="#9ccdbb", on_accent="#ffffff", border="#c4e5d6", hairline="#d2ece0",
    ),
    avatar="circle", sidebar_style="tint",
)

VIOLET = _t(
    "violet",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f8f3fc"),
        sidebar_bg="#291e45", sidebar_text="#f9f3ff", sidebar_muted="#d1c2eb",
        text_primary="#291e45", text_secondary="#564778",
        accent="#7652ae", accent_alt="#f3b3ce", accent_soft="#f3eafb",
        accent_border="#d8bfee", on_accent="#ffffff", border="#d9cde8", hairline="#e4dbeF",
    ),
    avatar="circle", sidebar_style="dark",
)

SUN = _t(
    "sun",
    ColorTokens(
        bg_main="#fffaf0", bg_gradient=("#fffaf0", "#ffffff"),
        sidebar_bg="#f7eece", sidebar_text="#332c15", sidebar_muted="#736845",
        text_primary="#332c15", text_secondary="#635938",
        accent="#997018", accent_alt="#f0bd42", accent_soft="#fef4db",
        accent_border="#f3d98c", on_accent="#ffffff", border="#ede1bc", hairline="#f2e8cb",
    ),
    avatar="circle", sidebar_style="tint",
)

GRIDLINE = _t(
    "gridline",
    ColorTokens(
        bg_main="#f5f5f1", bg_gradient=("#f5f5f1", "#ffffff"),
        sidebar_bg="#e6e6df", sidebar_text="#182a38", sidebar_muted="#5e6e7d",
        text_primary="#182a38", text_secondary="#495a69",
        accent="#d56f49", accent_alt="#182a38", accent_soft="#f9eae4",
        accent_border="#e5b4a2", on_accent="#ffffff", border="#d9d9cf", hairline="#e1e1d9",
    ),
    avatar="none", sidebar_style="tint",
)

SLATE = _t(
    "slate",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f2f6f9"),
        sidebar_bg="#263b4d", sidebar_text="#ffffff", sidebar_muted="#a9b8c6",
        text_primary="#263b4d", text_secondary="#4b5d6e",
        accent="#d6a746", accent_alt="#b88628", accent_soft="#fbf4e4",
        accent_border="#e5cd94", on_accent="#ffffff", border="#cfdbe4", hairline="#dbe5ec",
    ),
    avatar="circle", sidebar_style="dark",
)

CHARLOTTE = _t(
    "charlotte",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f5f5f5"),
        sidebar_bg="#f5f5f5", sidebar_text="#090909", sidebar_muted="#555555",
        text_primary="#090909", text_secondary="#444444",
        accent="#090909", accent_alt="#333333", accent_soft="#eeeeee",
        accent_border="#cccccc", on_accent="#ffffff", border="#d9d9d9", hairline="#e2e2e2",
    ),
    avatar="none", sidebar_style="tint",
)

MARYBLUE = _t(
    "maryblue",
    ColorTokens(
        bg_main="#ebe6dc", bg_gradient=("#ebe6dc", "#f5f2eb"),
        sidebar_bg="#ddd6ca", sidebar_text="#4a3c37", sidebar_muted="#877b70",
        text_primary="#312622", text_secondary="#65554f",
        accent="#31579b", accent_alt="#9d3333", accent_soft="#e2e8f4",
        accent_border="#b2c3e4", on_accent="#ffffff", border="#cac1b2", hairline="#d4ccbf",
    ),
    avatar="circle", sidebar_style="tint", serif=True, wide=True,
)

PURPLEPHOTO = _t(
    "purplephoto",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f6f4fc"),
        sidebar_bg="#6b61b8", sidebar_text="#ffffff", sidebar_muted="#d8d3ff",
        text_primary="#2d2657", text_secondary="#564e83",
        accent="#6b61b8", accent_alt="#a69fe2", accent_soft="#edeaff",
        accent_border="#beb7f4", on_accent="#ffffff", border="#d5d0f5", hairline="#e1ddf9",
    ),
    avatar="circle", sidebar_style="dark", wide=True,
)

HINDLE = _t(
    "hindle",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f4f8fc"),
        sidebar_bg="#23518a", sidebar_text="#ffffff", sidebar_muted="#cfd4dc",
        text_primary="#183457", text_secondary="#465e7d",
        accent="#23518a", accent_alt="#ffd43b", accent_soft="#e6eef8",
        accent_border="#a3c0e3", on_accent="#ffffff", border="#c2d5ec", hairline="#d2e1f2",
    ),
    avatar="square", sidebar_style="dark", wide=True,
)

MARYGRAY = _t(
    "marygray",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f6f6f7"),
        sidebar_bg="#dfe0e2", sidebar_text="#38393b", sidebar_muted="#6b6d70",
        text_primary="#38393b", text_secondary="#5e6063",
        accent="#38393b", accent_alt="#55575a", accent_soft="#eeeff1",
        accent_border="#c4c6c9", on_accent="#ffffff", border="#d0d2d5", hairline="#dadcde",
    ),
    avatar="square", sidebar_style="tint", wide=True,
)

FANNY = _t(
    "fanny",
    ColorTokens(
        bg_main="#fff9e9", bg_gradient=("#fff9e9", "#ffffff"),
        sidebar_bg="#202326", sidebar_text="#fff9e9", sidebar_muted="#a8a59e",
        text_primary="#202326", text_secondary="#525558",
        accent="#202326", accent_alt="#44474b", accent_soft="#f2ecdc",
        accent_border="#cfc8b6", on_accent="#ffffff", border="#ded7c5", hairline="#e6e0cf",
    ),
    avatar="square", sidebar_style="dark", wide=True,
)

ISABELLA = _t(
    "isabella",
    ColorTokens(
        bg_main="#dfe7f3", bg_gradient=("#dfe7f3", "#f2f5fb"),
        sidebar_bg="#cfdcf0", sidebar_text="#111111", sidebar_muted="#566275",
        text_primary="#111111", text_secondary="#4b5565",
        accent="#6265d6", accent_alt="#6868d2", accent_soft="#eaeffb",
        accent_border="#b9c5ee", on_accent="#ffffff", border="#bdcee5", hairline="#cbdaf0",
    ),
    avatar="square", sidebar_style="tint", wide=True,
)

ALLIE = _t(
    "allie",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#ffffff", "#f7f8f2"),
        sidebar_bg="#f2f4e8", sidebar_text="#5d6043", sidebar_muted="#7c805d",
        text_primary="#42442f", text_secondary="#65684d",
        accent="#5d6043", accent_alt="#b6bd2a", accent_soft="#f3f6dc",
        accent_border="#cdd495", on_accent="#ffffff", border="#d9dec1", hairline="#e3e8cf",
    ),
    avatar="none", sidebar_style="tint", wide=True,
)

ZYRA = _t(
    "zyra",
    ColorTokens(
        bg_main="#ffffff", bg_gradient=("#f8d2d9", "#d7c8e2"),
        sidebar_bg="#f4ecf4", sidebar_text="#111111", sidebar_muted="#635b67",
        text_primary="#111111", text_secondary="#4d4651",
        accent="#7c4d7e", accent_alt="#d7c8e2", accent_soft="#faeef4",
        accent_border="#dfc6d7", on_accent="#ffffff", border="#dccbda", hairline="#e6d8e5",
    ),
    avatar="none", sidebar_style="tint", serif=True,
)

THEMES: dict[str, ResumeTheme] = {
    t.name: t for t in (
        PARCHMENT, GRAPHITE, CLASSIC, EDITORIAL, COBALT, SAND, INK, PASTEL,
        BLUEPRINT, CORAL, OLIVE, CREAM, TEAL, PHOTO, DOTS, ROSE, NAVY,
        LILAC, RUST, MINT, VIOLET, SUN, GRIDLINE, SLATE, CHARLOTTE,
        MARYBLUE, PURPLEPHOTO, HINDLE, MARYGRAY, FANNY, ISABELLA, ALLIE, ZYRA,
    )
}


def get_theme(name: str) -> ResumeTheme:
    key = name.lower().strip()
    if key not in THEMES:
        raise KeyError(f"Nieznany motyw {name!r}. Dostępne: {', '.join(sorted(THEMES))}")
    return THEMES[key]

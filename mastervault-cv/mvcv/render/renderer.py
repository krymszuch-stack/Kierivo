"""Renderer wizualny (ReportLab) — układa i rysuje CV na A4.

Renderuje WYŁĄCZNIE warstwę wizualną: to, co widzi rekruter i co dostaje
zwykły ekstraktor tekstu (Ctrl+A / prosty parser). Równolegle rejestruje węzły
semantyczne (MCID + /ActualText) w :class:`SemanticDoc` — bez rysowania
czegokolwiek podwójnie (zero niewidzialnego tekstu, zero trików render mode).
"""

from __future__ import annotations

import datetime as _dt
import io
import math
from dataclasses import dataclass, field

from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as rl_canvas

from ..data.model import MasterProfile
from ..design.layouts import LayoutPreset
from ..design.tokens import ResumeTheme
from .semantic import MarkedWriter, SemanticDoc
from .text import text_width, wrap_text

PAGE_W, PAGE_H = 595.276, 841.89  # A4 portrait, pt
AVATAR_MM = 42.0                  # stały moduł zdjęcia (reguła projektu)


@dataclass
class Column:
    x: float
    width: float
    top: float
    bottom: float
    y: float


@dataclass
class RenderResult:
    sem: SemanticDoc
    pages: int
    warnings: list[str] = field(default_factory=list)
    accent_area_pt2: float = 0.0        # nasycony akcent (paski, tarcza, kreski, kropki)
    soft_accent_area_pt2: float = 0.0   # pigułki (tint akcentu)

    @property
    def accent_coverage_pct(self) -> float:
        total = PAGE_W * PAGE_H * self.pages
        return 100.0 * self.accent_area_pt2 / total

    @property
    def soft_accent_coverage_pct(self) -> float:
        total = PAGE_W * PAGE_H * self.pages
        return 100.0 * self.soft_accent_area_pt2 / total


class Renderer:
    def __init__(self, profile: MasterProfile, theme: ResumeTheme,
                 layout: LayoutPreset, *, avatar: str | None = None):
        self.p = profile
        self.t = theme
        self.c = theme.colors
        self.ly = theme.layout
        self.layout = layout
        self.avatar_mode = (avatar or theme.avatar or "none").lower()
        if self.avatar_mode not in ("circle", "square", "none"):
            raise ValueError(f"avatar musi być circle|square|none, jest {avatar!r}")
        self.sem = SemanticDoc(lang="pl-PL")
        self.warnings: list[str] = []
        self.accent_area = 0.0
        self.soft_area = 0.0
        self._buf = io.BytesIO()

    # ------------------------------------------------------------ narzędzia

    def _rgb(self, name: str):
        return HexColor(getattr(self.c, name)).rgb()

    def _fill(self, name: str) -> None:
        self.canv.setFillColorRGB(*self._rgb(name))

    def _stroke(self, name: str) -> None:
        self.canv.setStrokeColorRGB(*self._rgb(name))

    def _text(self, x: float, y: float, s: str, font: str, size: float,
              *, color: str = "text_primary", char_space: float = 0.0) -> None:
        if not s:
            return
        self._fill(color)
        t = self.canv.beginText(x, y)
        t.setFont(font, size)
        # UWAGA: Tc jest stanem tekstowym PDF — nie jest resetowany przez BT/ET,
        # więc każdy przebieg musi ustawiać go jawnie (0 = brak rozstrzelenia).
        t.setCharSpace(char_space)
        t.textOut(s)
        self.canv.drawText(t)

    def _page_grad(self) -> None:
        """Subtelny gradient tła strony (odpowiednik 135deg bg-gradient-main)."""
        cv = self.canv
        cv.saveState()
        p = cv.beginPath()
        p.rect(0, 0, PAGE_W, PAGE_H)
        cv.clipPath(p, stroke=0, fill=0)
        cv.linearGradient(0, PAGE_H, PAGE_W, 0,
                          [HexColor(self.c.bg_gradient[0]), HexColor(self.c.bg_gradient[1])],
                          extend=True)
        cv.restoreState()

    def _grad_rect(self, x: float, y: float, w: float, h: float,
                   c1: str, c2: str, *, diag: bool = True) -> None:
        """Wypełnij prostokąt gradientem akcentowym (135deg jak accent-gradient)."""
        cv = self.canv
        cv.saveState()
        p = cv.beginPath()
        p.rect(x, y, w, h)
        cv.clipPath(p, stroke=0, fill=0)
        if diag:
            cv.linearGradient(x, y + h, x + w, y,
                              [HexColor(getattr(self.c, c1)), HexColor(getattr(self.c, c2))],
                              extend=True)
        else:
            cv.linearGradient(x, y, x + w, y,
                              [HexColor(getattr(self.c, c1)), HexColor(getattr(self.c, c2))],
                              extend=True)
        cv.restoreState()

    # ------------------------------------------------------------ przepływ stron

    def _make_columns(self) -> None:
        banner_h = 88.0 if getattr(self.layout, "has_banner", False) else 0.0
        content_top = PAGE_H - (banner_h + 20.0 if banner_h else self.ly.top_margin)
        content_bottom = self.ly.bottom_margin + (26.0 if getattr(self.p, "clause", "") else 0.0)

        if self.layout.kind == "sidebar":
            sw = PAGE_W * self.layout.sidebar_ratio
            pos = getattr(self.layout, "sidebar_pos", "left")
            if pos == "right":
                main_w = PAGE_W - sw - self.ly.gutter - self.ly.page_margin - self.ly.sidebar_pad
                main = Column(x=self.ly.page_margin, width=main_w,
                              top=content_top, bottom=content_bottom, y=content_top)
                sx = self.ly.page_margin + main_w + self.ly.gutter
                side = Column(x=sx, width=PAGE_W - sx - self.ly.page_margin,
                              top=content_top, bottom=content_bottom, y=content_top)
            else:
                side = Column(x=self.ly.sidebar_pad, width=sw - 2 * self.ly.sidebar_pad,
                              top=content_top, bottom=content_bottom, y=content_top)
                cx = sw + self.ly.gutter
                main = Column(x=cx, width=PAGE_W - cx - self.ly.page_margin,
                              top=content_top, bottom=content_bottom, y=content_top)
            self.columns = {"side": side, "main": main}
        else:
            x = self.ly.page_margin
            main = Column(x=x, width=PAGE_W - 2 * self.ly.page_margin,
                          top=content_top, bottom=content_bottom, y=content_top)
            self.columns = {"side": None, "main": main}

    def _new_page(self) -> None:
        if getattr(self, "_started", False):
            self.canv.showPage()
        self._started = True
        self.page_no = self.canv.getPageNumber()
        self._page_grad()
        banner_h = 88.0 if getattr(self.layout, "has_banner", False) else 0.0
        top_cut = PAGE_H - banner_h - 10 if (banner_h and self.page_no == 1) else PAGE_H

        if self.columns["side"] is not None:
            sw = PAGE_W * self.layout.sidebar_ratio
            pos = getattr(self.layout, "sidebar_pos", "left")
            if pos == "right":
                sx = PAGE_W - sw
                self.canv.setFillColor(HexColor(self.c.sidebar_bg))
                self.canv.rect(sx, 0, sw, top_cut, stroke=0, fill=1)
                self._grad_rect(sx, 0, 3, top_cut, "accent", "accent_alt")
                self.accent_area += 3 * top_cut
            else:
                self.canv.setFillColor(HexColor(self.c.sidebar_bg))
                self.canv.rect(0, 0, sw, top_cut, stroke=0, fill=1)
                self._grad_rect(sw - 3, 0, 3, top_cut, "accent", "accent_alt")
                self.accent_area += 3 * top_cut
        else:
            if not banner_h or self.page_no > 1:
                self._grad_rect(0, PAGE_H - 5.5, PAGE_W, 5.5, "accent", "accent_alt",
                                diag=False)
                self.accent_area += 5.5 * PAGE_W

        if banner_h and self.page_no == 1:
            bg_col = self.c.sidebar_bg if self.t.sidebar_style == "dark" else self.c.accent_soft
            self.canv.setFillColor(HexColor(bg_col))
            self.canv.rect(0, PAGE_H - banner_h - 10, PAGE_W, banner_h + 10, stroke=0, fill=1)
            self._grad_rect(0, PAGE_H - banner_h - 12, PAGE_W, 2.5, "accent", "accent_alt", diag=False)
            self.accent_area += 2.5 * PAGE_W

        for col in self.columns.values():
            if col is not None:
                col.y = col.top

    def _ensure(self, col: Column, h: float) -> None:
        if col.y - h < col.bottom:
            self.warnings.append(f"zawijanie strony przy bloku h={h:.0f}pt")
            self._new_page()

    # ------------------------------------------------------------ komponenty

    def _section_header(self, col: Column, label: str, group: str) -> None:
        self._ensure(col, 28)
        size = self.t.typography.h2_size
        y = col.y - size
        self._fill("accent")
        self.canv.rect(col.x, y + 2.2, 13, 2.6, stroke=0, fill=1)
        self.accent_area += 13 * 2.6
        self.w.begin("H2", group, actual_text=label, visible_text=label)
        self._text(col.x + 19, y, label.upper(), self.t.typography.sans_bold,
                   size, color="text_primary", char_space=1.5)
        self.w.end()
        col.y = y - 9

    def _para(self, col: Column, text: str, *, font: str, size: float, leading: float,
              color: str, struct: str = "P", group: str, actual: str = "",
              width: float | None = None) -> float:
        w = width or col.width
        lines = wrap_text(text, font, size, w)
        h = len(lines) * leading
        self._ensure(col, h)
        self.w.begin(struct, group, actual_text=actual or text,
                     visible_text=" ".join(lines))
        for ln in lines:
            self._text(col.x, col.y - size, ln, font, size, color=color)
            col.y -= leading
        self.w.end()
        return col.y

    def _pill(self, x: float, y: float, label: str, semantic: str, group: str) -> float:
        """Pigułka [ SQL ]: etykieta dla oka, ActualText dla parsera. Zwraca szerokość."""
        tp = self.t.typography
        w = text_width(label, tp.sans_semibold, tp.pill_size) + 14
        h = 15.5
        self.w.begin("Span", group, actual_text=semantic, visible_text=label)
        self.canv.setFillColor(HexColor(self.c.accent_soft))
        self.canv.setStrokeColor(HexColor(self.c.accent_border))
        self.canv.setLineWidth(0.8)
        self.canv.roundRect(x, y - h, w, h, h / 2, stroke=1, fill=1)
        self.soft_area += w * h
        self._text(x + 7, y - h + 4.6, label, tp.sans_semibold, tp.pill_size,
                   color="accent")
        self.w.end()
        return w

    def _pills_flow(self, col: Column, skills, group: str) -> None:
        tp = self.t.typography
        h, gap = 15.5, 5.5
        x, y = col.x, col.y
        for s in skills:
            w = text_width(s.label, tp.sans_semibold, tp.pill_size) + 14
            if x + w > col.x + col.width:
                x = col.x
                y -= h + gap
            if y - h < col.bottom:
                self.warnings.append("zawijanie strony w pigułkach")
                self._new_page()
                x, y = col.x, col.top
            self._pill(x, y, s.label, s.semantic, group)
            x += w + gap
        col.y = y - h - 6

    def _side_value_color(self) -> str:
        return "sidebar_text" if self.t.sidebar_style == "dark" else "text_primary"

    def _side_muted_color(self) -> str:
        return "sidebar_muted"

    def _avatar(self, col: Column) -> None:
        mode = self.avatar_mode
        if mode == "none":
            return
        size = AVATAR_MM / 25.4 * 72  # 42 mm -> pt
        cx = col.x + col.width / 2
        cy = col.top - size / 2 - 2
        r = size / 2
        self.w.begin("Figure", "sidebar.avatar", actual_text=self.p.name,
                     visible_text=self.p.initials)
        cv = self.canv
        drew_photo = False
        if self.p.photo:
            try:
                cv.saveState()
                p = cv.beginPath()
                if mode == "circle":
                    p.circle(cx, cy, r)
                else:
                    p.rect(cx - r, cy - r, size, size)
                cv.clipPath(p, stroke=0, fill=0)
                cv.drawImage(self.p.photo, cx - r, cy - r, size, size,
                             preserveAspectRatio=True, mask="auto")
                cv.restoreState()
                drew_photo = True
            except Exception as e:  # noqa: BLE001
                self.warnings.append(f"Nie udało się wstawić zdjęcia ({e}); użyto inicjałów.")
        if not drew_photo:
            cv.saveState()
            p = cv.beginPath()
            if mode == "circle":
                p.circle(cx, cy, r)
            else:
                p.roundRect(cx - r, cy - r, size, size, 6)
            cv.clipPath(p, stroke=0, fill=0)
            cv.linearGradient(cx - r, cy + r, cx + r, cy - r,
                              [HexColor(self.c.accent), HexColor(self.c.accent_alt)],
                              extend=True)
            cv.restoreState()
            self.accent_area += math.pi * r * r if mode == "circle" else size * size
            initials = self.p.initials or " ".join(
                w[0] for w in self.p.name.split()[:2]).upper()
            fs = 30
            self._text(cx - text_width(initials, self.t.typography.serif_bold, fs) / 2,
                       cy - fs * 0.36, initials, self.t.typography.serif_bold, fs,
                       color="on_accent")
        self.w.end()
        col.y = cy - r - 26

    def _contact_block(self, col: Column) -> None:
        self._section_header(col, "Kontakt", "sidebar.contact")
        for label, value in self.p.contact.pairs():
            self._ensure(col, 26)
            self._text(col.x, col.y - 6.8, label.upper(), self.t.typography.sans,
                       6.8, color=self._side_muted_color(), char_space=1.1)
            col.y -= 10.2
            self._para(col, value, font=self.t.typography.sans, size=8.8,
                       leading=11.2, color=self._side_value_color(),
                       group="sidebar.contact",
                       actual=f"{label.capitalize()}: {value}")
            col.y -= 4.5

    def _sidebar_skills(self, col: Column) -> None:
        self._section_header(col, "Kompetencje", "sidebar.skills")
        self._pills_flow(col, self.p.skills, "sidebar.skills")

    def _certs_block(self, col: Column) -> None:
        if not self.p.certifications:
            return
        self._section_header(col, "Uprawnienia i certyfikaty", "sidebar.certs")
        tp = self.t.typography
        for cert in self.p.certifications:
            lines = wrap_text(cert.name, tp.sans_semibold, 8.8, col.width)
            sub = " · ".join(x for x in (cert.issuer, cert.year) if x)
            h = len(lines) * 11.4 + (10 if sub else 0) + 5
            self._ensure(col, h)
            self.w.begin("P", "sidebar.certs", actual_text=cert.semantic,
                         visible_text=cert.name)
            for ln in lines:
                self._text(col.x, col.y - 8.8, ln, tp.sans_semibold, 8.8,
                           color=self._side_value_color())
                col.y -= 11.4
            if sub:
                self._text(col.x, col.y - 7.4, sub, tp.sans, 7.4,
                           color=self._side_muted_color())
                col.y -= 10
            self.w.end()
            col.y -= 5

    def _langs_block(self, col: Column) -> None:
        if not self.p.languages:
            return
        self._section_header(col, "Języki", "sidebar.languages")
        tp = self.t.typography
        for lang in self.p.languages:
            self._ensure(col, 16)
            self.w.begin("P", "sidebar.languages",
                         actual_text=f"Język {lang.name}: poziom {lang.level}".strip(" :"),
                         visible_text=f"{lang.name} {lang.level}".strip())
            self._text(col.x, col.y - 9, lang.name.capitalize(), tp.sans, 8.8,
                       color=self._side_value_color())
            if lang.level:
                lw = text_width(lang.level, tp.sans_semibold, 8.8)
                self._text(col.x + col.width - lw, col.y - 9, lang.level,
                           tp.sans_semibold, 8.8, color="accent")
            self.w.end()
            col.y -= 15.5

    def _header_block(self, col: Column) -> None:
        tp = self.t.typography
        # H1: imię i nazwisko; ActualText łączy imię z tytułem dla parsera
        self.w.begin("H1", "header", actual_text=f"{self.p.name} — {self.p.title}",
                     visible_text=self.p.name)
        self._text(col.x, col.y - tp.name_size, self.p.name, tp.serif_bold,
                   tp.name_size, color="text_primary")
        self.w.end()
        col.y -= tp.name_size + 7
        # tytuł zawodowy: wersaliki, rozstrzelony, akcent
        self.w.begin("P", "header", actual_text=self.p.title, visible_text=self.p.title)
        self._text(col.x, col.y - tp.title_size, self.p.title.upper(),
                   tp.sans_semibold, tp.title_size, color="accent", char_space=1.6)
        self.w.end()
        col.y -= tp.title_size + 9
        # linia z segmentem akcentu
        self._stroke("hairline")
        self.canv.setLineWidth(0.8)
        self.canv.line(col.x, col.y, col.x + col.width, col.y)
        self._fill("accent")
        self.canv.rect(col.x, col.y - 2.0, 46, 2.2, stroke=0, fill=1)
        self.accent_area += 46 * 2.2
        col.y -= 18

    def _summary_block(self, col: Column) -> None:
        self._section_header(col, "Profil", "content.summary")
        self._para(col, self.p.summary.display, font=self.t.typography.sans,
                   size=9.6, leading=14.2, color="text_primary",
                   group="content.summary", actual=self.p.summary.semantic)

    def _exp_block(self, col: Column) -> None:
        if not self.p.experience:
            return
        self._section_header(col, "Doświadczenie", "content.exp")
        tp = self.t.typography
        for exp in self.p.experience:
            head_h = 14 + 12 + 8
            self._ensure(col, head_h + 30)
            actual = f"{exp.role} — {exp.company} ({exp.period}" + \
                     (f", {exp.location}" if exp.location else "") + ")"
            # rola (H3) + daty w jednym marked sequence
            self.w.begin("H3", "content.exp", actual_text=actual,
                         visible_text=exp.role)
            self._text(col.x, col.y - 11, exp.role, tp.sans_bold, 10.8,
                       color="text_primary")
            dw = text_width(exp.period, tp.sans, 8.4)
            self._text(col.x + col.width - dw, col.y - 9.4, exp.period, tp.sans, 8.4,
                       color="text_secondary")
            self.w.end()
            col.y -= 14
            # firma (kursywa, akcent) + lokalizacja
            self.w.begin("P", "content.exp",
                         actual_text=f"Firma: {exp.company}" +
                                     (f", lokalizacja: {exp.location}" if exp.location else ""),
                         visible_text=exp.company)
            self._text(col.x, col.y - 10.4, exp.company, tp.serif_italic, 10.4,
                       color="accent")
            if exp.location:
                self._text(col.x + text_width(exp.company, tp.serif_italic, 10.4) + 6,
                           col.y - 9.6, f"· {exp.location}", tp.sans, 8.4,
                           color="text_secondary")
            self.w.end()
            col.y -= 12
            self._stroke("hairline")
            self.canv.setLineWidth(0.6)
            self.canv.line(col.x, col.y, col.x + col.width, col.y)
            col.y -= 8
            # punkty: kropka akcentu + tekst (LI + ActualText)
            for b in exp.bullets:
                lines = wrap_text(b.display, tp.sans, 9.6, col.width - 12)
                self._ensure(col, len(lines) * 13.6 + 4)
                self.w.begin("LI", "content.exp", actual_text=b.semantic,
                             visible_text=b.display)
                self._fill("accent")
                self.canv.circle(col.x + 2.2, col.y - 6.6, 1.9, stroke=0, fill=1)
                self.accent_area += math.pi * 1.9 * 1.9
                for ln in lines:
                    self._text(col.x + 12, col.y - 9.6, ln, tp.sans, 9.6,
                               color="text_primary")
                    col.y -= 13.6
                self.w.end()
                col.y -= 4.5
            col.y -= 8

    def _edu_block(self, col: Column) -> None:
        if not self.p.education:
            return
        self._section_header(col, "Wykształcenie", "content.edu")
        tp = self.t.typography
        for ed in self.p.education:
            period = " – ".join(x for x in (ed.start, ed.end) if x)
            actual = f"{ed.degree} — {ed.school}" + (f" ({period})" if period else "")
            self._ensure(col, 30 + (14 if ed.note else 0))
            self.w.begin("P", "content.edu", actual_text=actual,
                         visible_text=ed.degree)
            self._text(col.x, col.y - 9.8, ed.degree, tp.sans_semibold, 9.8,
                       color="text_primary")
            if period:
                pw = text_width(period, tp.sans, 8.4)
                self._text(col.x + col.width - pw, col.y - 9.2, period, tp.sans, 8.4,
                           color="text_secondary")
            self.w.end()
            col.y -= 13
            self.w.begin("P", "content.edu", actual_text=f"Uczelnia/szkoła: {ed.school}",
                         visible_text=ed.school)
            self._text(col.x, col.y - 9.4, ed.school, tp.serif_italic, 9.6,
                       color="text_secondary")
            self.w.end()
            col.y -= 12.5
            if ed.note:
                self._para(col, ed.note, font=tp.sans, size=8.4, leading=11.4,
                           color="text_secondary", group="content.edu")
            col.y -= 6

    def _footer(self) -> None:
        tp = self.t.typography
        fx = self.ly.page_margin
        fw = PAGE_W - 2 * self.ly.page_margin
        has_rodo = bool(getattr(self.p, "clause", ""))
        y = self.ly.bottom_margin - (4 if has_rodo else 14)
        self._stroke("hairline")
        self.canv.setLineWidth(0.5)
        self.canv.line(fx, y + 8, fx + fw, y + 8)
        stamp = f"MasterVault CV Engine · {_dt.date.today().isoformat()}"
        self._text(fx, y, stamp, tp.sans, 6.8, color="text_secondary")
        if self.page_no > 1:
            lbl = str(self.page_no)
            lw = text_width(lbl, tp.sans, 6.8)
            self._text(fx + fw - lw, y, lbl, tp.sans, 6.8,
                       color="text_secondary")
        if has_rodo:
            rodo_lines = wrap_text(self.p.clause, tp.sans, 5.8, fw)
            ry = y - 8
            self.w.begin("P", "footer.rodo", actual_text=self.p.clause, visible_text=self.p.clause)
            for rln in rodo_lines:
                self._text(fx, ry, rln, tp.sans, 5.8, color="text_secondary")
                ry -= 7.0
            self.w.end()

    def _contact_inline(self, col: Column) -> None:
        tp = self.t.typography
        parts = [v for _, v in self.p.contact.pairs()]
        sep = "   ·   "
        line = sep.join(parts)
        size = 8.6
        while text_width(line, tp.sans, size) > col.width and size > 7.4:
            size -= 0.2
        if text_width(line, tp.sans, size) > col.width:
            line = sep.join(parts[:3])
        self.w.begin("P", "header",
                     actual_text="; ".join(f"{l.capitalize()}: {v}"
                                           for l, v in self.p.contact.pairs()),
                     visible_text=line)
        y = col.y - 9
        self._text(col.x, y, line, tp.sans, size, color="text_secondary")
        self.w.end()
        col.y = y - 14

    def _banner_header(self) -> None:
        tp = self.t.typography
        pad = self.ly.page_margin
        by = PAGE_H - 18
        text_x = pad
        if self.avatar_mode != "none":
            av_size = 52.0
            ax = pad
            ay = by - av_size / 2 - 8
            r = av_size / 2
            self.w.begin("Figure", "header.avatar", actual_text=self.p.name,
                         visible_text=self.p.initials)
            cv = self.canv
            cv.saveState()
            p = cv.beginPath()
            if self.avatar_mode == "circle":
                p.circle(ax + r, ay, r)
            else:
                p.roundRect(ax, ay - r, av_size, av_size, 6)
            cv.clipPath(p, stroke=0, fill=0)
            cv.linearGradient(ax, ay + r, ax + av_size, ay - r,
                              [HexColor(self.c.accent), HexColor(self.c.accent_alt)],
                              extend=True)
            cv.restoreState()
            self.accent_area += math.pi * r * r if self.avatar_mode == "circle" else av_size * av_size
            initials = self.p.initials or " ".join(w[0] for w in self.p.name.split()[:2]).upper()
            fs = 20
            self._text(ax + r - text_width(initials, tp.serif_bold, fs) / 2,
                       ay - fs * 0.36, initials, tp.serif_bold, fs, color="on_accent")
            self.w.end()
            text_x = pad + av_size + 16

        name_color = "sidebar_text" if self.t.sidebar_style == "dark" else "text_primary"
        self.w.begin("H1", "header", actual_text=f"{self.p.name} — {self.p.title}",
                     visible_text=self.p.name)
        self._text(text_x, by - tp.name_size, self.p.name, tp.serif_bold,
                   tp.name_size, color=name_color)
        self.w.end()
        by -= tp.name_size + 6

        self.w.begin("P", "header", actual_text=self.p.title, visible_text=self.p.title)
        self._text(text_x, by - tp.title_size, self.p.title.upper(),
                   tp.sans_semibold, tp.title_size, color="accent", char_space=1.4)
        self.w.end()
        by -= tp.title_size + 8

        parts = [v for _, v in self.p.contact.pairs()]
        line = "   ·   ".join(parts)
        c_size = 8.2
        avail_w = PAGE_W - pad - text_x
        while text_width(line, tp.sans, c_size) > avail_w and c_size > 7.0:
            c_size -= 0.2
        self.w.begin("P", "header",
                     actual_text="; ".join(f"{l.capitalize()}: {v}"
                                           for l, v in self.p.contact.pairs()),
                     visible_text=line)
        c_color = "sidebar_muted" if self.t.sidebar_style == "dark" else "text_secondary"
        self._text(text_x, by - c_size, line, tp.sans, c_size, color=c_color)
        self.w.end()

    def _render_sidebar(self, side: Column) -> None:
        if not getattr(self.layout, "has_banner", False):
            self._avatar(side)
            self._contact_block(side)
        self._sidebar_skills(side)
        self._certs_block(side)
        self._langs_block(side)

    def _render_main(self, main: Column) -> None:
        if not getattr(self.layout, "has_banner", False):
            self._header_block(main)
            if self.columns["side"] is None:
                self._contact_inline(main)
        self._summary_block(main)
        self._exp_block(main)
        if self.columns["side"] is None:
            self._sidebar_skills(main)
        self._edu_block(main)
        if self.columns["side"] is None:
            self._certs_block(main)
            self._langs_block(main)

    # ------------------------------------------------------------ orkiestracja

    def render(self) -> RenderResult:
        from .fonts import register_fonts

        register_fonts()
        self.canv = rl_canvas.Canvas(
            self._buf, pagesize=(PAGE_W, PAGE_H), pageCompression=1,
            title=f"CV — {self.p.name}", author=self.p.name, subject=self.p.title,
            creator="MasterVault CV Engine (mvcv)",
        )
        self.w = MarkedWriter(self.canv, self.sem)
        self.page_no = 1
        self._make_columns()
        self._new_page()

        main, side = self.columns["main"], self.columns["side"]
        if getattr(self.layout, "has_banner", False):
            self._banner_header()
        if side is not None:
            self._render_sidebar(side)
        self._render_main(main)

        self._footer()
        self.canv.showPage()
        self.canv.save()
        return RenderResult(sem=self.sem, pages=self.page_no, warnings=self.warnings,
                            accent_area_pt2=self.accent_area,
                            soft_accent_area_pt2=self.soft_area)

    def pdf_bytes(self) -> bytes:
        return self._buf.getvalue()

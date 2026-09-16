"""Pipeline eksportu: MasterVault -> governance -> render -> warstwa semantyczna.

    ResumeData  ->  Layout Preset  ->  Visual Theme  ->  Dual-Layer PDF
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pikepdf

from .data.model import MasterProfile, load_profile
from .design.layouts import LayoutPreset, get_layout
from .design.tokens import ResumeTheme, get_theme
from .governance import GovernanceReport, apply as govern
from .pdfsem.metadata import build_jsonld, inject_metadata
from .pdfsem.structtree import build as build_structure
from .render.renderer import PAGE_W, Renderer


@dataclass
class ExportReport:
    out_path: str
    pages: int
    theme: str
    layout: str
    avatar: str
    actual_text_count: int
    semantic_pairs: int
    accent_coverage_pct: float
    soft_accent_coverage_pct: float
    warnings: list[str] = field(default_factory=list)
    governance: GovernanceReport | None = None
    jsonld: dict | None = None

    def describe(self) -> str:
        g = self.governance
        rows = [
            f"PDF: {self.out_path}",
            f"strony: {self.pages} | motyw: {self.theme} | layout: {self.layout} | zdjecie: {self.avatar}",
            f"elementy /ActualText: {self.actual_text_count} (par wizualna <-> semantyczna: {self.semantic_pairs})",
            f"pokrycie akcentem: {self.accent_coverage_pct:.1f}% (+ pigulki tint {self.soft_accent_coverage_pct:.1f}%) - limit ~15-25%",
        ]
        if g is not None:
            rows.append("governance:")
            rows.append("  " + g.describe().replace("\n", "\n  "))
        if self.warnings:
            rows.append("ostrzezenia: " + "; ".join(self.warnings))
        return "\n".join(rows)


def main_column_width(layout: LayoutPreset) -> float:
    if layout.kind == "sidebar":
        sw = PAGE_W * layout.sidebar_ratio
        return PAGE_W - (sw + 26) - 46
    return PAGE_W - 2 * 46


def export(profile_path: str, out_path: str, *, layout: str = "sidebar",
           theme: str = "parchment", avatar: str | None = None,
           target_pages: int = 1, sidecar: bool = True) -> ExportReport:
    ly: LayoutPreset = get_layout(layout)
    th: ResumeTheme = get_theme(theme)

    profile: MasterProfile = load_profile(profile_path)

    from .render.fonts import register_fonts

    register_fonts()

    def measure(text: str, font: str, size: float) -> float:
        from reportlab.pdfbase.pdfmetrics import stringWidth

        from .render.fonts import alias_for

        return stringWidth(text, alias_for(font), size)

    resolved, gov = govern(profile, content_width=main_column_width(ly), measure=measure,
                           target_pages=target_pages)

    # Pass 1: standardowy render
    r = Renderer(resolved, th, ly, avatar=avatar or resolved.avatar, density="normal")
    result = r.render()

    # Inteligentny Auto-Balancing A4: eliminacja stron-sierot i gwarancja dopasowania do 1 strony
    if target_pages == 1 and result.pages > 1:
        # Pass 2: kompresja wertykalna (mikro-spacing) bez usuwania żadnej treści
        r_compact = Renderer(resolved, th, ly, avatar=avatar or resolved.avatar, density="compact")
        res_compact = r_compact.render()
        if res_compact.pages == 1:
            r = r_compact
            result = res_compact
            gov.notes.append("Auto-Balancing A4: dopasowano idealnie do 1 strony przez kompresję wertykalną.")
        else:
            # Pass 3: adaptacyjny governance pod 1 stronę (selekcja najważniejszych osiągnięć)
            resolved_agg, gov_agg = govern(profile, content_width=main_column_width(ly), measure=measure,
                                           target_pages=1, aggressive_fit=True)
            r_agg = Renderer(resolved_agg, th, ly, avatar=avatar or resolved_agg.avatar, density="compact")
            res_agg = r_agg.render()
            if res_agg.pages == 1:
                r, result, resolved, gov = r_agg, res_agg, resolved_agg, gov_agg
                gov.notes.append("Auto-Balancing A4: zbalansowano treść do dokładnie 1 strony A4.")
            else:
                # Pass 4: tryb ultra-compact dla pewności dopasowania
                r_ultra = Renderer(resolved_agg, th, ly, avatar=avatar or resolved_agg.avatar, density="ultra_compact")
                res_ultra = r_ultra.render()
                if res_ultra.pages <= 1 or res_ultra.pages < result.pages:
                    r, result, resolved, gov = r_ultra, res_ultra, resolved_agg, gov_agg
                    gov.notes.append("Auto-Balancing A4: zastosowano tryb ultra-compact.")

    import io

    pdf = pikepdf.open(io.BytesIO(r.pdf_bytes()))
    build_structure(pdf, result.sem)
    title = f"CV — {resolved.name}"
    jsonld = inject_metadata(pdf, resolved, title=title, attach_master_json=True)
    pdf.save(out_path)
    pdf.close()

    if sidecar:
        import json
        import os

        sc = os.path.splitext(out_path)[0] + ".semantic.json"
        payload = {
            "out": out_path,
            "pages": result.pages,
            "theme": th.name,
            "layout": ly.name,
            "accent_coverage_pct": result.accent_coverage_pct,
            "soft_accent_coverage_pct": result.soft_accent_coverage_pct,
            "governance": {
                "summary_lines": gov.summary_lines,
                "skills_kept": gov.skills_kept,
                "exp_kept": gov.exp_kept,
                "bullets_kept": gov.bullets_kept,
                "notes": gov.notes,
            },
            "visible_to_semantic": [
                {"page": n.page, "struct": n.struct, "group": n.group,
                 "visible": n.visible_text, "semantic": n.actual_text}
                for n in result.sem.nodes if n.actual_text
            ],
            "jsonld": jsonld,
        }
        with open(sc, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    pairs = sum(1 for n in result.sem.nodes
                if n.actual_text and n.actual_text != n.visible_text)
    rep = ExportReport(
        out_path=out_path, pages=result.pages, theme=th.name, layout=ly.name,
        avatar=r.avatar_mode,
        actual_text_count=sum(1 for n in result.sem.nodes if n.actual_text),
        semantic_pairs=pairs,
        accent_coverage_pct=result.accent_coverage_pct,
        soft_accent_coverage_pct=result.soft_accent_coverage_pct,
        warnings=result.warnings, governance=gov, jsonld=jsonld,
    )
    if result.pages > 2:
        rep.warnings.append(f"Wygenerowano {result.pages} strony — governance nie zdołał zmieścić treści.")
    return rep

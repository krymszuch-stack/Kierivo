"""CLI: python -m mvcv <export|verify|themes|layouts|gallery>"""

from __future__ import annotations

import argparse
import os
import sys

from .design.layouts import LAYOUTS
from .design.tokens import THEMES


def cmd_export(args: argparse.Namespace) -> int:
    from .pipeline import export

    rep = export(args.profile, args.out, layout=args.layout, theme=args.theme,
                 avatar=args.avatar, target_pages=args.target_pages,
                 sidecar=not args.no_sidecar)
    print(rep.describe())
    return 0


def cmd_gallery(args: argparse.Namespace) -> int:
    """Eksportuj profil we wszystkich zarejestrowanych motywach do podanego folderu."""
    from .pipeline import export

    os.makedirs(args.out_dir, exist_ok=True)
    count = 0
    print(f"Generowanie galerii {len(THEMES)} motywow do: {args.out_dir}...")
    for name, th in sorted(THEMES.items()):
        ly_name = "single" if th.layout.kind == "single" else ("sidebar-wide" if th.layout.sidebar_ratio > 0.35 else "sidebar")
        out_pdf = os.path.join(args.out_dir, f"cv_{name}.pdf")
        try:
            rep = export(args.profile, out_pdf, layout=ly_name, theme=name,
                         avatar=args.avatar, target_pages=args.target_pages, sidecar=True)
            print(f"  [OK] {name:14s} -> {out_pdf} (strony: {rep.pages}, akcent: {rep.accent_coverage_pct:.1f}%)")
            count += 1
        except Exception as err:
            print(f"  [BLAD] {name:14s} -> {err}")
    print(f"\nUkonczono pomyslnie: {count}/{len(THEMES)} plikow PDF.")
    return 0


def cmd_themes(_args: argparse.Namespace) -> int:
    print(f"Dostepne motywy ({len(THEMES)}):")
    print("-" * 68)
    print(f"{'Nazwa':14s} {'Sidebar':8s} {'Avatar':8s} {'Akcent':10s} {'Tlo':10s} {'Kroj'}")
    print("-" * 68)
    for t in sorted(THEMES.values(), key=lambda x: x.name):
        font = "Serif" if "Georgia" in t.typography.serif else "Sans"
        print(f"{t.name:14s} {t.sidebar_style:8s} {t.avatar:8s} "
              f"{t.colors.accent:10s} {t.colors.bg_main:10s} {font}")
    return 0


def cmd_layouts(_args: argparse.Namespace) -> int:
    print(f"Dostepne uklady ({len(LAYOUTS)}):")
    print("-" * 68)
    for l in sorted(LAYOUTS.values(), key=lambda x: x.name):
        cols = "1 kolumna (ATS)" if l.kind == "single" else f"{int(l.sidebar_ratio*100)}% / {100-int(l.sidebar_ratio*100)}% ({l.sidebar_pos})"
        banner = " [banner]" if l.has_banner else ""
        print(f"{l.name:16s} {cols}{banner}")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    from .tools.verify import verify_pdf

    return verify_pdf(args.pdf, strict=not args.lenient)


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="mvcv",
        description="MasterVault CV Engine - dwuwarstwowy PDF (wizualny + semantyczny).",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("export", help="generuj CV z profilu MasterVault")
    e.add_argument("profile", help="sciezka do profilu MasterVault (JSON)")
    e.add_argument("-o", "--out", required=True, help="sciezka wynikowego PDF")
    e.add_argument("--layout", default="sidebar", choices=list(LAYOUTS))
    e.add_argument("--theme", default="parchment", choices=list(THEMES))
    e.add_argument("--target-pages", type=int, default=1, choices=[1, 2],
                   help="docelowa liczba stron (domyslnie 1)")
    e.add_argument("--avatar", choices=["circle", "square", "none"], default=None,
                   help="nadpisz modul zdjecia")
    e.add_argument("--no-sidecar", action="store_true",
                   help="nie zapisuj pliku *.semantic.json")
    e.set_defaults(fn=cmd_export)

    g = sub.add_parser("gallery", help="generuj kolekcje CV we wszystkich motywach")
    g.add_argument("profile", help="sciezka do profilu MasterVault (JSON)")
    g.add_argument("-o", "--out-dir", default="build/gallery", help="katalog wyjsciowy")
    g.add_argument("--target-pages", type=int, default=1, choices=[1, 2])
    g.add_argument("--avatar", choices=["circle", "square", "none"], default=None)
    g.set_defaults(fn=cmd_gallery)

    v = sub.add_parser("verify", help="weryfikuj dwuwarstwowosc PDF")
    v.add_argument("pdf", help="sciezka do PDF")
    v.add_argument("--lenient", action="store_true", help="tylko raport, bez bledow wyjscia")
    v.set_defaults(fn=cmd_verify)

    sub.add_parser("themes", help="lista motywow").set_defaults(fn=cmd_themes)
    sub.add_parser("layouts", help="lista ukladow").set_defaults(fn=cmd_layouts)
    return ap


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    args = build_parser().parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())

"""Weryfikacja dwuwarstwowości PDF.

Sprawdza i raportuje obie warstwy:

* WARSTWA WIZUALNA (rekruter / Ctrl+A): ekstrakcja tekstu z treści stron
  (pdfminer.six). Musi zawierać pigułki (np. ``SQL``) i NIE może zawierać
  sementyki z /ActualText (dowód: zero podwójnego/niewidzialnego tekstu).
* WARSTWA SEMANTYCZNA (parser ATS): /ActualText w drzewie struktury,
  JSON-LD Schema.org/Person w /Metadata (XMP), załącznik mastervault.json,
  słownik /Info.

Ponadto kontrola anty-trikowa: brak trybu renderowania 3 (niewidzialny tekst)
w strumieniach treści.
"""

from __future__ import annotations

import json
import sys

import pikepdf


# ------------------------------------------------------------------ pomocnicze

def _walk_struct(elem, out: list[dict]) -> None:
    if isinstance(elem, pikepdf.Dictionary):
        s = str(elem.get("/S", ""))
        if "/ActualText" in elem:
            out.append({"struct": s, "actual": str(elem.ActualText)})
        k = elem.get("/K")
        if isinstance(k, pikepdf.Array):
            for kid in k:
                _walk_struct(kid, out)
    elif isinstance(elem, pikepdf.Array):
        for kid in elem:
            _walk_struct(kid, out)


def actual_text_entries(pdf: pikepdf.Pdf) -> list[dict]:
    root = pdf.Root.get("/StructTreeRoot")
    out: list[dict] = []
    if root is not None:
        _walk_struct(root.K, out)
    return out


def visible_text(pdf: pikepdf.Pdf) -> str:
    from io import BytesIO

    from pdfminer.high_level import extract_text

    buf = BytesIO()
    pdf.save(buf)
    buf.seek(0)
    return extract_text(buf)


def jsonld_from_xmp(pdf: pikepdf.Pdf) -> dict | None:
    meta = pdf.Root.get("/Metadata")
    if meta is None:
        return None
    xmp = meta.read_bytes().decode("utf-8", errors="replace")
    start = xmp.find("<mv:jsonLd>")
    if start == -1:
        return None
    start += len("<mv:jsonLd>")
    end = xmp.find("</mv:jsonLd>", start)
    raw = xmp[start:end]
    if raw.startswith("<![CDATA["):
        raw = raw[9:-3]
    return json.loads(raw)


def has_invisible_text(pdf: pikepdf.Pdf) -> bool:
    """Czy którykolwiek strumień treści ustawia tryb renderowania 3 (Tr)?"""
    for page in pdf.pages:
        for operands, op in pikepdf.parse_content_stream(page):
            if str(op) == "Tr" and operands and int(operands[0]) == 3:
                return True
    return False


def embedded_json(pdf: pikepdf.Pdf) -> dict | None:
    """Odczytaj załącznik mastervault.json (drzewo EmbeddedFiles)."""
    try:
        names = pdf.Root.Names.EmbeddedFiles.Names
    except (AttributeError, KeyError):
        return None
    for i in range(0, len(names), 2):
        if str(names[i]) == "mastervault.json":
            spec = names[i + 1]
            return json.loads(spec.EF.F.read_bytes().decode("utf-8"))
    return None


# ------------------------------------------------------------------ główna

def verify_pdf(path: str, *, strict: bool = True) -> int:
    problems: list[str] = []
    notes: list[str] = []

    pdf = pikepdf.open(path)
    cat = pdf.Root

    print("=" * 72)
    print("WERYFIKACJA DUAL-LAYER SEMANTIC PDF:", path)
    print("=" * 72)

    # --- struktura dokumentu
    ok_struct = "/StructTreeRoot" in cat
    ok_mark = bool(cat.get("/MarkInfo", {}).get("/Marked", False)) if "/MarkInfo" in cat else False
    ok_lang = "/Lang" in cat
    ok_title = bool(cat.get("/ViewerPreferences", {}).get("/DisplayDocTitle", False)) \
        if "/ViewerPreferences" in cat else False
    print(f"[{'OK' if ok_struct else 'BRAK'}] /StructTreeRoot (Tagged PDF)")
    print(f"[{'OK' if ok_mark else 'BRAK'}] /MarkInfo <</Marked true>>")
    print(f"[{'OK' if ok_lang else 'BRAK'}] /Lang = {cat.get('/Lang', '(brak)')}")
    print(f"[{'OK' if ok_title else 'BRAK'}] /ViewerPreferences /DisplayDocTitle")
    if not ok_struct:
        problems.append("brak /StructTreeRoot — PDF nieotagowany")
    if not ok_mark:
        problems.append("brak /MarkInfo /Marked")
    if not ok_lang:
        problems.append("brak /Lang")

    # --- warstwa 2a: ActualText
    entries = actual_text_entries(pdf)
    print(f"\nWARSTWA SEMANTYCZNA - /ActualText ({len(entries)} elementow):")
    for e in entries[:14]:
        short = e["actual"] if len(e["actual"]) <= 96 else e["actual"][:93] + "..."
        print(f"  /{e['struct']:7s} -> \"{short}\"")
    if len(entries) > 14:
        print(f"  ... i jeszcze {len(entries) - 14}")
    if not entries:
        problems.append("drzewo struktury nie zawiera /ActualText")

    # --- warstwa 1: widoczny tekst (rekruter / Ctrl+A)
    vis = visible_text(pdf)
    print("\nWARSTWA WIZUALNA - tekst widoczny (Ctrl+A / prosty ekstraktor):")
    lines = [l for l in vis.splitlines() if l.strip()]
    for l in lines[:24]:
        print(f"  | {l}")
    if len(lines) > 24:
        print(f"  ... (+{len(lines) - 24} linii)")

    # separacja warstw: pigułki widoczne, bogate zdania NIE widoczne
    sem_sentences = [e["actual"] for e in entries if len(e["actual"]) > 40]
    leaked = [s for s in sem_sentences if s in vis]
    if leaked:
        problems.append(f"sementyka wycieka do warstwy wizualnej: {leaked[:2]}")
    else:
        print("\n[OK] separacja: bogate zdania istnieja tylko w /ActualText, "
              "nie w tekscie widocznym")

    # --- anty-trik
    if has_invisible_text(pdf):
        problems.append("wykryto tryb renderowania 3 (niewidzialny tekst) - zakazany")
    else:
        print("[OK] brak niewidzialnego tekstu (Tr 3) w strumieniach tresci")

    # --- warstwa 2b: JSON-LD w XMP
    jl = jsonld_from_xmp(pdf)
    if jl:
        print("\nWARSTWA SEMANTYCZNA - JSON-LD (Schema.org/Person) z /Metadata (XMP):")
        print(f"  @type           : {jl.get('@type')}")
        print(f"  name            : {jl.get('name')}")
        print(f"  jobTitle        : {jl.get('jobTitle')}")
        print(f"  lata stazu (mv) : {jl.get('mv:yearsOfExperience')}")
        print(f"  knowsAbout      : {len(jl.get('knowsAbout', []))} kompetencji (pelne zdania)")
        print(f"  hasCredential   : {len(jl.get('hasCredential', []))} certyfikatow")
        print(f"  mv:licenses     : {', '.join(jl.get('mv:licenses', [])) or '(brak)'}")
        ka = jl.get("knowsAbout", [])
        if ka:
            print(f"  przyklad        : \"{ka[0][:90]}...\"" if len(ka[0]) > 90 else f"  przyklad        : \"{ka[0]}\"")
    else:
        problems.append("brak JSON-LD w strumieniu /Metadata")

    # --- warstwa 2c: załącznik
    emb = embedded_json(pdf)
    if emb:
        print("\n[OK] załącznik mastervault.json (round-trip MasterVault)")
    else:
        notes.append("brak załącznika mastervault.json")

    # --- Info dict
    info = pdf.trailer.get("/Info")
    if info:
        print(f"\n/Info: Title={info.get('/Title')} | Author={info.get('/Author')} | "
              f"Keywords={str(info.get('/Keywords'))[:60]}…")

    print("-" * 72)
    if problems:
        print(f"WYNIK: FAIL ({len(problems)})")
        for p in problems:
            print(f"  [X] {p}")
        return 1 if strict else 0
    print("WYNIK: PASS - dwuwarstwowy PDF poprawny")
    for n in notes:
        print(f"  [i] {n}")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    sys.exit(verify_pdf(sys.argv[1]))

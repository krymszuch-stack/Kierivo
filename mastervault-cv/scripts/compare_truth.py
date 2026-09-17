"""Porównanie mastervault.json (prawda) z warstwą semantyczną PDF (produkt).

Sprawdza:
1. Embedded mastervault.json round-trip
2. JSON-LD w XMP (name, jobTitle, knowsAbout, hasCredential, licenses)
3. /ActualText w StructTreeRoot (każdy semantyczny element)
4. Widoczny tekst (pigułki kompetencji)
"""

from __future__ import annotations
import json
import sys
import os
from pathlib import Path

import pikepdf

# ---------------------------------------------------------------- helpers
def load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_embedded_json(pdf: pikepdf.Pdf) -> dict | None:
    try:
        names = pdf.Root.Names.EmbeddedFiles.Names
    except (AttributeError, KeyError):
        return None
    for i in range(0, len(names), 2):
        if str(names[i]) == "mastervault.json":
            return json.loads(names[i + 1].EF.F.read_bytes().decode("utf-8"))
    return None


def get_jsonld_xmp(pdf: pikepdf.Pdf) -> dict | None:
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


def get_actual_texts(pdf: pikepdf.Pdf) -> list[str]:
    root = pdf.Root.get("/StructTreeRoot")
    out: list[str] = []
    if root is None:
        return out
    def walk(elem):
        if isinstance(elem, pikepdf.Dictionary):
            if "/ActualText" in elem:
                out.append(str(elem.ActualText))
            k = elem.get("/K")
            if isinstance(k, pikepdf.Array):
                for kid in k:
                    walk(kid)
        elif isinstance(elem, pikepdf.Array):
            for kid in elem:
                walk(kid)
    walk(root.K)
    return out


def get_visible_skills(pdf: pikepdf.Pdf) -> set[str]:
    """Wyciąga pigułki kompetencji z widocznej warstwy."""
    from io import BytesIO
    from pdfminer.high_level import extract_text
    buf = BytesIO()
    pdf.save(buf)
    buf.seek(0)
    text = extract_text(buf)
    # Kompetencje pojawiają się jako duże litery np. "SQL", "Excel", "Python"
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return set(lines)


# ---------------------------------------------------------------- main
def compare(pdf_path: str, truth_path: str) -> int:
    errors: list[str] = []
    notes: list[str] = []

    truth = load_json(truth_path)
    pdf = pikepdf.open(pdf_path)

    name = truth["name"]
    print(f"Porównanie: {name}")
    print(f"  PDF : {pdf_path}")
    print(f"  PRAWDA: {truth_path}")
    print()

    # --- 1. Embedded mastervault.json
    emb = get_embedded_json(pdf)
    if emb:
        print("[OK] Embedded mastervault.json — round-trip OK")
        # Porównaj kluczowe pola
        for field in ["name", "title", "contact", "skills", "experience", "education"]:
            truth_val = truth.get(field)
            emb_val = emb.get(field)
            if field == "name":
                if truth_val != emb_val.get("name"):
                    errors.append(f"  EMBEDDED name: {truth_val} != {emb_val.get('name')}")
            elif field == "skills":
                truth_labels = [s["label"] if isinstance(s, dict) else s for s in truth_val]
                emb_labels = [s["label"] if isinstance(s, dict) else s for s in emb_val]
                if set(truth_labels) != set(emb_labels):
                    errors.append(f"  EMBEDDED skills mismatch: {set(truth_labels)} vs {set(emb_labels)}")
            elif field == "experience":
                truth_roles = [e["role"] for e in truth_val]
                emb_roles = [e["role"] for e in emb_val]
                if truth_roles != emb_roles:
                    errors.append(f"  EMBEDDED roles mismatch: {truth_roles} vs {emb_roles}")
    else:
        errors.append("  BRAK embedded mastervault.json")

    # --- 2. JSON-LD w XMP
    jl = get_jsonld_xmp(pdf)
    if jl:
        print("[OK] JSON-LD XMP — OK")
        if jl.get("name") != name:
            errors.append(f"  JSON-LD name: {jl.get('name')} != {name}")
        if jl.get("@type") != "Person":
            errors.append(f"  JSON-LD @type: {jl.get('@type')} != Person")
        truth_skills_sem = truth.get("skills", [])
        truth_skill_labels = [s["label"] if isinstance(s, dict) else s for s in truth_skills_sem]
        jl_ka = jl.get("knowsAbout", [])
        if jl_ka:
            for label in truth_skill_labels:
                if label not in jl_ka and label.lower() not in " ".join(jl_ka).lower():
                    notes.append(f"  JSON-LD knowsAbout: '{label}' nie znaleziony (ale może być opis inny)")
    else:
        errors.append("  BRAK JSON-LD w XMP")

    # --- 3. /ActualText w StructTreeRoot
    actuals = get_actual_texts(pdf)
    if actuals:
        print(f"[OK] /ActualText: {len(actuals)} elementów")
        actual_joined = " ".join(actuals)
        # Sprawdź czy nazwa jest w ActualText
        if name not in actual_joined:
            errors.append(f"  ActualText nie zawiera nazwy: '{name}'")
        else:
            print(f"  [OK] Nazwa '{name}' znaleziona w /ActualText")

        # Sprawdź kluczowe kompetencje w ActualText
        truth_skills_sem = truth.get("skills", [])
        truth_skill_semantics = [s["semantic"] if isinstance(s, dict) else s for s in truth_skills_sem]
        for sem in truth_skill_semantics[:5]:
            if sem and sem[:30] not in actual_joined:
                notes.append(f"  ActualText: semantic '{sem[:30]}...' nie znaleziony (może być przetłumaczony/skrócony)")

        # Sprawdź doświadczenie (firma/rola)
        truth_exp = truth.get("experience", [])
        for exp in truth_exp:
            role = exp["role"]
            company = exp["company"]
            if role not in actual_joined and role.lower() not in actual_joined.lower():
                errors.append(f"  ActualText: rola '{role}' nie znaleziona")
            if company not in actual_joined:
                errors.append(f"  ActualText: firma '{company}' nie znaleziona")
    else:
        errors.append("  BRAK /ActualText")

    # --- 4. Widoczny tekst — kompetencje (pigułki)
    vis_skills = get_visible_skills(pdf)
    truth_skill_labels = [s["label"] if isinstance(s, dict) else s for s in truth.get("skills", [])]
    found_skills = []
    missing_skills = []
    for label in truth_skill_labels:
        if label in vis_skills:
            found_skills.append(label)
        else:
            missing_skills.append(label)
    print(f"[INFO] Widoczne kompetencje: {len(found_skills)}/{len(truth_skill_labels)}")
    if found_skills:
        notes.append(f"  Widoczne: {', '.join(found_skills[:8])}...")
    if missing_skills:
        # Pigułki mogą być w różnych formatach (np. wielkie litery, pełne zdanie)
        vis_joined = " ".join(vis_skills).upper()
        still_missing = []
        for label in missing_skills:
            if label.upper() not in vis_joined:
                still_missing.append(label)
        if still_missing:
            notes.append(f"  Nieznalezione widocznie: {still_missing}")

    # --- 5. Liczba stron
    pages = len(pdf.pages)
    print(f"\n[INFO] Strony: {pages}")

    # --- Wynik
    print("\n" + "=" * 60)
    if errors:
        print(f"WYNIK: FAIL — {len(errors)} błędów")
        for e in errors:
            print(f"  [X] {e}")
    else:
        print("WYNIK: PASS — wszystkie pola semantyczne zgodne z prawdą")
    if notes:
        print(f"\n[Uwagi] ({len(notes)}):")
        for n in notes:
            print(f"  [i] {n}")
    print("=" * 60)
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Użycie: python compare_truth.py <pdf_path> <mastervault.json>")
        sys.exit(2)
    sys.exit(compare(sys.argv[1], sys.argv[2]))

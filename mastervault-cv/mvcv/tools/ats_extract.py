"""
Ekstrakcja tekstu z PDF pod kątem walidacji ATS.

Rozszerza istniejące verify.py o specyficzną ekstrakcję dla walidacji
kompabtilności z różnymi systemami ATS.

Użycie:
  python -m mvcv.tools.ats_extract cv.pdf

Zwraca JSON z:
- surowym tekstem (dla porównania w TypeScript)
- flagami Tagged PDF /ActualText
- wykryciem niewidzialnego tekstu (Tr 3)
- strukturą sekcji
"""

import json
import sys
from pathlib import Path

try:
    import pikepdf
except ImportError:
    pikepdf = None

try:
    from pdfminer.high_level import extract_text
except ImportError:
    extract_text = None


def has_invisible_text(pdf_path: str) -> bool:
    """Czy którykolwiek strumień treści ustawia tryb renderowania 3 (Tr)?"""
    if pikepdf is None:
        return False
    try:
        with pikepdf.open(pdf_path) as pdf:
            for page in pdf.pages:
                try:
                    contents = page.get("/Contents")
                    if contents is None:
                        continue
                    if isinstance(contents, pikepdf.Array):
                        for stream_obj in contents:
                            raw = stream_obj.read_bytes()
                            if b"Tr 3" in raw or b"Tr 3\n" in raw:
                                return True
                    else:
                        raw = contents.read_bytes()
                        if b"Tr 3" in raw or b"Tr 3\n" in raw:
                            return True
                except Exception:
                    continue
    except Exception:
        return False
    return False


def has_actual_text(pdf_path: str) -> bool:
    """Czy PDF zawiera Tagged PDF z /ActualText w StructTreeRoot?"""
    if pikepdf is None:
        return False
    try:
        with pikepdf.open(pdf_path) as pdf:
            root = pdf.Root
            struct_tree = root.get("/StructTreeRoot")
            if struct_tree is None:
                return False

            # Rekurencyjnie szukaj /ActualText w drzewie struktury
            def walk(obj, depth=0):
                if depth > 20:
                    return False
                if isinstance(obj, pikepdf.Dictionary):
                    if "/ActualText" in obj:
                        val = obj["/ActualText"]
                        if isinstance(val, pikepdf.String) and len(str(val)) > 0:
                            return True
                    for key in obj:
                        if key.startswith("/"):
                            if walk(obj[key], depth + 1):
                                return True
                elif isinstance(obj, pikepdf.Array):
                    for item in obj:
                        if walk(item, depth + 1):
                            return True
                return False

            return walk(struct_tree)
    except Exception:
        return False
    return False


def extract_text_from_pdf(pdf_path: str) -> str:
    """Ekstrahuje tekst z PDF za pomocą pdfminer.six."""
    if extract_text is None:
        # Fallback: ręczna ekstrakcja przez pikepdf
        return _fallback_extract(pdf_path)
    try:
        return extract_text(pdf_path)
    except Exception:
        return _fallback_extract(pdf_path)


def _fallback_extract(pdf_path: str) -> str:
    """Ręczna ekstrakcja tekstu z content streams."""
    if pikepdf is None:
        return ""
    try:
        with pikepdf.open(pdf_path) as pdf:
            parts = []
            for page in pdf.pages:
                try:
                    contents = page.get("/Contents")
                    if contents is None:
                        continue
                    if isinstance(contents, pikepdf.Array):
                        for stream_obj in contents:
                            raw = stream_obj.read_bytes()
                            parts.append(_decode_pdf_content(raw))
                    else:
                        raw = contents.read_bytes()
                        parts.append(_decode_pdf_content(raw))
                except Exception:
                    continue
            return "\n".join(parts)
    except Exception:
        return ""


def _decode_pdf_content(raw_bytes: bytes) -> str:
    """Dekoduje surowy content stream PDF na tekst (uproszczony)."""
    text_parts = []
    lines = raw_bytes.decode("latin-1", errors="replace").split("\n")
    for line in lines:
        line = line.strip()
        # Szukaj operacji TJ/Tj (text showing)
        if "TJ" in line or "Tj" in line:
            # Wyodrębnij tekst z nawiasów
            import re
            strings = re.findall(r"\(([^)]*)\)", line)
            for s in strings:
                text_parts.append(s)
    return " ".join(text_parts)


def detect_sections(text: str) -> dict:
    """Wykrywa sekcje CV w wyekstrahowanym tekście."""
    lines = text.split("\n")
    sections = {}
    current_section = None

    header_patterns = [
        ("experience", ["doświadczenie", "work experience", "employment", "historia zatrudnienia"]),
        ("education", ["wykształcenie", "education", "edukacja"]),
        ("skills", ["umiejętności", "skills", "technologie", "competencies"]),
        ("contact", ["kontakt", "contact", "dane osobowe"]),
        ("certifications", ["certyfikaty", "certifications", "uprawnienia"]),
        ("summary", ["podsumowanie", "summary", "profil zawodowy"]),
        ("projects", ["projekty", "projects"]),
        ("languages", ["języki", "languages"]),
    ]

    for line in lines:
        line_lower = line.strip().lower()
        for key, aliases in header_patterns:
            if any(alias in line_lower for alias in aliases):
                current_section = key
                sections[key] = []
                break
        else:
            if current_section and line.strip():
                sections.setdefault(current_section, []).append(line.strip())

    return sections


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Użycie: python -m mvcv.tools.ats_extract <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(json.dumps({"error": f"Plik nie istnieje: {pdf_path}"}))
        sys.exit(1)

    raw_text = extract_text_from_pdf(pdf_path)
    sections = detect_sections(raw_text)
    invisible = has_invisible_text(pdf_path)
    actual_text = has_actual_text(pdf_path)

    result = {
        "rawText": raw_text,
        "sections": sections,
        "hasActualText": actual_text,
        "hasInvisibleText": invisible,
        "totalChars": len(raw_text),
        "totalWords": len(raw_text.split()),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

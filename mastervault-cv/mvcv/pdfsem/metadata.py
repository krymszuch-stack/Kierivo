"""Warstwa mikrodanych: /Metadata (XMP) z JSON-LD Schema.org/Person.

Do PDF-a trafiają trzy nośniki semantyki:

1. drzewo struktury + /ActualText (patrz ``structtree.py``) — parser czyta
   bogate zdania zamiast pigułek,
2. strumień ``/Metadata`` (XMP) z osadzonym JSON-LD ``@type: Person`` —
   nowoczesne ATS-y i rekrutacyjne modele AI dostają ustrukturyzowaną siatkę
   kompetencji, uprawnień formalnych (SEP, UDT, prawo jazdy) i lat stażu
   bez ryzyka błędu OCR,
3. Aplikacja nadal może importować załącznik ``mastervault.json`` ze starszych
   plików, ale nowe CV go nie osadzają. Załącznik zawierał dane profilu poza
   treścią dokumentu i był przekazywany każdemu odbiorcy PDF.

Ponadto: klasyczny słownik /Info (Title/Author/Subject/Keywords) dla starszych
parserów.
"""

from __future__ import annotations

import datetime as _dt
import json
import re
from xml.sax.saxutils import escape

import pikepdf

from ..data.model import MasterProfile

MV_NS = "https://mastervault.app/ns/cv/1.0/"
GENERATOR = "MasterVault CV Engine (mvcv) 1.0"

_XMP_TEMPLATE = """<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="MasterVault CV Engine">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">{title}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>{author}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="pl-PL">{description}</rdf:li></rdf:Alt></dc:description>
   <dc:language><rdf:Bag><rdf:li>pl-PL</rdf:li></rdf:Bag></dc:language>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>{generator}</pdf:Producer>
   <pdf:Keywords>{keywords}</pdf:Keywords>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreatorTool>{generator}</xmp:CreatorTool>
   <xmp:CreateDate>{created}</xmp:CreateDate>
   <xmp:ModifyDate>{created}</xmp:ModifyDate>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:mv="{mvns}">
   <mv:generator>{generator}</mv:generator>
   <mv:semanticLayer>Tagged PDF: /ActualText w drzewie struktury + JSON-LD (Schema.org/Person) w /Metadata</mv:semanticLayer>
   <mv:source>{source}</mv:source>
   <mv:jsonLd><![CDATA[{jsonld}]]></mv:jsonLd>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end=" w"?>
"""


# ------------------------------------------------------------------ JSON-LD

def _years_of_experience(profile: MasterProfile, *, today: _dt.date | None = None) -> int:
    today = today or _dt.date.today()
    today_month = today.year * 12 + today.month - 1
    intervals: list[tuple[int, int]] = []

    def month_index(value: str) -> int | None:
        match = re.match(r"^(\d{2})\.(\d{4})$", value.strip())
        if not match:
            return None
        month, year = int(match.group(1)), int(match.group(2))
        if not 1 <= month <= 12:
            return None
        return year * 12 + month - 1

    for exp in profile.experience:
        start = month_index(exp.start)
        if start is None:
            continue

        end_text = exp.end.strip().casefold()
        end = today_month if end_text in {"obecnie", "teraz", "current", "present"} else month_index(exp.end)
        # Brak daty końca nie jest dowodem, że praca trwa do dziś.
        if end is None or end < start:
            continue
        intervals.append((start, end))

    if not intervals:
        return 0

    intervals.sort()
    merged: list[tuple[int, int]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))

    months = sum(end - start for start, end in merged)
    return months // 12


def build_jsonld(profile: MasterProfile) -> dict:
    """Ustrukturyzowany profil kandydata (@type Person) + przestrzeń mv:."""
    c = profile.contact
    same_as = [u for u in (c.linkedin and "https://" + c.linkedin.removeprefix("https://"),
                           c.github and "https://" + c.github.removeprefix("https://"),
                           c.www) if u]
    person: dict = {
        "@context": {
            "@vocab": "https://schema.org/",
            "mv": MV_NS,
        },
        "@type": "Person",
        "name": profile.name,
        "jobTitle": profile.title,
        "description": profile.summary.semantic,
        "mv:yearsOfExperience": _years_of_experience(profile),
        "mv:source": profile.source_id or "mastervault://profiles/local",
        "mv:generatedBy": GENERATOR,
        "mv:experience": [
            {
                "@type": "Role",
                "roleName": exp.role,
                "worksFor": {"@type": "Organization", "name": exp.company},
                "startDate": exp.start,
                "endDate": exp.end,
                "location": exp.location or None,
                "description": " ".join(b.semantic for b in exp.bullets),
            }
            for exp in profile.experience
        ],
        "knowsAbout": [s.semantic for s in profile.skills],
        "mv:skillLabels": [s.label for s in profile.skills],
        "hasCredential": [
            {
                "@type": "EducationalOccupationalCredential",
                "credentialCategory": "certification",
                "name": cert.name,
                "recognizedBy": {"@type": "Organization", "name": cert.issuer} if cert.issuer else None,
                "dateCreated": cert.year or None,
                "description": cert.semantic,
            }
            for cert in profile.certifications
        ],
        "mv:licenses": list(profile.licenses),
        "alumniOf": [
            {"@type": "EducationalOrganization", "name": ed.school,
             "description": ed.degree}
            for ed in profile.education
        ],
        "knowsLanguage": [
            {"@type": "Language", "name": l.name, "alternateName": l.level or None}
            for l in profile.languages
        ],
    }
    if c.email:
        person["email"] = f"mailto:{c.email}" if "@" in c.email and not c.email.startswith("mailto") else c.email
    if c.phone:
        person["telephone"] = c.phone
    if c.city:
        person["homeLocation"] = {"@type": "Place",
                                  "address": {"@type": "PostalAddress",
                                              "addressLocality": c.city,
                                              "addressCountry": "PL"}}
    if same_as:
        person["sameAs"] = same_as
    # wyczyść wartości None (poprawny JSON-LD)
    def _clean(o):
        if isinstance(o, dict):
            return {k: _clean(v) for k, v in o.items() if v is not None}
        if isinstance(o, list):
            return [_clean(v) for v in o if v is not None]
        return o
    return _clean(person)


# --------------------------------------------------------------------- XMP

def build_xmp(profile: MasterProfile, *, title: str, jsonld: dict) -> bytes:
    keywords = ", ".join(s.label for s in profile.skills)
    now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    xml = _XMP_TEMPLATE.format(
        title=escape(title),
        author=escape(profile.name),
        description=escape(profile.summary.semantic),
        keywords=escape(keywords),
        generator=escape(GENERATOR),
        created=now,
        mvns=MV_NS,
        source=escape(profile.source_id or "mastervault://profiles/local"),
        jsonld=json.dumps(jsonld, ensure_ascii=False, indent=2),
    )
    return xml.encode("utf-8")


def inject_metadata(pdf: pikepdf.Pdf, profile: MasterProfile, *, title: str) -> dict:
    """Ustaw /Metadata (XMP) i /Info. Zwraca JSON-LD."""
    jsonld = build_jsonld(profile)
    xmp = build_xmp(profile, title=title, jsonld=jsonld)
    meta = pdf.make_stream(xmp)
    meta.Type = pikepdf.Name.Metadata
    meta.Subtype = pikepdf.Name.XML
    pdf.Root.Metadata = meta

    keywords = ", ".join(s.label for s in profile.skills)
    info = pdf.trailer["/Info"]
    info["/Title"] = pikepdf.String(title)
    info["/Author"] = pikepdf.String(profile.name)
    info["/Subject"] = pikepdf.String(profile.title)
    info["/Keywords"] = pikepdf.String(keywords)
    info["/Creator"] = pikepdf.String(GENERATOR)
    info["/Producer"] = pikepdf.String(GENERATOR)

    return jsonld

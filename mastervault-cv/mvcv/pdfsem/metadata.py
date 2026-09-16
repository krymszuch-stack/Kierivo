"""Warstwa mikrodanych: /Metadata (XMP) z JSON-LD Schema.org/Person.

Do PDF-a trafiają trzy nośniki semantyki:

1. drzewo struktury + /ActualText (patrz ``structtree.py``) — parser czyta
   bogate zdania zamiast pigułek,
2. strumień ``/Metadata`` (XMP) z osadzonym JSON-LD ``@type: Person`` —
   nowoczesne ATS-y i rekrutacyjne modele AI dostają ustrukturyzowaną siatkę
   kompetencji, uprawnień formalnych (SEP, UDT, prawo jazdy) i lat stażu
   bez ryzyka błędu OCR,
3. załącznik ``mastervault.json`` — źródłowy rekord danych, żeby dokument
   był w pełni odtwarzalny (round-trip MasterVault -> PDF -> MasterVault).

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
   <mv:semanticLayer>Tagged PDF: /ActualText w drzewie struktury + JSON-LD (Schema.org/Person) w /Metadata + załącznik mastervault.json</mv:semanticLayer>
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
    earliest: _dt.date | None = None
    for exp in profile.experience:
        m = re.match(r"^(\d{2})\.(\d{4})$", exp.start)
        if m:
            d = _dt.date(int(m.group(2)), int(m.group(1)), 1)
            earliest = d if earliest is None or d < earliest else earliest
    if earliest is None:
        return 0
    months = (today.year - earliest.year) * 12 + today.month - earliest.month
    return max(0, months // 12)


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


def inject_metadata(pdf: pikepdf.Pdf, profile: MasterProfile, *, title: str,
                    attach_master_json: bool = True) -> dict:
    """Ustaw /Metadata (XMP), /Info i opcjonalny załącznik. Zwraca JSON-LD."""
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

    if attach_master_json:
        payload = {
            "masterVaultRecord": {
                "source": profile.source_id or None,
                "resumeData": {
                    "name": profile.name, "title": profile.title,
                    "contact": profile.contact.__dict__,
                    "summary": {"display": profile.summary.display,
                                "semantic": profile.summary.semantic},
                    "skills": [s.__dict__ for s in profile.skills],
                    "experience": [
                        {**{f: getattr(e, f) for f in
                            ("role", "company", "start", "end", "location", "tech")},
                         "bullets": [b.__dict__ for b in e.bullets]}
                        for e in profile.experience
                    ],
                    "education": [e.__dict__ for e in profile.education],
                    "certifications": [c.__dict__ for c in profile.certifications],
                    "languages": [l.__dict__ for l in profile.languages],
                    "licenses": profile.licenses,
                    "clause": profile.clause,
                },
                "jsonLd": jsonld,
            }
        }
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        attach_file(pdf, "mastervault.json", data,
                    mime_type="application/json",
                    desc="Rekord MasterVault (źródło wiedzy) osadzony w CV")
    return jsonld


def attach_file(pdf: pikepdf.Pdf, filename: str, data: bytes, *,
                mime_type: str = "application/octet-stream", desc: str = "") -> None:
    """Załącz plik (EmbeddedFiles) z fallbackiem na ręczną konstrukcję."""
    try:
        pdf.attach_file(data, filename=filename, mime_type=mime_type, desc=desc)
        return
    except AttributeError:
        pass
    ef = pdf.make_stream(data)
    ef.Type = pikepdf.Name.EmbeddedFile
    ef.Subtype = pikepdf.Name("/" + mime_type)
    ef.Params = pdf.make_indirect(pikepdf.Dictionary(
        Size=len(data),
        ModDate=_dt.datetime.now().strftime("D:%Y%m%d%H%M%SZ"),
    ))
    filespec = pdf.make_indirect(pikepdf.Dictionary(
        Type=pikepdf.Name.Filespec,
        F=pikepdf.String(filename),
        UF=pikepdf.String(filename),
        Desc=pikepdf.String(desc),
        EF=pikepdf.Dictionary(F=ef),
    ))
    names = pdf.Root.get("/Names")
    if names is None:
        names = pdf.make_indirect(pikepdf.Dictionary())
        pdf.Root.Names = names
    ef_tree = names.get("/EmbeddedFiles")
    if ef_tree is None:
        ef_tree = pdf.make_indirect(pikepdf.Dictionary(Names=pikepdf.Array([])))
        names.EmbeddedFiles = ef_tree
    ef_tree.Names.append(pikepdf.String(filename))
    ef_tree.Names.append(filespec)

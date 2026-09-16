"""Warstwa danych MasterVault — model wiedzy o kandydacie.

Zasada nadrzędna: DANE NIE WIEDZĄ, JAK WYGLĄDAJĄ.
Model opisuje wyłącznie treść i jej dwie postacie:

* ``display``  — to, co widzi rekruter (warstwa wizualna, np. pigułka ``[ SQL ]``),
* ``semantic`` — to, co indeksuje parser ATS (pełne, bogate zdanie w /ActualText).

Brak jakichkolwiek pól layoutowych / kolorystycznych — wygląd to wyłączna
własność presetów w :mod:`mvcv.design`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Contact:
    phone: str = ""
    email: str = ""
    city: str = ""
    linkedin: str = ""
    github: str = ""
    www: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Contact":
        return cls(**{k: str(d[k]) for k in d if k in cls.__dataclass_fields__})

    def pairs(self) -> list[tuple[str, str]]:
        """(etykieta, wartość) w stałej kolejności priorytetów."""
        out = []
        if self.phone:
            out.append(("telefon", self.phone))
        if self.email:
            out.append(("e-mail", self.email))
        if self.city:
            out.append(("lokalizacja", self.city))
        if self.linkedin:
            out.append(("LinkedIn", self.linkedin))
        if self.github:
            out.append(("GitHub", self.github))
        if self.www:
            out.append(("WWW", self.www))
        return out


@dataclass
class Skill:
    """Pigułka kompetencji: etykieta dla oka, pełne zdanie dla parsera."""

    label: str
    semantic: str
    group: str = "core"  # core | tooling | domain | soft
    weight: int = 0      # wyższy = ważniejszy przy selekcji

    @classmethod
    def from_dict(cls, d: Any) -> "Skill":
        if isinstance(d, str):  # degradacja: zwykły string = etykieta bez sementyki
            return cls(label=d, semantic=d)
        return cls(
            label=str(d["label"]),
            semantic=str(d.get("semantic") or d["label"]),
            group=str(d.get("group", "core")),
            weight=int(d.get("weight", 0)),
        )


@dataclass
class Bullet:
    """Punkt doświadczenia: metryka dla oka, pełny kontekst dla maszyny."""

    kind: str  # "result" (rezultat pracy — wyższy priorytet) | "duty" (obowiązki)
    display: str
    semantic: str = ""

    def __post_init__(self) -> None:
        if self.kind not in ("result", "duty"):
            raise ValueError(f"Bullet.kind musi być 'result' albo 'duty', jest: {self.kind!r}")
        if not self.semantic:
            self.semantic = self.display

    @classmethod
    def from_dict(cls, d: Any) -> "Bullet":
        if isinstance(d, str):
            return cls(kind="duty", display=d)
        return cls(
            kind=str(d.get("kind", "duty")),
            display=str(d["display"]),
            semantic=str(d.get("semantic", "")),
        )


@dataclass
class Experience:
    role: str
    company: str
    start: str
    end: str = "obecnie"
    location: str = ""
    bullets: list[Bullet] = field(default_factory=list)
    tech: list[str] = field(default_factory=list)  # opcjonalny wiersz technologii

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Experience":
        return cls(
            role=str(d["role"]),
            company=str(d["company"]),
            start=str(d["start"]),
            end=str(d.get("end", "obecnie")),
            location=str(d.get("location", "")),
            bullets=[Bullet.from_dict(b) for b in d.get("bullets", [])],
            tech=[str(t) for t in d.get("tech", [])],
        )

    @property
    def period(self) -> str:
        return f"{self.start} – {self.end}" if self.end else self.start


@dataclass
class Education:
    degree: str
    school: str
    start: str = ""
    end: str = ""
    note: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Education":
        return cls(
            degree=str(d["degree"]),
            school=str(d["school"]),
            start=str(d.get("start", "")),
            end=str(d.get("end", "")),
            note=str(d.get("note", "")),
        )


@dataclass
class Certification:
    name: str
    issuer: str = ""
    year: str = ""
    semantic: str = ""

    def __post_init__(self) -> None:
        if not self.semantic:
            self.semantic = ", ".join(x for x in (self.name, self.issuer, self.year) if x)

    @classmethod
    def from_dict(cls, d: Any) -> "Certification":
        if isinstance(d, str):
            return cls(name=d)
        return cls(
            name=str(d["name"]),
            issuer=str(d.get("issuer", "")),
            year=str(d.get("year", "")),
            semantic=str(d.get("semantic", "")),
        )


@dataclass
class Language:
    name: str
    level: str

    @classmethod
    def from_dict(cls, d: Any) -> "Language":
        if isinstance(d, str):
            return cls(name=d, level="")
        return cls(name=str(d["name"]), level=str(d.get("level", "")))


@dataclass
class Summary:
    display: str
    semantic: str = ""

    def __post_init__(self) -> None:
        if not self.semantic:
            self.semantic = self.display


@dataclass
class MasterProfile:
    """Pełny profil w MasterVault (źródło wiedzy) — nadzbiór kontraktu ResumeData."""

    name: str
    title: str
    contact: Contact
    summary: Summary
    skills: list[Skill]
    experience: list[Experience]
    education: list[Education]
    certifications: list[Certification] = field(default_factory=list)
    languages: list[Language] = field(default_factory=list)
    licenses: list[str] = field(default_factory=list)  # formalne: SEP, UDT, prawo jazdy
    avatar: str = "none"          # none | circle | square (podpowiedź, nie rozkaz)
    initials: str = ""
    photo: str = ""               # ścieżka do zdjęcia (opcjonalnie)
    source_id: str = ""           # identyfikator rekordu w MasterVault
    clause: str = ""              # klauzula RODO / prawna
    projects: list[dict] = field(default_factory=list)
    interests: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "MasterProfile":
        required = ("name", "title", "contact", "summary", "skills", "experience", "education")
        missing = [k for k in required if k not in d]
        if missing:
            raise ValueError(f"Profil MasterVault niekompletny — brakuje pól: {', '.join(missing)}")
        summary = d["summary"]
        if isinstance(summary, str):
            summary = {"display": summary}
        return cls(
            name=str(d["name"]),
            title=str(d["title"]),
            contact=Contact.from_dict(d["contact"]),
            summary=Summary(str(summary["display"]), str(summary.get("semantic", ""))),
            skills=[Skill.from_dict(s) for s in d["skills"]],
            experience=[Experience.from_dict(e) for e in d["experience"]],
            education=[Education.from_dict(e) for e in d["education"]],
            certifications=[Certification.from_dict(c) for c in d.get("certifications", [])],
            languages=[Language.from_dict(l) for l in d.get("languages", [])],
            licenses=[str(x) for x in d.get("licenses", [])],
            avatar=str(d.get("avatar", "none")),
            initials=str(d.get("initials", "")),
            photo=str(d.get("photo", "")),
            source_id=str(d.get("source_id", "")),
            clause=str(d.get("clause") or d.get("rodo_clause", "")),
            projects=list(d.get("projects", [])),
            interests=[str(x) for x in d.get("interests", [])],
        )


def load_profile(path: str) -> MasterProfile:
    import json

    with open(path, encoding="utf-8") as f:
        return MasterProfile.from_dict(json.load(f))

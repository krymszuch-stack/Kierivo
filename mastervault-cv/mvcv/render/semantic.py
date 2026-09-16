"""Kolektor warstwy semantycznej (Tagged PDF).

Każdy fragment treści rysowany w PDF jest opakowany sekwencją marked-content:

    /Span <</MCID n>> BDC   ... operatory rysujące ...   EMC

Identyfikatory MCID trafiają do rejestru :class:`SemanticDoc`, a po zapisaniu
PDF moduł :mod:`mvcv.pdfsem.structtree` buduje z nich pełne drzewo struktury
(/StructTreeRoot + /ParentTree) i dopina /ActualText.

Kluczowa własność: *żaden* tekst nie jest rysowany podwójnie. Warstwa wizualna
zawiera wyłącznie widoczny tekst (rekruter przy Ctrl+A widzi ``SQL``), a bogate
zdania żyją wyłącznie jako /ActualText w drzewie struktury.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SemanticNode:
    page: int                 # indeks strony (0-based)
    mcid: int
    struct: str               # Document | Sect | H1 | H2 | H3 | P | Span | LI | L | Figure
    group: str                # klucz sekcji logiki, np. "header", "sidebar.skills"
    actual_text: str = ""     # bogata treść dla parsera (pusta = widoczny tekst wystarcza)
    visible_text: str = ""    # dla raportów weryfikacyjnych
    lang: str = ""


@dataclass
class SemanticDoc:
    lang: str = "pl-PL"
    nodes: list[SemanticNode] = field(default_factory=list)
    _counters: dict[int, int] = field(default_factory=dict)

    def next_mcid(self, page: int) -> int:
        n = self._counters.get(page, 0)
        self._counters[page] = n + 1
        return n

    def record(self, page: int, struct: str, group: str,
               actual_text: str = "", visible_text: str = "") -> int:
        mcid = self.next_mcid(page)
        self.nodes.append(SemanticNode(
            page=page, mcid=mcid, struct=struct, group=group,
            actual_text=actual_text, visible_text=visible_text, lang=self.lang,
        ))
        return mcid

    def bdc(self, page: int, struct: str, group: str,
            actual_text: str = "", visible_text: str = "") -> tuple[int, str]:
        """Zwróć (mcid, gotowy operator BDC) i zarejestruj węzeł."""
        mcid = self.record(page, struct, group, actual_text, visible_text)
        return mcid, f"/{struct} <</MCID {mcid}>> BDC"

    # ---------------------------------------------------------------- wygoda

    def pairs(self) -> list[tuple[SemanticNode, SemanticNode]]:
        """Pary (widoczny tekst, sementyka) tam, gdzie się różnią — do raportów."""
        out = []
        for n in self.nodes:
            if n.actual_text and n.actual_text != n.visible_text:
                out.append((n, n))
        return out


class MarkedWriter:
    """Wstrzykuje operatory marked-content bezpośrednio do strumienia strony
    ReportLab (``canvas._code``) i pilnuje kolejności BDC/EMC."""

    def __init__(self, canvas, sem: SemanticDoc):
        self.canvas = canvas
        self.sem = sem

    @property
    def page(self) -> int:
        return self.canvas.getPageNumber() - 1

    def _push(self, op: str) -> None:
        self.canvas._code.append(op)

    def begin(self, struct: str, group: str, actual_text: str = "",
              visible_text: str = "") -> int:
        # ActualText ma sens tylko jako SUPLEMENT: gdy jest identyczny z tekstem
        # widocznym, pomijamy go — parser i tak odczyta narysowany tekst,
        # a weryfikator separacji warstw nie dostaje fałszywych trafień.
        if actual_text and visible_text and actual_text == visible_text:
            actual_text = ""
        mcid, op = self.sem.bdc(self.page, struct, group, actual_text, visible_text)
        self._push(op)
        return mcid

    def end(self) -> None:
        self._push("EMC")

    def raw(self, op: str) -> None:
        self._push(op)

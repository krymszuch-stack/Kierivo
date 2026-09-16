"""Budowa drzewa struktury PDF (Tagged PDF) na bazie SemanticDoc.

Po zapisaniu warstwy wizualnej przez ReportLab wstrzykujemy do PDF-a:

* ``/StructTreeRoot`` z pełną hierarchią Document -> Sect -> H1/H2/H3/P/Span/LI/Figure,
* ``/ParentTree`` mapujący MCID ze strumieni treści na elementy struktury,
* ``/ActualText`` na elementach, gdzie dane dostarczyły bogatszej sementyki
  (pigułki, punkty doświadczeń, nagłówki) — parser ATS czyta zdania,
  rekruter widzi pigułki,
* ``/MarkInfo <</Marked true>>``, ``/Lang``, ``/ViewerPreferences``.

Nie modyfikujemy strumieni treści — warstwa wizualna zostaje dokładnie
taka, jak narysowano.
"""

from __future__ import annotations

import pikepdf

from ..render.semantic import SemanticDoc, SemanticNode


def _utf16(s: str) -> pikepdf.String:
    """PDF text string dla Unicode (BOM UTF-16BE)."""
    return pikepdf.String(b"\xfe\xff" + s.encode("utf-16-be"))


def clear_existing(pdf: pikepdf.Pdf) -> None:
    """Usuń ewentualne wcześniejsze struktury (idempotentność pipeline'u)."""
    if "/StructTreeRoot" in pdf.Root:
        del pdf.Root.StructTreeRoot
    if "/MarkInfo" in pdf.Root:
        del pdf.Root.MarkInfo
    for page in pdf.pages:
        if "/StructParents" in page.obj:
            del page.obj.StructParents


def build(pdf: pikepdf.Pdf, sem: SemanticDoc) -> pikepdf.Dictionary:
    """Zbuduj i podepnij /StructTreeRoot. Zwraca obiekt roota."""
    clear_existing(pdf)
    pages = list(pdf.pages)

    # --- pogrupuj węzły: (strona, grupa) -> węzły, w kolejności rysowania
    nodes: dict[tuple[int, str], list[SemanticNode]] = {}
    group_order: list[tuple[int, str]] = []
    for n in sem.nodes:
        key = (n.page, n.group)
        if key not in nodes:
            nodes[key] = []
            group_order.append(key)
        nodes[key].append(n)

    root = pdf.make_indirect(pikepdf.Dictionary(Type=pikepdf.Name.StructTreeRoot))
    doc_elem = pdf.make_indirect(pikepdf.Dictionary(
        Type=pikepdf.Name.StructElem, S=pikepdf.Name.Document, P=root,
    ))
    root.K = pikepdf.Array([doc_elem])

    def new_elem(s: str, parent, **extra) -> pikepdf.Dictionary:
        d = pikepdf.Dictionary(
            Type=pikepdf.Name.StructElem, S=pikepdf.Name("/" + s), P=parent,
        )
        for k, v in extra.items():
            d[pikepdf.Name("/" + k)] = v
        return d

    doc_children: list[pikepdf.Dictionary] = []
    parent_nums: list[pikepdf.Array] = []

    for pidx, page in enumerate(pages):
        page_elems: list[pikepdf.Dictionary] = []
        for key in group_order:
            if key[0] != pidx:
                continue
            sect = pdf.make_indirect(new_elem("Sect", doc_elem, T=_utf16(key[1])))
            kids: list[pikepdf.Dictionary] = []
            for node in nodes[key]:
                extra: dict = {}
                if node.actual_text:
                    extra["ActualText"] = _utf16(node.actual_text)
                if node.struct == "Figure":
                    extra["Alt"] = _utf16(node.actual_text or node.visible_text)
                el = pdf.make_indirect(new_elem(node.struct, sect,
                                                K=node.mcid, Pg=page.obj, **extra))
                kids.append(el)
                page_elems.append(el)
            sect.K = pikepdf.Array(kids)
            doc_children.append(sect)
        parent_nums.append(pdf.make_indirect(pikepdf.Array(page_elems)))
        page.obj.StructParents = pidx

    doc_elem.K = pikepdf.Array(doc_children)

    nums: list = []
    for pidx, arr in enumerate(parent_nums):
        nums.extend([pidx, arr])
    root.ParentTree = pdf.make_indirect(pikepdf.Dictionary(
        Nums=pikepdf.Array(nums),
    ))
    root.ParentTreeNextKey = len(parent_nums)

    cat = pdf.Root
    cat.StructTreeRoot = root
    cat.MarkInfo = pikepdf.Dictionary(Marked=True)
    cat.Lang = _utf16(sem.lang)
    cat.ViewerPreferences = pikepdf.Dictionary(DisplayDocTitle=True)
    return root

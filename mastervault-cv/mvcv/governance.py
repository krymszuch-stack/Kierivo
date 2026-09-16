"""Silnik governance — kontroluje OBJĘTOŚĆ i PRIORYTETY treści.

Reguły (z projektu designu):
* nagłówek: maks. 1–2 linie,
* opis profilu: 3–5 linii,
* pojedynczy opis doświadczenia: 3–6 linii,
* lista umiejętności: 5–10 pozycji,
* liczba doświadczeń: 2–4,
* maks. 2 poziomy zagnieżdżenia (doświadczenie -> punkty; głębiej nie wolno),
* priorytety treści: stanowisko i firma -> daty -> rezultat pracy -> obowiązki.

Governance działa na tekście, nie na pikselach: dzięki temu reguły są te same
dla każdego layoutu. Renderer jedynie pilnuje, żeby wynik fizycznie zmieścił
się na stronie (zaczynając od redukcji najniższopriorytetowych elementów).
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from .data.model import Bullet, MasterProfile

# ---------------------------------------------------------------- limity
HEADLINE_MAX_LINES = 2
SUMMARY_LINES = (3, 5)
EXP_ENTRY_LINES = (3, 6)
SKILLS_COUNT = (5, 10)
EXP_ENTRIES = (2, 4)
MAX_NESTING = 2  # egzekwowane przez sam model: MasterProfile ma dokładnie 2 poziomy

ELLIPSIS = "…"


def truncate_to_lines(text: str, *, width_pt: float, font: str, size: float, max_lines: int,
                      measure) -> tuple[str, int]:
    """Przytnij tekst do max_lines w danym dniarskim metrum (zawijanie po słowach).

    Zwraca (tekst, liczba_linii). Mierzy szerokość funkcją ``measure``.
    """
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        cand = f"{cur} {w}".strip()
        if measure(cand, font, size) <= width_pt:
            cur = cand
        else:
            if cur:
                lines.append(cur)
                if len(lines) == max_lines:
                    break
            cur = w
    else:
        if cur:
            lines.append(cur)

    if len(lines) > max_lines:
        lines = lines[:max_lines]
        # docięcie ostatniej linii, żeby zmieścić wielokropek
        last = lines[-1]
        while last and measure(last + ELLIPSIS, font, size) > width_pt:
            last = last.rsplit(" ", 1)[0]
        lines[-1] = (last + " " + ELLIPSIS).strip()
    return " ".join(lines), len(lines)


def count_lines(text: str, *, width_pt: float, font: str, size: float, measure) -> int:
    _, n = truncate_to_lines(text, width_pt=width_pt, font=font, size=size,
                             max_lines=10_000, measure=measure)
    return n


def sort_bullets(bullets: list[Bullet]) -> list[Bullet]:
    """Priorytet: rezultat pracy przed obowiązkami; w grupach zachowaj kolejność."""
    results = [b for b in bullets if b.kind == "result"]
    duties = [b for b in bullets if b.kind == "duty"]
    return results + duties


def fit_bullets_to_lines(bullets: list[Bullet], *, max_lines: int, width_pt: float,
                         measure, bullet_font: str = "Sans", bullet_size: float = 9.5) -> list[Bullet]:
    """Wybierz punkty tak, by łącznie nie przekroczyć max_lines (results first)."""
    ordered = sort_bullets(bullets)
    used = 0
    out: list[Bullet] = []
    for b in ordered:
        lines = count_lines(b.display, width_pt=width_pt - 12, font=bullet_font,
                            size=bullet_size, measure=measure)
        if used + lines > max_lines and out:
            break
        used += lines
        out.append(b)
        if used >= max_lines:
            break
    return out


@dataclass
class GovernanceReport:
    summary_lines: int = 0
    skills_kept: int = 0
    skills_dropped: int = 0
    exp_kept: int = 0
    exp_dropped: int = 0
    bullets_kept: int = 0
    bullets_dropped: int = 0
    notes: list[str] = None

    def __post_init__(self) -> None:
        if self.notes is None:
            self.notes = []

    def describe(self) -> str:
        rows = [
            f"profil: {self.summary_lines} linii",
            f"umiejetnosci: {self.skills_kept} (odrzucono {self.skills_dropped})",
            f"doswiadczenia: {self.exp_kept} (odrzucono {self.exp_dropped})",
            f"punkty doswiadczen: {self.bullets_kept} (odrzucono {self.bullets_dropped})",
        ] + [f"- {n}" for n in self.notes]
        return "\n".join(rows)


DEFAULT_RODO_CLAUSE = (
    "Wyrażam zgodę na przetwarzanie moich danych osobowych dla potrzeb niezbędnych do realizacji "
    "procesu rekrutacji zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)."
)


def apply(profile: MasterProfile, *, content_width: float, measure,
          target_pages: int = 1, aggressive_fit: bool = False) -> tuple[MasterProfile, GovernanceReport]:
    """Zwróć skrojony profil zgodny z limitami (selekcja + priorytety)."""
    rep = GovernanceReport()
    out = replace(profile)

    # --- domyślna klauzula RODO
    if not out.clause:
        out.clause = DEFAULT_RODO_CLAUSE
        rep.notes.append("dodano standardowa klauzule RODO")

    # --- limity zależne od docelowej liczby stron oraz trybu agresywnego dopasowania A4
    if aggressive_fit:
        max_skills = min(6, SKILLS_COUNT[0])
        min_skills = 4
        max_exps = min(2, len(out.experience)) if len(out.experience) > 1 else 1
        max_bullet_lines = 3
    else:
        max_skills = SKILLS_COUNT[1] if target_pages >= 2 else min(8, SKILLS_COUNT[1])
        min_skills = SKILLS_COUNT[0]
        max_exps = EXP_ENTRIES[1] if target_pages >= 2 else min(3, EXP_ENTRIES[1])
        max_bullet_lines = EXP_ENTRY_LINES[1] if target_pages >= 2 else 5

    # --- umiejętności: najpierw najwyższy weight, stabilnie po nazwie
    skills = sorted(out.skills, key=lambda s: (-s.weight, s.label))
    kept = skills[:max_skills]
    if len(kept) < min_skills and len(skills) > len(kept):
        kept = skills[:min_skills]
    rep.skills_kept, rep.skills_dropped = len(kept), len(out.skills) - len(kept)
    out.skills = kept

    # --- doświadczenia: w kolejności chronologicznej (najnowsze first w danych)
    exps = out.experience[:max_exps]
    rep.exp_kept, rep.exp_dropped = len(exps), len(out.experience) - len(exps)
    if rep.exp_dropped:
        rep.notes.append(f"limit {max_exps} doswiadczen (target_pages={target_pages}) - pominieto starsze pozycje")

    # --- punkty: results first, ograniczone do max_bullet_lines na wpis
    new_exps = []
    for e in exps:
        kept_b = fit_bullets_to_lines(e.bullets, max_lines=max_bullet_lines,
                                      width_pt=content_width, measure=measure)
        rep.bullets_kept += len(kept_b)
        rep.bullets_dropped += len(e.bullets) - len(kept_b)
        new_exps.append(replace(e, bullets=kept_b))
    out.experience = new_exps

    # --- opis profilu: 3–5 linii
    max_summary = 3 if aggressive_fit else (SUMMARY_LINES[1] if target_pages >= 2 else 4)
    text, n = truncate_to_lines(out.summary.display, width_pt=content_width,
                                font="Sans", size=9.6, max_lines=max_summary, measure=measure)
    rep.summary_lines = n
    out.summary = replace(out.summary, display=text)

    return out, rep

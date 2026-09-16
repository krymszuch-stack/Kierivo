"""Unit tests for the CV governance engine."""

import unittest

from mvcv.data.model import (
    Bullet,
    Contact,
    Education,
    Experience,
    MasterProfile,
    Skill,
    Summary,
)
from mvcv.governance import (
    DEFAULT_RODO_CLAUSE,
    apply,
    count_lines,
    fit_bullets_to_lines,
    sort_bullets,
    truncate_to_lines,
)


def mock_measure(text: str, font: str, size: float) -> float:
    """Mock measure function where each character is 6 points wide."""
    return len(text) * 6.0


class TestGovernanceHelpers(unittest.TestCase):
    def test_sort_bullets_priority(self):
        b1 = Bullet(kind="duty", display="Duty 1")
        b2 = Bullet(kind="result", display="Result 1")
        b3 = Bullet(kind="duty", display="Duty 2")
        b4 = Bullet(kind="result", display="Result 2")

        sorted_b = sort_bullets([b1, b2, b3, b4])
        self.assertEqual([b.display for b in sorted_b], ["Result 1", "Result 2", "Duty 1", "Duty 2"])

    def test_truncate_to_lines_within_limit(self):
        text = "Krótki tekst"
        # width = 200 pt, len(text)*6 = 72 pt -> fits in 1 line
        out_text, lines = truncate_to_lines(text, width_pt=200, font="Sans", size=10, max_lines=2, measure=mock_measure)
        self.assertEqual(out_text, "Krótki tekst")
        self.assertEqual(lines, 1)

    def test_truncate_to_lines_exceeding_limit(self):
        # 10 words, each word 5 chars = 30 pt
        text = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10"
        # width_pt = 70 pt -> approx 2 words per line (11 chars * 6 = 66 pt)
        out_text, lines = truncate_to_lines(text, width_pt=70, font="Sans", size=10, max_lines=2, measure=mock_measure)
        self.assertLessEqual(lines, 2)
        self.assertTrue(out_text.endswith("…") or len(out_text.split()) <= 4)

    def test_count_lines(self):
        text = "Raz dwa trzy cztery piec szesc siedem osiem dziewiec dziesiec"
        lines = count_lines(text, width_pt=80, font="Sans", size=10, measure=mock_measure)
        self.assertGreater(lines, 1)


class TestGovernanceApply(unittest.TestCase):
    def _create_sample_profile(self, clause: str = "") -> MasterProfile:
        return MasterProfile(
            name="Anna Nowak",
            title="Data Scientist",
            contact=Contact(email="anna@example.pl"),
            summary=Summary(display="Doświadczona analityczka danych i badaczka systemów uczących się."),
            skills=[
                Skill(label=f"Skill {i}", semantic=f"Skill {i} detail", weight=i)
                for i in range(15)
            ],
            experience=[
                Experience(
                    role=f"Rola {i}",
                    company=f"Firma {i}",
                    start="2020",
                    bullets=[
                        Bullet(kind="result", display=f"Wynik {i}.1"),
                        Bullet(kind="duty", display=f"Obowiązek {i}.2"),
                        Bullet(kind="duty", display=f"Obowiązek {i}.3"),
                        Bullet(kind="duty", display=f"Obowiązek {i}.4"),
                        Bullet(kind="duty", display=f"Obowiązek {i}.5"),
                    ],
                )
                for i in range(6)
            ],
            education=[Education(degree="Informatyka", school="AGH")],
            clause=clause,
        )

    def test_default_rodo_clause_injected(self):
        profile = self._create_sample_profile(clause="")
        resolved, rep = apply(profile, content_width=400, measure=mock_measure, target_pages=1)
        self.assertEqual(resolved.clause, DEFAULT_RODO_CLAUSE)
        self.assertTrue(any("RODO" in note for note in rep.notes))

    def test_custom_clause_preserved(self):
        profile = self._create_sample_profile(clause="Moja własna klauzula rekrutacyjna.")
        resolved, rep = apply(profile, content_width=400, measure=mock_measure, target_pages=1)
        self.assertEqual(resolved.clause, "Moja własna klauzula rekrutacyjna.")

    def test_target_pages_1_budget(self):
        profile = self._create_sample_profile()
        resolved, rep = apply(profile, content_width=400, measure=mock_measure, target_pages=1)

        # target_pages=1 limits skills to min(8, 10) = 8
        self.assertEqual(len(resolved.skills), 8)
        # highest weights first: Skill 14 down to Skill 7
        self.assertEqual(resolved.skills[0].label, "Skill 14")
        self.assertEqual(resolved.skills[-1].label, "Skill 7")

        # target_pages=1 limits exps to min(3, 4) = 3
        self.assertEqual(len(resolved.experience), 3)
        self.assertEqual(rep.exp_kept, 3)
        self.assertEqual(rep.exp_dropped, 3)

    def test_target_pages_2_budget(self):
        profile = self._create_sample_profile()
        resolved, rep = apply(profile, content_width=400, measure=mock_measure, target_pages=2)

        # target_pages=2 allows up to 10 skills
        self.assertEqual(len(resolved.skills), 10)
        # target_pages=2 allows up to 4 exps
        self.assertEqual(len(resolved.experience), 4)
        self.assertEqual(rep.exp_kept, 4)
        self.assertEqual(rep.exp_dropped, 2)


if __name__ == "__main__":
    unittest.main()

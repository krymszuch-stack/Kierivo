"""Unit tests for MasterProfile data models."""

import json
import os
import tempfile
import unittest

from mvcv.data.model import (
    Bullet,
    Certification,
    Contact,
    Education,
    Experience,
    Language,
    MasterProfile,
    Skill,
    Summary,
    load_profile,
)


class TestContact(unittest.TestCase):
    def test_contact_from_dict_and_pairs(self):
        c = Contact.from_dict({
            "phone": "+48 123 456 789",
            "email": "test@example.com",
            "city": "Warszawa",
            "linkedin": "linkedin.com/in/test",
            "github": "github.com/test",
            "www": "https://test.io",
            "unknown_field": "ignored",
        })
        self.assertEqual(c.phone, "+48 123 456 789")
        self.assertEqual(c.email, "test@example.com")
        self.assertEqual(c.city, "Warszawa")
        self.assertEqual(c.linkedin, "linkedin.com/in/test")
        self.assertEqual(c.github, "github.com/test")
        self.assertEqual(c.www, "https://test.io")

        pairs = c.pairs()
        labels = [p[0] for p in pairs]
        self.assertEqual(labels, ["telefon", "e-mail", "lokalizacja", "LinkedIn", "GitHub", "WWW"])


class TestSkill(unittest.TestCase):
    def test_skill_from_dict(self):
        s = Skill.from_dict({
            "label": "Python",
            "semantic": "Python 3 and data engineering",
            "group": "core",
            "weight": 9,
        })
        self.assertEqual(s.label, "Python")
        self.assertEqual(s.semantic, "Python 3 and data engineering")
        self.assertEqual(s.group, "core")
        self.assertEqual(s.weight, 9)

    def test_skill_from_string_degradation(self):
        s = Skill.from_dict("PostgreSQL")
        self.assertEqual(s.label, "PostgreSQL")
        self.assertEqual(s.semantic, "PostgreSQL")
        self.assertEqual(s.group, "core")
        self.assertEqual(s.weight, 0)


class TestBullet(unittest.TestCase):
    def test_valid_bullet(self):
        b = Bullet(kind="result", display="Zwiększono wydajność o 25%", semantic="Szczegółowy opis")
        self.assertEqual(b.kind, "result")
        self.assertEqual(b.display, "Zwiększono wydajność o 25%")
        self.assertEqual(b.semantic, "Szczegółowy opis")

    def test_bullet_semantic_default(self):
        b = Bullet(kind="duty", display="Nadzór nad systemem")
        self.assertEqual(b.semantic, "Nadzór nad systemem")

    def test_bullet_invalid_kind(self):
        with self.assertRaises(ValueError):
            Bullet(kind="invalid_kind", display="Test")

    def test_bullet_from_string(self):
        b = Bullet.from_dict("Standardowy obowiązek")
        self.assertEqual(b.kind, "duty")
        self.assertEqual(b.display, "Standardowy obowiązek")
        self.assertEqual(b.semantic, "Standardowy obowiązek")


class TestExperience(unittest.TestCase):
    def test_experience_period_and_fields(self):
        e = Experience.from_dict({
            "role": "Senior Engineer",
            "company": "Tech Corp",
            "start": "01.2020",
            "end": "05.2023",
            "location": "Kraków",
            "bullets": [
                {"kind": "result", "display": "Migracja chmury", "semantic": "Migracja do GCP"}
            ],
            "tech": ["Python", "GCP"],
        })
        self.assertEqual(e.role, "Senior Engineer")
        self.assertEqual(e.company, "Tech Corp")
        self.assertEqual(e.period, "01.2020 – 05.2023")
        self.assertEqual(len(e.bullets), 1)
        self.assertEqual(e.bullets[0].kind, "result")
        self.assertEqual(e.tech, ["Python", "GCP"])


class TestMasterProfile(unittest.TestCase):
    def setUp(self):
        self.minimal_dict = {
            "name": "Jan Kowalski",
            "title": "Software Architect",
            "contact": {"email": "jan@example.pl"},
            "summary": {"display": "Krótkie podsumowanie", "semantic": "Długie podsumowanie"},
            "skills": [{"label": "Python", "semantic": "Python 3", "weight": 10}],
            "experience": [
                {
                    "role": "Lead Developer",
                    "company": "Firma X",
                    "start": "2020",
                    "bullets": [{"kind": "result", "display": "Sukces"}],
                }
            ],
            "education": [{"degree": "Mgr inż.", "school": "PW"}],
            "clause": "Klauzula zgody",
            "projects": [{"title": "Projekt 1"}],
            "interests": ["Automatyka"],
        }

    def test_from_dict_success(self):
        profile = MasterProfile.from_dict(self.minimal_dict)
        self.assertEqual(profile.name, "Jan Kowalski")
        self.assertEqual(profile.clause, "Klauzula zgody")
        self.assertEqual(len(profile.projects), 1)
        self.assertEqual(profile.interests, ["Automatyka"])
        self.assertEqual(profile.summary.semantic, "Długie podsumowanie")

    def test_from_dict_rodo_clause_fallback(self):
        data = dict(self.minimal_dict)
        del data["clause"]
        data["rodo_clause"] = "Fallback klauzula"
        profile = MasterProfile.from_dict(data)
        self.assertEqual(profile.clause, "Fallback klauzula")

    def test_missing_required_fields(self):
        data = dict(self.minimal_dict)
        del data["name"]
        with self.assertRaises(ValueError) as ctx:
            MasterProfile.from_dict(data)
        self.assertIn("name", str(ctx.exception))

    def test_load_profile_from_file(self):
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as f:
            json.dump(self.minimal_dict, f, ensure_ascii=False)
            path = f.name
        try:
            profile = load_profile(path)
            self.assertEqual(profile.name, "Jan Kowalski")
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()

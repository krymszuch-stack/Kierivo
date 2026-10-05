"""Integration tests for the full export pipeline and semantic verification."""

import json
import os
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pikepdf

from mvcv.pdfsem.metadata import _years_of_experience
from mvcv.pipeline import export
from mvcv.tools.verify import (
    actual_text_entries,
    embedded_json,
    has_invisible_text,
    jsonld_from_xmp,
    verify_pdf,
    visible_text,
)


class TestPipelineAndVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp(prefix="mvcv_test_")
        cls.sample_path = str(Path(__file__).parent.parent / "sample" / "mastervault.json")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def test_export_and_verify_default(self):
        out_pdf = os.path.join(self.temp_dir, "default_test.pdf")
        rep = export(
            self.sample_path,
            out_pdf,
            layout="sidebar",
            theme="editorial",
            target_pages=1,
            sidecar=True,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreater(os.path.getsize(out_pdf), 1000)
        self.assertLessEqual(rep.pages, 2)
        self.assertGreater(rep.actual_text_count, 0)
        self.assertGreater(rep.semantic_pairs, 0)

        # Check sidecar
        sidecar_path = os.path.join(self.temp_dir, "default_test.semantic.json")
        self.assertTrue(os.path.exists(sidecar_path))
        with open(sidecar_path, "r", encoding="utf-8") as f:
            sc_data = json.load(f)
        self.assertEqual(sc_data["theme"], "editorial")
        self.assertEqual(sc_data["layout"], "sidebar")
        self.assertIn("jsonld", sc_data)
        self.assertIn("visible_to_semantic", sc_data)

        # Run verify_pdf tool verification
        status = verify_pdf(out_pdf, strict=True)
        self.assertEqual(status, 0, "verify_pdf failed on generated PDF")

        # Deep inspection with pikepdf
        pdf = pikepdf.open(out_pdf)
        try:
            self.assertIn("/StructTreeRoot", pdf.Root)
            self.assertFalse(has_invisible_text(pdf), "Tr 3 invisible text detected")

            # Check /ActualText entries
            entries = actual_text_entries(pdf)
            self.assertGreater(len(entries), 5)

            # Nowe eksporty nie przenoszą pełnego MasterVault poza widocznym CV.
            emb = embedded_json(pdf)
            self.assertIsNone(emb)
            self.assertNotIn("/EmbeddedFiles", pdf.Root.get("/Names", {}))

            # Check JSON-LD in XMP
            jl = jsonld_from_xmp(pdf)
            self.assertIsNotNone(jl)
            self.assertEqual(jl.get("@type"), "Person")
            self.assertEqual(jl.get("name"), "Michał Kowalczyk")
            self.assertTrue(len(jl.get("knowsAbout", [])) > 0)
        finally:
            pdf.close()

    def test_export_actualtext_does_not_expand_unprovided_skill_claims(self):
        # Profil syntetyczny sprawdza warstwę, której rekruter nie widzi, ale
        # którą może indeksować ATS. Umiejętność ma pozostać jej źródłowym tekstem.
        profile_path = os.path.join(self.temp_dir, "truthful_semantics.json")
        profile_data = {
            "name": "Alicja Testowa",
            "title": "Specjalistka wsparcia IT",
            "contact": {},
            "summary": {"display": "", "semantic": ""},
            "skills": [
                {"label": "SQL", "semantic": "SQL", "group": "core", "weight": 8},
                {"label": "Microsoft 365", "semantic": "Microsoft 365", "group": "tooling", "weight": 6},
                {"label": "TCP/IP", "semantic": "TCP/IP", "group": "core", "weight": 8},
                {"label": "Excel", "semantic": "Excel", "group": "tooling", "weight": 6},
            ],
            "experience": [],
            "education": [],
            "certifications": [],
            "licenses": ["SEP G1 E1 do 1 kV — eksploatacja"],
            "projects": [{
                "name": "Projekt migracji stanowisk",
                "role": "koordynator",
                "description": "Przeniesienie 24 stanowisk do nowego obrazu systemu.",
                "techStack": ["Windows 11", "Intune"],
                "metrics": "24 stanowiska",
                "link": "https://example.invalid/projekty/migracja-stanowisk",
            }],
            "clause": "",
        }
        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(profile_data, f, ensure_ascii=False)

        out_pdf = os.path.join(self.temp_dir, "truthful_semantics.pdf")
        rep = export(profile_path, out_pdf, layout="single", theme="classic", target_pages=1, sidecar=False)
        self.assertEqual(rep.governance.skills_kept, 4, rep.governance.describe())

        pdf = pikepdf.open(out_pdf)
        try:
            semantics = "\n".join(entry["actual"] for entry in actual_text_entries(pdf))
            visible = visible_text(pdf)
            self.assertNotIn("profil", "".join(visible.casefold().split()))
            self.assertIn("SQL", visible)
            self.assertIn("Microsoft 365", visible)
            self.assertIn("TCP/IP", visible)
            self.assertIn("Excel", visible)
            self.assertIn("SEP G1 E1 do 1 kV", visible)
            self.assertIn("Projekt migracji stanowisk", visible)
            self.assertIn("koordynator", visible)
            self.assertIn("Przeniesienie 24 stanowisk do nowego obrazu systemu", visible)
            self.assertIn("Windows 11 · Intune", visible)
            self.assertIn("24 stanowiska", visible)
            self.assertIn("https://example.invalid/projekty/migracja-stanowisk", visible)
            self.assertNotRegex(semantics + visible, r"(?i)zaawansowan|udokumentowane zastosowanie|DDL/DML|optimiz")
            self.assertNotIn("Wyrażam zgodę na przetwarzanie", semantics + visible)
            self.assertFalse(has_invisible_text(pdf))
        finally:
            pdf.close()

        # Jawnie przekazany tekst może pozostać; brak tekstu nie jest zgodą.
        profile_data["clause"] = "Klauzula testowa przekazana jawnie przez użytkownika."
        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(profile_data, f, ensure_ascii=False)
        explicit_pdf = os.path.join(self.temp_dir, "explicit_clause.pdf")
        export(profile_path, explicit_pdf, layout="single", theme="classic", target_pages=1, sidecar=False)
        explicit_doc = pikepdf.open(explicit_pdf)
        try:
            self.assertIn(
                "Klauzula testowa przekazana jawnie przez użytkownika",
                visible_text(explicit_doc),
            )
        finally:
            explicit_doc.close()

    def test_export_has_no_visible_engine_watermark(self):
        out_pdf = os.path.join(self.temp_dir, "no_engine_watermark.pdf")
        export(
            self.sample_path,
            out_pdf,
            layout="sidebar",
            theme="classic",
            target_pages=1,
            sidecar=False,
        )

        pdf = pikepdf.open(out_pdf)
        try:
            text = "\n".join(visible_text(pdf))
            self.assertNotIn("MasterVault CV Engine", text)
            self.assertNotIn("2026-", text)
        finally:
            pdf.close()

    def test_years_of_experience_uses_finished_and_non_overlapping_periods(self):
        profile = SimpleNamespace(experience=[
            SimpleNamespace(start="01.2020", end="01.2022"),
            SimpleNamespace(start="01.2021", end="01.2023"),
            SimpleNamespace(start="01.2024", end="01.2025"),
        ])

        self.assertEqual(_years_of_experience(profile, today=date(2026, 9, 1)), 4)

    def test_unknown_end_date_is_not_assumed_to_be_current(self):
        profile = SimpleNamespace(experience=[SimpleNamespace(start="01.2022", end="")])

        self.assertEqual(_years_of_experience(profile, today=date(2026, 9, 1)), 0)

    def test_explicit_current_job_counts_through_today(self):
        profile = SimpleNamespace(experience=[SimpleNamespace(start="01.2025", end="obecnie")])

        self.assertEqual(_years_of_experience(profile, today=date(2026, 9, 1)), 1)

    def test_export_single_column(self):
        out_pdf = os.path.join(self.temp_dir, "single_test.pdf")
        rep = export(
            self.sample_path,
            out_pdf,
            layout="single",
            theme="classic",
            target_pages=1,
            sidecar=False,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertEqual(rep.layout, "single")
        self.assertEqual(verify_pdf(out_pdf, strict=True), 0)

    def test_export_sidebar_right(self):
        out_pdf = os.path.join(self.temp_dir, "right_test.pdf")
        rep = export(
            self.sample_path,
            out_pdf,
            layout="sidebar-right",
            theme="cobalt",
            target_pages=1,
            sidecar=False,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertEqual(rep.layout, "sidebar-right")
        self.assertEqual(verify_pdf(out_pdf, strict=True), 0)

    def test_export_banner_sidebar(self):
        out_pdf = os.path.join(self.temp_dir, "banner_test.pdf")
        rep = export(
            self.sample_path,
            out_pdf,
            layout="banner-sidebar",
            theme="sand",
            target_pages=1,
            sidecar=False,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertEqual(rep.layout, "banner-sidebar")
        self.assertEqual(verify_pdf(out_pdf, strict=True), 0)

    def test_export_target_pages_2(self):
        out_pdf = os.path.join(self.temp_dir, "pages2_test.pdf")
        rep = export(
            self.sample_path,
            out_pdf,
            layout="sidebar",
            theme="parchment",
            target_pages=2,
            sidecar=False,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertEqual(verify_pdf(out_pdf, strict=True), 0)

    def test_export_with_photo(self):
        from PIL import Image

        img_path = os.path.join(self.temp_dir, "test_candidate.jpg")
        img = Image.new("RGB", (200, 240), color=(50, 100, 180))
        img.save(img_path, format="JPEG")

        with open(self.sample_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["photo"] = img_path
        profile_with_photo = os.path.join(self.temp_dir, "profile_photo.json")
        with open(profile_with_photo, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

        out_pdf = os.path.join(self.temp_dir, "photo_export.pdf")
        rep = export(
            profile_with_photo,
            out_pdf,
            layout="banner-sidebar",
            theme="parchment",
            target_pages=1,
            sidecar=False,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertEqual(verify_pdf(out_pdf, strict=True), 0)

    def test_export_auto_balancing_fits_single_page(self):
        # Profil z wieloma doświadczeniami i umiejętnościami
        with open(self.sample_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Zduplikujmy doświadczenie aby wywołać presję na objętość
        data["experience"] = data.get("experience", []) * 2
        dense_profile = os.path.join(self.temp_dir, "dense_profile.json")
        with open(dense_profile, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

        out_pdf = os.path.join(self.temp_dir, "dense_1page.pdf")
        rep = export(
            dense_profile,
            out_pdf,
            layout="sidebar",
            theme="editorial",
            target_pages=1,
            sidecar=False,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertEqual(rep.pages, 1, "Auto-balancing powinien zagwarantować dokładnie 1 stronę bez sierot")
        self.assertEqual(verify_pdf(out_pdf, strict=True), 0)


if __name__ == "__main__":
    unittest.main()

"""Integration tests for the full export pipeline and semantic verification."""

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import pikepdf

from mvcv.pipeline import export
from mvcv.tools.verify import (
    actual_text_entries,
    embedded_json,
    has_invisible_text,
    jsonld_from_xmp,
    verify_pdf,
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

            # Check embedded JSON
            emb = embedded_json(pdf)
            self.assertIsNotNone(emb)
            self.assertIn("masterVaultRecord", emb)
            resume_data = emb["masterVaultRecord"]["resumeData"]
            self.assertEqual(resume_data.get("name"), "Michał Kowalczyk")
            self.assertIn("clause", resume_data)

            # Check JSON-LD in XMP
            jl = jsonld_from_xmp(pdf)
            self.assertIsNotNone(jl)
            self.assertEqual(jl.get("@type"), "Person")
            self.assertEqual(jl.get("name"), "Michał Kowalczyk")
            self.assertTrue(len(jl.get("knowsAbout", [])) > 0)
        finally:
            pdf.close()

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


if __name__ == "__main__":
    unittest.main()

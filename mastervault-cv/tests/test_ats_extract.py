import unittest

from mvcv.tools.ats_extract import detect_sections


class AtsExtractSectionTests(unittest.TestCase):
    def test_detects_letter_spaced_polish_headers_from_pdfminer(self):
        sections = detect_sections(
            "P R O F I L\nOpis\n"
            "D O Ś W I A D C Z E N I E\nStanowisko\n"
            "W Y K S Z T A Ł C E N I E\nSzkoła\n"
            "K O N T A K T\nkontakt@example.com\n"
            "K O M P E T E N C J E\nWindows 11\n"
        )

        self.assertEqual(
            set(sections),
            {"summary", "experience", "education", "contact", "skills"},
        )


if __name__ == "__main__":
    unittest.main()

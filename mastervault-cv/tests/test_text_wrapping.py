import unittest

from mvcv.render.text import text_width, wrap_text


class TestLongTokenWrapping(unittest.TestCase):
    def test_break_long_words_preserves_full_url_and_fits_column(self):
        url = "https://example.invalid/in/a-very-long-profile-address-with-many-characters"

        lines = wrap_text(url, "Helvetica", 8, 42, break_long_words=True)

        self.assertGreater(len(lines), 1)
        self.assertEqual("".join(lines), url)
        self.assertTrue(all(text_width(line, "Helvetica", 8) <= 42 for line in lines))

    def test_default_long_word_policy_remains_unchanged(self):
        token = "https://example.invalid/in/a-very-long-profile-address"

        lines = wrap_text(token, "Helvetica", 8, 42)

        self.assertTrue(lines[-1].endswith("…"))
        self.assertNotEqual("".join(lines), token)

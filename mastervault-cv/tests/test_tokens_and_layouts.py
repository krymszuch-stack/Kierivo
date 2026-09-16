"""Unit tests for design tokens and layout presets."""

import re
import unittest

from mvcv.design.layouts import LAYOUTS, LayoutPreset, get_layout
from mvcv.design.tokens import THEMES, ResumeTheme, get_theme

HEX_COLOR_REGEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


class TestTokensAndThemes(unittest.TestCase):
    def test_all_33_themes_exist(self):
        self.assertEqual(len(THEMES), 33)

    def test_theme_properties_and_colors(self):
        for name, theme in THEMES.items():
            with self.subTest(theme=name):
                self.assertIsInstance(theme, ResumeTheme)
                self.assertEqual(theme.name, name)
                retrieved = get_theme(name)
                self.assertEqual(retrieved.name, name)

                # Validate colors
                c = theme.colors
                for color_field in [
                    "bg_main", "sidebar_bg", "sidebar_text", "sidebar_muted",
                    "text_primary", "text_secondary", "accent", "accent_alt",
                    "accent_soft", "accent_border", "on_accent", "border", "hairline"
                ]:
                    val = getattr(c, color_field)
                    self.assertTrue(
                        HEX_COLOR_REGEX.match(val),
                        f"Theme {name} field {color_field} has invalid hex: {val}",
                    )
                    # Verify rgb() method works
                    rgb = c.rgb(color_field)
                    self.assertEqual(len(rgb), 3)
                    for channel in rgb:
                        self.assertTrue(0.0 <= channel <= 1.0)

                # Validate bg_gradient
                self.assertEqual(len(c.bg_gradient), 2)
                for grad_color in c.bg_gradient:
                    self.assertTrue(HEX_COLOR_REGEX.match(grad_color))

    def test_unknown_theme_raises_keyerror(self):
        with self.assertRaises(KeyError):
            get_theme("non_existent_theme")


class TestLayouts(unittest.TestCase):
    def test_layouts_exist(self):
        expected = [
            "single", "sidebar", "sidebar-30", "sidebar-35", "sidebar-wide",
            "sidebar-right", "banner-sidebar", "banner-right", "two-column", "asymmetric"
        ]
        for name in expected:
            with self.subTest(layout=name):
                ly = get_layout(name)
                self.assertIsInstance(ly, LayoutPreset)
                self.assertEqual(ly.name, name)
                self.assertIn(ly.sidebar_pos, ("left", "right"))
                self.assertIsInstance(ly.has_banner, bool)

    def test_single_column_properties(self):
        single = get_layout("single")
        self.assertEqual(single.kind, "single")
        self.assertEqual(single.sidebar_ratio, 0.0)

    def test_sidebar_right_properties(self):
        right = get_layout("sidebar-right")
        self.assertEqual(right.sidebar_pos, "right")
        self.assertGreater(right.sidebar_ratio, 0.0)

    def test_banner_sidebar_properties(self):
        banner = get_layout("banner-sidebar")
        self.assertTrue(banner.has_banner)

    def test_unknown_layout_raises_keyerror(self):
        with self.assertRaises(KeyError):
            get_layout("unknown_layout_preset")


if __name__ == "__main__":
    unittest.main()

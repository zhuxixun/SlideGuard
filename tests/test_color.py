"""Tests for color utility functions."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.utils.color import (
    rgb_to_hex, hex_to_rgb, relative_luminance,
    contrast_ratio, is_low_contrast, color_distance,
    is_light_color, parse_pptx_color,
)


def test_rgb_to_hex():
    assert rgb_to_hex(255, 255, 255) == "#FFFFFF"
    assert rgb_to_hex(0, 0, 0) == "#000000"
    assert rgb_to_hex(255, 0, 0) == "#FF0000"
    assert rgb_to_hex(0, 255, 0) == "#00FF00"
    assert rgb_to_hex(0, 0, 255) == "#0000FF"
    assert rgb_to_hex(26, 78, 121) == "#1A4E79"


def test_hex_to_rgb():
    assert hex_to_rgb("#FFFFFF") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)
    assert hex_to_rgb("#FF0000") == (255, 0, 0)
    assert hex_to_rgb("1A4E79") == (26, 78, 121)

    # Shorthand hex
    assert hex_to_rgb("#FFF") == (255, 255, 255)
    assert hex_to_rgb("#F00") == (255, 0, 0)

    # Invalid
    assert hex_to_rgb("#XYZ123") is None
    assert hex_to_rgb("") is None
    assert hex_to_rgb("#FFFF") is None


def test_relative_luminance():
    # Black
    assert relative_luminance(0, 0, 0) == 0.0
    # White
    assert abs(relative_luminance(255, 255, 255) - 1.0) < 0.001
    # Red
    lum_red = relative_luminance(255, 0, 0)
    assert 0.2 < lum_red < 0.3


def test_contrast_ratio():
    # Black on white = max contrast
    assert abs(contrast_ratio((0, 0, 0), (255, 255, 255)) - 21.0) < 0.1
    # Same color = min contrast
    assert abs(contrast_ratio((255, 0, 0), (255, 0, 0)) - 1.0) < 0.01


def test_is_low_contrast():
    # Light gray on white should be low contrast
    assert is_low_contrast("#CCCCCC", "#FFFFFF", 4.5)
    # Black on white should be fine
    assert not is_low_contrast("#000000", "#FFFFFF", 4.5)
    # Invalid colors return False
    assert not is_low_contrast("invalid", "#FFFFFF")


def test_color_distance():
    # Same color
    assert color_distance("#FF0000", "#FF0000") == 0.0
    # Black to white
    assert color_distance("#000000", "#FFFFFF") > 0
    # Invalid returns infinity
    assert color_distance("notacolor", "#FFFFFF") == float('inf')


def test_is_light_color():
    assert is_light_color("#FFFFFF")
    assert is_light_color("#FFFF00")
    assert not is_light_color("#000000")
    assert not is_light_color("#1A4E79")
    # Invalid returns False
    assert not is_light_color("garbage")


def test_parse_pptx_color_none():
    assert parse_pptx_color(None) is None

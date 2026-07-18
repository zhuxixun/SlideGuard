"""Color analysis utilities."""

import re
from typing import Optional


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB values to hex string."""
    return f"#{r:02X}{g:02X}{b:02X}"


def hex_to_rgb(hex_color: str) -> Optional[tuple]:
    """Convert hex color string to (R, G, B) tuple."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        return None
    try:
        return (int(hex_color[0:2], 16),
                int(hex_color[2:4], 16),
                int(hex_color[4:6], 16))
    except ValueError:
        return None


def relative_luminance(r: int, g: int, b: int) -> float:
    """Calculate relative luminance per WCAG 2.1."""
    def linearize(c: float) -> float:
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)


def contrast_ratio(c1: tuple, c2: tuple) -> float:
    """Calculate contrast ratio between two colors (WCAG 2.1)."""
    l1 = relative_luminance(*c1)
    l2 = relative_luminance(*c2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def is_low_contrast(color_hex: str, bg_color_hex: str = "#FFFFFF",
                    threshold: float = 4.5) -> bool:
    """Check if text color has sufficient contrast against background."""
    c1 = hex_to_rgb(color_hex)
    c2 = hex_to_rgb(bg_color_hex)
    if not c1 or not c2:
        return False
    return contrast_ratio(c1, c2) < threshold


def color_distance(c1_hex: str, c2_hex: str) -> float:
    """Calculate perceptual color distance (simple Euclidean in RGB)."""
    c1 = hex_to_rgb(c1_hex)
    c2 = hex_to_rgb(c2_hex)
    if not c1 or not c2:
        return float('inf')
    return ((c1[0] - c2[0])**2 + (c1[1] - c2[1])**2 + (c1[2] - c2[2])**2) ** 0.5


def is_light_color(color_hex: str) -> bool:
    """Check if a color is light (low contrast on white)."""
    rgb = hex_to_rgb(color_hex)
    if not rgb:
        return False
    return relative_luminance(*rgb) > 0.5


def parse_pptx_color(color_obj) -> Optional[str]:
    """Extract hex color from python-pptx color object.

    Handles various color types: RGB, theme color, etc.
    """
    if color_obj is None:
        return None

    # Try direct RGB access first (works for both explicit and inherited)
    try:
        rgb = color_obj.rgb
        if rgb:
            return f"#{rgb}"
    except ValueError:
        pass  # RGB not available (e.g., theme color reference)
    except AttributeError:
        pass

    # Try checking type
    try:
        color_type = color_obj.type
        if color_type is not None and color_type.__class__.__name__ == 'MSO_THEME_COLOR':
            return None  # Theme color, can't resolve to hex
    except Exception:
        pass

    return None

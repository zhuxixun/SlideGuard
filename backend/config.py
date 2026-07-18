"""Default rule configuration for SlideGuard."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RuleConfig:
    """Default rules and thresholds for PPT quality checking."""

    # Page settings
    standard_page_width: float = 13.333  # inches (16:9)
    standard_page_height: float = 7.5
    page_aspect_ratio: str = "16:9"
    aspect_ratio_tolerance: float = 0.02

    # Font settings
    standard_fonts: set = field(default_factory=lambda: {
        "微软雅黑", "Microsoft YaHei", "Microsoft YaHei UI",
        "宋体", "SimSun",
        "黑体", "SimHei",
        "Arial", "Times New Roman", "Calibri",
    })
    min_body_font_size: int = 10  # pt
    min_footnote_font_size: int = 8
    max_title_font_size: int = 44
    title_font_sizes: dict = field(default_factory=lambda: {
        "level_1": 28,
        "level_2": 22,
        "level_3": 18,
    })
    title_font_size_tolerance: int = 2  # pt tolerance

    # Color settings
    standard_colors: set = field(default_factory=lambda: {
        # Common business standard colors
        "#000000",  # Black
        "#FFFFFF",  # White
        "#333333",  # Dark gray (body text)
        "#666666",  # Medium gray
        "#999999",  # Light gray
        "#1F4E79",  # Dark blue (common enterprise)
        "#2E75B6",  # Medium blue
        "#4472C4",  # Office blue
        "#5B9BD5",  # Light blue
        "#ED7D31",  # Orange (accent)
        "#FFC000",  # Yellow (accent)
        "#70AD47",  # Green (accent)
        "#C00000",  # Red (accent)
    })
    max_colors_per_page: int = 6
    min_text_contrast_ratio: float = 4.5  # WCAG AA for normal text

    # Layout settings
    alignment_tolerance: float = 1.0  # pt tolerance for alignment
    spacing_tolerance: float = 1.5  # pt tolerance for spacing
    page_margin_min: float = 0.3  # inches (minimum content margin)
    overlap_threshold: float = 0.1  # 10% overlap allowed
    density_warning_threshold: float = 0.75  # 75% coverage triggers warning
    density_critical_threshold: float = 0.90  # 90% is critical

    # Image settings
    min_image_dpi: int = 96  # minimum effective DPI
    image_stretch_tolerance: float = 0.05  # 5% ratio difference allowed
    min_image_display_size: int = 10000  # minimum display area in px²

    # Page settings
    min_text_chars_for_content: int = 20
    max_blank_page_elements: int = 1  # more than this = not blank

    # Scoring weights
    score_weights: dict = field(default_factory=lambda: {
        "document_integrity": 0.20,
        "text_standardization": 0.20,
        "layout_quality": 0.25,
        "cross_page_consistency": 0.20,
        "image_chart_quality": 0.15,
    })

    # Severity deduction points
    severity_deduction: dict = field(default_factory=lambda: {
        "S1": 15,
        "S2": 8,
        "S3": 4,
        "S4": 2,
    })

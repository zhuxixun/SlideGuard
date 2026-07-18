"""Image quality checkers: stretching, clarity, out-of-bounds."""

from typing import List
from backend.rules.base_checker import BaseChecker
from backend.models.issue import Issue
from backend.parsers import PptxData


class ImageStretchChecker(BaseChecker):
    """Check for stretched/distorted images."""

    @property
    def name(self) -> str:
        return "图片拉伸检查"

    def __init__(self, config):
        self.config = config
        self.tolerance = config.image_stretch_tolerance

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            for img in slide.images:
                if img.image_width <= 0 or img.image_height <= 0:
                    continue

                # Calculate aspect ratios
                original_ratio = img.image_width / img.image_height
                display_ratio = img.width / img.height if img.height > 0 else 0

                if display_ratio <= 0:
                    continue

                ratio_diff = abs(original_ratio - display_ratio) / max(original_ratio, display_ratio)

                if ratio_diff > self.tolerance:
                    issues.append(self._make_issue(
                        "IMG-001", "图片拉伸", "S2",
                        f"图片宽高比异常（原始 {original_ratio:.2f}，显示 {display_ratio:.2f}）",
                        f"图片「{img.name}」显示尺寸 {img.width:.1f}x{img.height:.1f}in，原始尺寸 {img.image_width}x{img.image_height}px",
                        "修正图片比例，还原原始宽高比",
                        slide.slide_index,
                        actual=f"显示比例 {display_ratio:.2f}",
                        expected=f"原始比例 {original_ratio:.2f}",
                        auto_fixable=True,
                        fix_type="image_ratio_fix",
                        fix_params={
                            "shape_id": img.shape_id,
                            "original_width": img.image_width,
                            "original_height": img.image_height,
                            "display_width": img.width,
                            "display_height": img.height,
                        },
                    ))

        return issues


class ImageQualityChecker(BaseChecker):
    """Check image clarity/resolution."""

    @property
    def name(self) -> str:
        return "图片清晰度检查"

    @property
    def is_quick(self) -> bool:
        return False

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            for img in slide.images:
                if img.image_width <= 0 or img.image_height <= 0:
                    continue

                # Calculate effective DPI
                dpi_x = img.image_width / (img.width) if img.width > 0 else 0
                dpi_y = img.image_height / (img.height) if img.height > 0 else 0
                effective_dpi = min(dpi_x, dpi_y)

                if effective_dpi < self.config.min_image_dpi:
                    issues.append(self._make_issue(
                        "IMG-002", "图片清晰度不足", "S4",
                        f"图片有效分辨率约 {effective_dpi:.0f} DPI，低于建议值 {self.config.min_image_dpi} DPI",
                        f"图片「{img.name}」原始尺寸 {img.image_width}x{img.image_height}px，显示尺寸 {img.width:.1f}x{img.height:.1f}in",
                        "使用更高分辨率的图片",
                        slide.slide_index,
                        actual=f"{effective_dpi:.0f} DPI",
                        expected=f"≥{self.config.min_image_dpi} DPI",
                    ))

        return issues


class ImageBoundChecker(BaseChecker):
    """Check if images extend beyond the page."""

    @property
    def name(self) -> str:
        return "图片越界检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        page_w = pptx_data.slide_width
        page_h = pptx_data.slide_height

        for slide in pptx_data.slides:
            for img in slide.images:
                is_outside = False
                side = ""

                if img.left + img.width > page_w + 0.1:
                    is_outside = True
                    side = "超出右边界"
                elif img.left < -0.1:
                    is_outside = True
                    side = "超出左边界"
                elif img.top + img.height > page_h + 0.1:
                    is_outside = True
                    side = "超出下边界"
                elif img.top < -0.1:
                    is_outside = True
                    side = "超出上边界"

                if is_outside:
                    issues.append(self._make_issue(
                        "IMG-003", "图片超出页面", "S2",
                        f"图片{side}",
                        f"图片「{img.name}」位置 ({img.left:.1f}, {img.top:.1f}) 超出页面范围",
                        "将图片移入页面内",
                        slide.slide_index,
                        auto_fixable=True,
                        fix_type="move_into_page",
                        fix_params={
                            "left": max(0, min(img.left, page_w - img.width)),
                            "top": max(0, min(img.top, page_h - img.height)),
                        },
                    ))

        return issues

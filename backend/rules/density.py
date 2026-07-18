"""Page density checker - detect overcrowded slides."""

from typing import List
from backend.rules.base_checker import BaseChecker
from backend.models.issue import Issue
from backend.parsers import PptxData


class DensityChecker(BaseChecker):
    """Check page content density and warn on overcrowded slides."""

    @property
    def name(self) -> str:
        return "页面内容密度检查"

    @property
    def is_quick(self) -> bool:
        return False

    def __init__(self, config):
        self.config = config
        self.density_warning = config.density_warning_threshold
        self.density_critical = config.density_critical_threshold

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        page_area = pptx_data.slide_width * pptx_data.slide_height

        for slide in pptx_data.slides:
            total_text_chars = 0
            total_shape_area = 0
            shape_count = 0
            min_font_size = 999

            for shape in slide.shapes:
                if shape.has_text:
                    chars = sum(len(t.text) for t in shape.text_elements)
                    total_text_chars += chars

                    for t in shape.text_elements:
                        if t.font_size and t.font_size < min_font_size:
                            min_font_size = t.font_size

                shape_area = shape.width * shape.height
                total_shape_area += shape_area
                shape_count += 1

            # Add image area
            for img in slide.images:
                total_shape_area += img.width * img.height
                shape_count += 1

            coverage_ratio = total_shape_area / page_area if page_area > 0 else 0

            if coverage_ratio > self.density_critical:
                issues.append(self._make_issue(
                    "DENSE-001", "页面内容过密", "S4",
                    f"页面内容覆盖率达 {coverage_ratio:.0%}，超过临界值 {self.density_critical:.0%}",
                    f"{shape_count} 个元素，{total_text_chars} 字符，覆盖 {coverage_ratio:.0%} 页面",
                    "考虑精简内容或拆分到多页",
                    slide.slide_index,
                    actual=f"覆盖率 {coverage_ratio:.0%}",
                    expected=f"≤{self.density_critical:.0%}",
                ))
            elif coverage_ratio > self.density_warning:
                issues.append(self._make_issue(
                    "DENSE-002", "页面内容偏多", "S4",
                    f"页面内容覆盖率达 {coverage_ratio:.0%}，超过建议值 {self.density_warning:.0%}",
                    f"{shape_count} 个元素，{total_text_chars} 字符，覆盖 {coverage_ratio:.0%} 页面",
                    "考虑适当精简或调整布局",
                    slide.slide_index,
                    actual=f"覆盖率 {coverage_ratio:.0%}",
                    expected=f"≤{self.density_warning:.0%}",
                ))

        return issues

"""Layout and alignment checkers."""

from typing import List
from itertools import combinations

from backend.rules.base_checker import BaseChecker
from backend.models.issue import Issue
from backend.parsers import PptxData, SlideData
from backend.utils.geometry import check_overlap, check_alignment, check_spacing


class AlignmentChecker(BaseChecker):
    """Check element alignment (left, right, top, bottom, center)."""

    @property
    def name(self) -> str:
        return "元素对齐检查"

    def __init__(self, config):
        self.config = config
        self.tolerance = config.alignment_tolerance

    def _find_element_groups(self, slide: SlideData) -> list:
        """Group similar elements (same type, similar size)."""
        shapes = slide.shapes
        if len(shapes) < 2:
            return []

        groups = []
        used = set()

        for i, a in enumerate(shapes):
            if i in used:
                continue
            group = [i]
            used.add(i)
            for j, b in enumerate(shapes):
                if j in used:
                    continue
                # Same type and similar size = likely same group
                if (a.shape_type == b.shape_type and
                    abs(a.width - b.width) < 2.0 and
                    abs(a.height - b.height) < 2.0):
                    # Check if vertically or horizontally aligned
                    h_gap = abs(a.top - b.top)
                    v_gap = abs(a.left - b.left)
                    if h_gap < a.height * 1.5 or v_gap < a.width * 1.5:
                        group.append(j)
                        used.add(j)
            if len(group) >= 2:
                groups.append([shapes[i] for i in group])

        return groups

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            groups = self._find_element_groups(slide)

            for group_idx, group in enumerate(groups):
                els = [{
                    'left': s.left, 'top': s.top,
                    'width': s.width, 'height': s.height
                } for s in group]

                # Check horizontal alignment
                for align_type, axis_name in [
                    ('left', '左'), ('right', '右'), ('center_h', '水平居中'),
                ]:
                    mis_aligned = check_alignment(els, align_type, self.tolerance)
                    if mis_aligned:
                        for idx, dev in mis_aligned[:3]:  # limit per group
                            issues.append(self._make_issue(
                                "ALIGN-001", f"元素未{axis_name}对齐", "S3",
                                f"元素未{axis_name}对齐（偏差 {dev:.1f}pt）",
                                f"第{group_idx+1}组中元素位置偏差 {dev:.1f}pt",
                                f"统一{axis_name}对齐",
                                slide.slide_index, group[idx],
                                actual=f"偏差 {dev:.1f}pt",
                                expected=f"偏差 ≤{self.tolerance}pt",
                                auto_fixable=True,
                                fix_type="align",
                                fix_params={"alignment": align_type, "group": group_idx},
                            ))

                # Check vertical alignment
                for align_type, axis_name in [
                    ('top', '顶'), ('bottom', '底'), ('center_v', '垂直居中'),
                ]:
                    mis_aligned = check_alignment(els, align_type, self.tolerance)
                    if mis_aligned:
                        for idx, dev in mis_aligned[:3]:
                            issues.append(self._make_issue(
                                "ALIGN-002", f"元素未{axis_name}对齐", "S3",
                                f"元素未{axis_name}对齐（偏差 {dev:.1f}pt）",
                                f"第{group_idx+1}组中元素位置偏差 {dev:.1f}pt",
                                f"统一{axis_name}对齐",
                                slide.slide_index, group[idx],
                                actual=f"偏差 {dev:.1f}pt",
                                expected=f"偏差 ≤{self.tolerance}pt",
                                auto_fixable=True,
                                fix_type="align",
                                fix_params={"alignment": align_type, "group": group_idx},
                            ))

        return issues


class SpacingChecker(BaseChecker):
    """Check spacing consistency between elements."""

    @property
    def name(self) -> str:
        return "元素间距检查"

    def __init__(self, config):
        self.config = config
        self.tolerance = config.spacing_tolerance

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            shapes = slide.shapes
            if len(shapes) < 3:
                continue

            # Check horizontal spacing
            els = [{'left': s.left, 'top': s.top,
                    'width': s.width, 'height': s.height} for s in shapes]

            h_results = check_spacing(els, 'horizontal', self.tolerance)
            if h_results:
                # Show first spacing issue
                gap, dev = h_results[0]
                issues.append(self._make_issue(
                    "SPACE-001", "元素间距不一致", "S3",
                    f"水平间距不均（偏差 {dev:.1%}）",
                    f"元素间间距差异较大",
                    "统一元素间距",
                    slide.slide_index, shapes[0],
                    actual=f"间距偏差 {dev:.1%}",
                    expected="间距一致",
                    auto_fixable=False,
                    fix_type="spacing_fix",
                    fix_params={},
                ))

            v_results = check_spacing(els, 'vertical', self.tolerance)
            if v_results:
                gap, dev = v_results[0]
                issues.append(self._make_issue(
                    "SPACE-002", "元素间距不一致", "S3",
                    f"垂直间距不均（偏差 {dev:.1%}）",
                    f"元素间垂直间距差异较大",
                    "统一元素间距",
                    slide.slide_index, shapes[0],
                    actual=f"间距偏差 {dev:.1%}",
                    expected="间距一致",
                    auto_fixable=False,
                ))

        return issues


class OverlapChecker(BaseChecker):
    """Check element overlap."""

    @property
    def name(self) -> str:
        return "元素重叠检查"

    def __init__(self, config):
        self.config = config
        self.threshold = config.overlap_threshold

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            shapes = slide.shapes
            for i, j in combinations(range(len(shapes)), 2):
                a, b = shapes[i], shapes[j]

                # Skip small elements (decorations)
                if a.width * a.height < 0.01 or b.width * b.height < 0.01:
                    continue

                ratio = check_overlap(a.left, a.top, a.width, a.height,
                                      b.left, b.top, b.width, b.height)

                if ratio > self.threshold:
                    issues.append(self._make_issue(
                        "OVERLAP-001", "元素重叠", "S3",
                        f"两个元素重叠面积 {ratio:.0%}",
                        f"「{a.name}」与「{b.name}」重叠",
                        "调整位置避免重叠",
                        slide.slide_index, a,
                        actual=f"重叠 {ratio:.0%}",
                        expected=f"重叠 ≤{self.threshold:.0%}",
                    ))
                    # Only report first 5 overlaps per slide to avoid spam
                    if len(issues) >= 5:
                        break
                if len(issues) >= 5:
                    break

        return issues


class MarginChecker(BaseChecker):
    """Check content proximity to page edges."""

    @property
    def name(self) -> str:
        return "页面边距检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        min_margin = self.config.page_margin_min
        page_w = pptx_data.slide_width
        page_h = pptx_data.slide_height

        for slide in pptx_data.slides:
            for shape in slide.shapes:
                # Skip very small shapes (likely decorations)
                if shape.width < 0.2 or shape.height < 0.2:
                    continue

                if shape.left < min_margin:
                    issues.append(self._make_issue(
                        "MARGIN-001", "元素距左边界过近", "S3",
                        f"元素距左边界 {shape.left:.2f}in，低于建议 {min_margin}in",
                        f"形状「{shape.name}」距左边界 {shape.left:.2f}in",
                        "向右移动",
                        slide.slide_index, shape,
                        actual=f"{shape.left:.2f}in",
                        expected=f"≥{min_margin}in",
                        auto_fixable=True,
                        fix_type="move",
                        fix_params={"dx": min_margin - shape.left, "dy": 0},
                    ))
                elif shape.left + shape.width > page_w - min_margin:
                    issues.append(self._make_issue(
                        "MARGIN-002", "元素距右边界过近", "S3",
                        f"元素距右边界 {(page_w - shape.left - shape.width):.2f}in，低于建议 {min_margin}in",
                        f"形状「{shape.name}」距右边界 {(page_w - shape.left - shape.width):.2f}in",
                        "向左移动",
                        slide.slide_index, shape,
                        actual=f"{(page_w - shape.left - shape.width):.2f}in",
                        expected=f"≥{min_margin}in",
                        auto_fixable=True,
                    ))

        return issues


class TextOverflowChecker(BaseChecker):
    """Check text overflow in shapes."""

    @property
    def name(self) -> str:
        return "文本溢出检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            for shape in slide.shapes:
                if not shape.has_text or not shape.text_overflow:
                    continue

                text_len = sum(len(t.text) for t in shape.text_elements)
                issues.append(self._make_issue(
                    "TEXT-OVF-001", "文本可能溢出", "S2",
                    f"形状中文本可能被截断",
                    f"形状「{shape.name}」({shape.width:.1f}x{shape.height:.1f}in) 包含约 {text_len} 字符",
                    "扩大形状或精简文本",
                    slide.slide_index, shape,
                    auto_fixable=False,
                ))

        return issues

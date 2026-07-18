"""Page-level checkers: blank pages, off-page elements, page size."""

from typing import List
from backend.rules.base_checker import BaseChecker
from backend.models.issue import Issue
from backend.parsers import PptxData
from backend.utils.geometry import is_within_page


class PageSizeChecker(BaseChecker):
    """Check page aspect ratio is 16:9."""

    @property
    def name(self) -> str:
        return "页面尺寸检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        ratio = pptx_data.slide_width / pptx_data.slide_height
        target_ratio = 16.0 / 9.0

        if abs(ratio - target_ratio) > self.config.aspect_ratio_tolerance:
            issues.append(self._make_issue(
                "PAGE-001", "页面比例非16:9", "S2",
                f"页面比例为 {ratio:.2f}:1，非标准 16:9",
                f"页面尺寸 {pptx_data.slide_width:.1f}x{pptx_data.slide_height:.1f} 英寸",
                "建议在 PowerPoint 中调整为 16:9",
                0,  # document level
                actual=f"{ratio:.2f}:1",
                expected="16:9",
            ))

        return issues


class BlankPageChecker(BaseChecker):
    """Identify blank or near-blank pages."""

    @property
    def name(self) -> str:
        return "空白页面检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        min_chars = self.config.min_text_chars_for_content

        for slide in pptx_data.slides:
            # Skip first slide (usually cover/title)
            if slide.slide_index == 0:
                continue

            # Count elements with actual content
            content_elements = 0
            total_chars = 0
            has_meaningful_image = False
            has_title = False

            for shape in slide.shapes:
                if shape.has_text:
                    chars = sum(len(t.text) for t in shape.text_elements)
                    if chars > 0:
                        content_elements += 1
                        total_chars += chars
                        # Check if any text is title-like (has reasonable size)
                        for t in shape.text_elements:
                            if t.font_size and t.font_size >= 18:
                                has_title = True

            # Check images
            for img in slide.images:
                if img.image_width > 100 and img.image_height > 100:
                    has_meaningful_image = True
                    content_elements += 1

            is_blank = (total_chars < min_chars and
                       not has_meaningful_image and
                       not has_title and
                       content_elements <= 2)

            if is_blank:
                issues.append(self._make_issue(
                    "PAGE-002", "空白页面", "S2",
                    "页面内容为空或仅含装饰元素",
                    f"仅含 {content_elements} 个元素，共 {total_chars} 字符",
                    "删除此页或添加内容",
                    slide.slide_index,
                    actual=f"{total_chars}字符",
                    expected=f"≥{min_chars}字符",
                    auto_fixable=True,
                    fix_type="delete_slide",
                    fix_params={"slide_index": slide.slide_index},
                ))

        return issues


class OffPageChecker(BaseChecker):
    """Check for elements partially or fully outside the page."""

    @property
    def name(self) -> str:
        return "页面外元素检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        page_w = pptx_data.slide_width
        page_h = pptx_data.slide_height
        margin = 0.1  # small tolerance

        for slide in pptx_data.slides:
            for shape in slide.shapes:
                if shape.width < 0.05 or shape.height < 0.05:
                    continue  # skip tiny shapes

                el = {'left': shape.left, 'top': shape.top,
                      'width': shape.width, 'height': shape.height}

                if not is_within_page(el, page_w, page_h, margin):
                    # Determine which side
                    side_info = []
                    if shape.left + shape.width < -margin:
                        side_info.append("左侧外")
                    if shape.left > page_w + margin:
                        side_info.append("右侧外")
                    if shape.top + shape.height < -margin:
                        side_info.append("上方外")
                    if shape.top > page_h + margin:
                        side_info.append("下方外")

                    issues.append(self._make_issue(
                        "PAGE-003", "页面外元素", "S2",
                        f"元素位于页面外侧（{','.join(side_info)}）",
                        f"形状「{shape.name}」位置 ({shape.left:.1f}, {shape.top:.1f}) 超出页面范围 0-{page_w:.1f}x{page_h:.1f}",
                        "移入页面内",
                        slide.slide_index, shape,
                        auto_fixable=True,
                        fix_type="move_into_page",
                        fix_params={
                            "left": max(0, min(shape.left, page_w - shape.width)),
                            "top": max(0, min(shape.top, page_h - shape.height)),
                        },
                    ))

        return issues


class HiddenElementChecker(BaseChecker):
    """Check for hidden or risky elements."""

    @property
    def name(self) -> str:
        return "隐藏风险元素检查"

    @property
    def is_quick(self) -> bool:
        return False

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        min_size = 0.05  # very small elements

        for slide in pptx_data.slides:
            for shape in slide.shapes:
                # Check very small elements (potential artifacts)
                if 0 < shape.width < min_size or 0 < shape.height < min_size:
                    issues.append(self._make_issue(
                        "HIDDEN-001", "极小尺寸元素", "S4",
                        f"存在极小元素（{shape.width:.2f}x{shape.height:.2f}in），可能是残留辅助图形",
                        f"形状「{shape.name}」尺寸过小",
                        "检查是否需要删除",
                        slide.slide_index, shape,
                    ))

        return issues

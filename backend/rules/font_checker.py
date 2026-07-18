"""Font, size, color, and text consistency checkers."""

from collections import Counter
from typing import List, Optional

from backend.rules.base_checker import BaseChecker
from backend.models.issue import Issue
from backend.parsers import PptxData, SlideData
from backend.utils.color import is_low_contrast, parse_pptx_color


class FontChecker(BaseChecker):
    """Check font consistency: non-standard fonts, mixed fonts, missing fonts."""

    @property
    def name(self) -> str:
        return "字体一致性检查"

    def __init__(self, config):
        self.config = config
        self.standard_fonts = config.standard_fonts
        self.sensitive_words = set()
        self._font_names_local = {}  # cache

    def _is_standard_font(self, font_name: str) -> bool:
        if not font_name:
            return True  # inherit from theme = OK
        name_lower = font_name.lower()
        for std in self.standard_fonts:
            if std.lower() in name_lower or name_lower in std.lower():
                return True
        return False

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        for slide in pptx_data.slides:
            for shape in slide.shapes:
                if not shape.has_text or not shape.text_elements:
                    continue

                texts = shape.text_elements
                fonts_in_shape = set()
                for t in texts:
                    if t.font_name:
                        fonts_in_shape.add(t.font_name)

                # Check for non-standard fonts
                for fn in fonts_in_shape:
                    if not self._is_standard_font(fn):
                        issues.append(self._make_issue(
                            "FONT-001", "非标准字体", "S3",
                            f"使用了非标准字体：{fn}",
                            f"形状「{shape.name}」中的字体「{fn}」不在标准字体列表中",
                            f"建议替换为标准字体，如微软雅黑",
                            slide.slide_index, shape,
                            actual=fn,
                            expected=next(iter(self.standard_fonts)),
                            auto_fixable=True,
                            fix_type="font_replace",
                            fix_params={"old_font": fn, "new_font": "微软雅黑"},
                        ))

                # Check mixed fonts in same shape
                if len(fonts_in_shape) > 1:
                    issues.append(self._make_issue(
                        "FONT-002", "同一文本框混用多种字体", "S4",
                        f"文本框混用了 {len(fonts_in_shape)} 种字体",
                        f"形状「{shape.name}」使用字体：{', '.join(fonts_in_shape)}",
                        "建议统一文本框内字体",
                        slide.slide_index, shape,
                        actual=f"{len(fonts_in_shape)}种字体",
                        expected="1种字体",
                        auto_fixable=True,
                        fix_type="font_unify",
                        fix_params={"fonts": list(fonts_in_shape), "target_font": "微软雅黑"},
                    ))

        # Check same-type slides for title font consistency
        title_fonts_by_type = {}
        for slide in pptx_data.slides:
            layout = slide.layout_name or f"slide_{slide.slide_index}"
            title_texts = [t for s in slide.shapes if s.has_text for t in s.text_elements if t.is_title]
            for t in title_texts:
                if t.font_name:
                    key = (layout, "title_font")
                    if key not in title_fonts_by_type:
                        title_fonts_by_type[key] = {}
                    fn = t.font_name
                    title_fonts_by_type[key][fn] = title_fonts_by_type[key].get(fn, 0) + 1

        # Report title font inconsistencies
        for (layout, _), font_counts in title_fonts_by_type.items():
            if len(font_counts) > 1:
                # Pick the best reference font: prefer standard fonts > most common
                sorted_fonts = sorted(font_counts.items(),
                    key=lambda x: (self._is_standard_font(x[0]), x[1]),
                    reverse=True)
                best_font = sorted_fonts[0][0]

                all_slides_with_layout = [s for s in pptx_data.slides if s.layout_name == layout]
                for slide in all_slides_with_layout:
                    for shape in slide.shapes:
                        if not shape.has_text:
                            continue
                        for t in shape.text_elements:
                            if t.is_title and t.font_name and t.font_name != best_font:
                                issues.append(self._make_issue(
                                    "FONT-003", "同级标题字体不一致", "S3",
                                    f"标题字体「{t.font_name}」与同级页面不一致",
                                    f"布局「{layout}」的标题应统一字体",
                                    "统一同级页面标题字体",
                                    slide.slide_index, shape,
                                    actual=t.font_name,
                                    expected=best_font,
                                    auto_fixable=True,
                                    fix_type="font_replace",
                                    fix_params={"old_font": t.font_name, "new_font": best_font},
                                ))
                                break

        return issues


class FontSizeChecker(BaseChecker):
    """Check font size consistency and minimum size requirements."""

    @property
    def name(self) -> str:
        return "字号一致性检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        title_sizes_by_layout = {}
        min_body_size = self.config.min_body_font_size
        title_size_tolerance = self.config.title_font_size_tolerance

        for slide in pptx_data.slides:
            layout = slide.layout_name or f"slide_{slide.slide_index}"

            for shape in slide.shapes:
                if not shape.has_text or not shape.text_elements:
                    continue

                for t in shape.text_elements:
                    if not t.font_size:
                        continue

                    # Check minimum body text size
                    if not t.is_title and t.font_size < min_body_size:
                        issues.append(self._make_issue(
                            "SIZE-001", "正文字号过小", "S3",
                            f"正文字号 {t.font_size:.0f}pt，低于最小阈值 {min_body_size}pt",
                            f"形状「{shape.name}」中有 {t.font_size:.0f}pt 的文字",
                            f"建议增大至 {min_body_size}pt 以上",
                            slide.slide_index, shape,
                            actual=f"{t.font_size:.0f}pt",
                            expected=f"≥{min_body_size}pt",
                            auto_fixable=True,
                            fix_type="font_size_set",
                            fix_params={"target_size": min_body_size},
                        ))

                    # Collect title sizes
                    if t.is_title:
                        key = (layout, "title_size")
                        if key not in title_sizes_by_layout:
                            title_sizes_by_layout[key] = []
                        title_sizes_by_layout[key].append((slide.slide_index, shape, t.font_size))

        # Check title size consistency within same layout
        for (layout, _), sizes in title_sizes_by_layout.items():
            if len(sizes) < 2:
                continue
            # Find most common size
            size_counter = Counter(s[2] for s in sizes)
            common_size = size_counter.most_common(1)[0][0]

            for slide_idx, shape, fs in sizes:
                if abs(fs - common_size) > title_size_tolerance:
                    issues.append(self._make_issue(
                        "SIZE-002", "同级标题字号不一致", "S3",
                        f"标题字号 {fs:.0f}pt 与同级页面不一致（应为 {common_size:.0f}pt）",
                        f"布局「{layout}」中标题字号应保持一致",
                        f"统一为 {common_size:.0f}pt",
                        slide_idx, shape,
                        actual=f"{fs:.0f}pt",
                        expected=f"{common_size:.0f}pt",
                        auto_fixable=True,
                        fix_type="font_size_set",
                        fix_params={"target_size": common_size},
                    ))

        return issues


class ColorChecker(BaseChecker):
    """Check text color consistency and contrast."""

    @property
    def name(self) -> str:
        return "文本颜色检查"

    def __init__(self, config):
        self.config = config

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        standard_colors = self.config.standard_colors
        max_colors = self.config.max_colors_per_page

        # Collect all colors per slide
        slide_colors = {}
        for slide in pptx_data.slides:
            colors = set()
            for shape in slide.shapes:
                if not shape.has_text:
                    continue
                for t in shape.text_elements:
                    if t.font_color:
                        colors.add(t.font_color.upper())

                # Also check shape fill color
                if shape.fill_color:
                    colors.add(shape.fill_color.upper())

            slide_colors[slide.slide_index] = colors

        # Check for non-standard colors
        for slide in pptx_data.slides:
            for shape in slide.shapes:
                if not shape.has_text:
                    continue
                for t in shape.text_elements:
                    if t.font_color and t.font_color.upper() not in [c.upper() for c in standard_colors]:
                        issues.append(self._make_issue(
                            "COLOR-001", "文本颜色异常", "S3",
                            f"文本颜色 {t.font_color} 不在标准色板中",
                            f"形状「{shape.name}」使用了非标准颜色",
                            "建议替换为企业标准色",
                            slide.slide_index, shape,
                            actual=t.font_color,
                            expected="标准色板中的颜色",
                            auto_fixable=True,
                            fix_type="color_replace",
                            fix_params={"old_color": t.font_color, "new_color": "#333333"},
                        ))

            # Check too many colors on one page
            colors = slide_colors.get(slide.slide_index, set())
            if len(colors) > max_colors:
                # Find the actual text elements causing many colors
                for shape in slide.shapes:
                    if not shape.has_text:
                        continue
                    shape_colors = set()
                    for t in shape.text_elements:
                        if t.font_color:
                            shape_colors.add(t.font_color.upper())
                    if len(shape_colors) > 1:
                        issues.append(self._make_issue(
                            "COLOR-002", "页面颜色数量过多", "S4",
                            f"本页使用了 {len(colors)} 种颜色，建议控制在 {max_colors} 种以内",
                            f"本页颜色：{', '.join(sorted(colors))}",
                            "统一颜色使用，减少非必要颜色",
                            slide.slide_index, shape,
                            actual=f"{len(colors)}种",
                            expected=f"≤{max_colors}种",
                        ))
                        break

        # Check low contrast text
        for slide in pptx_data.slides:
            for shape in slide.shapes:
                if not shape.has_text:
                    continue
                bg_color = shape.fill_color or "#FFFFFF"
                for t in shape.text_elements:
                    if t.font_color and is_low_contrast(t.font_color, bg_color,
                                                         self.config.min_text_contrast_ratio):
                        issues.append(self._make_issue(
                            "COLOR-003", "文本对比度过低", "S3",
                            f"文本颜色与背景对比度不足，可能难以辨认",
                            f"文字「{t.text[:20]}」颜色 {t.font_color} 在背景 {bg_color} 上对比度不足",
                            "加深文字颜色或调亮背景色",
                            slide.slide_index, shape,
                            actual=f"对比度不足",
                            expected="符合 WCAG AA 标准",
                        ))

        return issues


class SensitiveTextChecker(BaseChecker):
    """Check for sensitive or residual text content."""

    @property
    def name(self) -> str:
        return "敏感及残留文本检查"

    def __init__(self, config):
        self.config = config
        self.sensitive_words = set()

    def set_sensitive_words(self, words: set):
        self.sensitive_words = words

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        if not self.sensitive_words:
            return issues

        for slide in pptx_data.slides:
            for shape in slide.shapes:
                for t in shape.text_elements:
                    text_lower = t.text.lower()
                    for word in self.sensitive_words:
                        if word.lower() in text_lower:
                            issues.append(self._make_issue(
                                "TEXT-001", "敏感或残留文本", "S1",
                                f"发现敏感/残留文本：{word}",
                                f"形状「{shape.name}」包含「{word}」",
                                "检查并删除或替换为正确内容",
                                slide.slide_index, shape,
                                actual=f"包含「{word}」",
                                expected="不应包含此内容",
                            ))
                            break

        return issues

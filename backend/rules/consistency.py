"""Cross-page consistency checkers: titles, page numbers, footers, logos."""

from typing import List, Dict
from collections import Counter

from backend.rules.base_checker import BaseChecker
from backend.models.issue import Issue
from backend.parsers import PptxData, SlideData


class TitlePositionChecker(BaseChecker):
    """Check title position consistency across similar pages."""

    @property
    def name(self) -> str:
        return "标题位置一致性检查"

    def __init__(self, config):
        self.config = config
        self.tolerance = config.alignment_tolerance * 3  # more tolerance for titles

    def _find_titles(self, slide: SlideData) -> list:
        """Find title-like shapes on a slide."""
        titles = []
        for shape in slide.shapes:
            if not shape.has_text:
                continue
            for t in shape.text_elements:
                if t.is_title:
                    titles.append({
                        'shape': shape,
                        'text': t.text[:30],
                    })
                    break
        return titles

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        # Group slides by layout
        layout_slides: Dict[str, list] = {}
        for slide in pptx_data.slides:
            key = slide.layout_name or f"slide_{slide.slide_index}"
            if key not in layout_slides:
                layout_slides[key] = []
            layout_slides[key].append(slide)

        for layout, slides in layout_slides.items():
            if len(slides) < 2:
                continue

            # Collect title positions
            title_positions = []
            for slide in slides:
                titles = self._find_titles(slide)
                for t in titles:
                    title_positions.append({
                        'slide': slide.slide_index,
                        'shape': t['shape'],
                        'left': t['shape'].left,
                        'top': t['shape'].top,
                        'width': t['shape'].width,
                    })

            if len(title_positions) < 2:
                continue

            # Find the most common position
            positions = [(round(p['left'], 1), round(p['top'], 1)) for p in title_positions]
            counter = Counter(positions)
            common_pos = counter.most_common(1)[0][0]

            # Check deviations
            for tp in title_positions:
                left_dev = abs(tp['left'] - common_pos[0])
                top_dev = abs(tp['top'] - common_pos[1])

                if left_dev > self.tolerance:
                    issues.append(self._make_issue(
                        "CONSIST-001", "标题水平位置不一致", "S3",
                        f"标题横坐标 {tp['left']:.1f}in，与其他同类型页面相差 {left_dev:.1f}in",
                        f"布局「{layout}」标题应位于 {common_pos[0]:.1f}in 处",
                        f"统一为 {common_pos[0]:.1f}in",
                        tp['slide'], tp['shape'],
                        actual=f"{tp['left']:.1f}in",
                        expected=f"{common_pos[0]:.1f}in",
                        auto_fixable=True,
                        fix_type="move",
                        fix_params={"dx": common_pos[0] - tp['left'], "dy": 0},
                    ))

                if top_dev > self.tolerance:
                    issues.append(self._make_issue(
                        "CONSIST-002", "标题垂直位置不一致", "S3",
                        f"标题纵坐标 {tp['top']:.1f}in，与其他同类型页面相差 {top_dev:.1f}in",
                        f"布局「{layout}」标题应位于 {common_pos[1]:.1f}in 处",
                        f"统一为 {common_pos[1]:.1f}in",
                        tp['slide'], tp['shape'],
                        actual=f"{tp['top']:.1f}in",
                        expected=f"{common_pos[1]:.1f}in",
                        auto_fixable=True,
                        fix_type="move",
                        fix_params={"dx": 0, "dy": common_pos[1] - tp['top']},
                    ))

        return issues


class PageNumberChecker(BaseChecker):
    """Check page number presence, position, and consistency."""

    @property
    def name(self) -> str:
        return "页码一致性检查"

    def __init__(self, config):
        self.config = config
        # Pages that may not need page numbers
        self.skip_pages_keywords = ["封面", "目录", "cover", "toc", "目录页"]

    def _find_page_numbers(self, slide: SlideData) -> list:
        """Identify likely page number shapes."""
        pn_shapes = []
        for shape in slide.shapes:
            if not shape.has_text:
                continue
            for t in shape.text_elements:
                text = t.text.strip()
                # Page numbers are short, numeric, or at bottom of slide
                if len(text) <= 5 and (text.isdigit() or text.startswith("第") or
                                        text.endswith("页") or "/" in text):
                    # Check position: bottom of slide
                    if shape.top > slide.height * 0.85:
                        pn_shapes.append(shape)
                        break
        return pn_shapes

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []
        skip_words = self.skip_pages_keywords

        page_num_positions = []

        for slide in pptx_data.slides:
            is_skip = False
            if slide.layout_name:
                for word in skip_words:
                    if word in slide.layout_name.lower():
                        is_skip = True
                        break

            pn_shapes = self._find_page_numbers(slide)

            if not pn_shapes and not is_skip and slide.slide_index > 0:
                # Skip first slide (usually cover)
                if slide.slide_index > 0:
                    issues.append(self._make_issue(
                        "PAGE-NUM-001", "页码缺失", "S3",
                        "本页未检测到页码",
                        "在页面底部未找到页码元素",
                        "添加页码或检查页码是否被遮挡",
                        slide.slide_index,
                        auto_fixable=False,
                    ))
            elif pn_shapes:
                for ps in pn_shapes:
                    page_num_positions.append({
                        'slide': slide.slide_index,
                        'shape': ps,
                        'left': ps.left,
                        'top': ps.top,
                    })

        # Check page number position consistency
        if len(page_num_positions) >= 2:
            positions = [(round(p['left'], 1), round(p['top'], 1)) for p in page_num_positions]
            counter = Counter(positions)
            common_pos = counter.most_common(1)[0][0]

            for pnp in page_num_positions:
                left_dev = abs(pnp['left'] - common_pos[0])
                top_dev = abs(pnp['top'] - common_pos[1])

                if left_dev > 1.0 or top_dev > 0.5:
                    issues.append(self._make_issue(
                        "PAGE-NUM-002", "页码位置不一致", "S3",
                        f"页码位置与多数页面不一致（偏差 {left_dev:.1f}in, {top_dev:.1f}in）",
                        f"其他页面页码位于 ({common_pos[0]:.1f}, {common_pos[1]:.1f})",
                        "统一页码位置",
                        pnp['slide'], pnp['shape'],
                        auto_fixable=True,
                        fix_type="move",
                        fix_params={
                            "dx": common_pos[0] - pnp['left'],
                            "dy": common_pos[1] - pnp['top'],
                        },
                    ))

        return issues


class FooterChecker(BaseChecker):
    """Check footer consistency across pages."""

    @property
    def name(self) -> str:
        return "页脚与Logo一致性检查"

    def __init__(self, config):
        self.config = config

    def _find_footers(self, slide: SlideData) -> list:
        """Find footer-like shapes (bottom area, small text)."""
        footers = []
        for shape in slide.shapes:
            if not shape.has_text:
                continue
            # Footer typically in bottom 10% of slide
            if shape.top > slide.height * 0.9 and shape.height < 0.5:
                text = " ".join(t.text for t in shape.text_elements).strip()
                if text:
                    footers.append({'shape': shape, 'text': text})
        return footers

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        # Collect footer texts and positions
        footer_data = []
        for slide in pptx_data.slides:
            footers = self._find_footers(slide)
            for f in footers:
                footer_data.append({
                    'slide': slide.slide_index,
                    'shape': f['shape'],
                    'text': f['text'],
                    'left': f['shape'].left,
                    'top': f['shape'].top,
                })

        if len(footer_data) < 2:
            return issues

        # Find most common footer text
        texts = [f['text'] for f in footer_data]
        text_counter = Counter(texts)
        common_text = text_counter.most_common(1)[0][0]

        # Check for inconsistent footers
        for fd in footer_data:
            if fd['text'] != common_text:
                issues.append(self._make_issue(
                    "FOOTER-001", "页脚内容不一致", "S3",
                    f"页脚内容与其他页面不同：「{fd['text'][:30]}」",
                    f"大多数页面页脚为「{common_text[:30]}」",
                    "统一页脚内容",
                    fd['slide'], fd['shape'],
                    actual=fd['text'],
                    expected=common_text,
                    auto_fixable=True,
                    fix_type="text_replace",
                    fix_params={"old_text": fd['text'], "new_text": common_text},
                ))

        return issues


class LogoChecker(BaseChecker):
    """Check logo presence and consistency."""

    @property
    def name(self) -> str:
        return "Logo检查"

    def __init__(self, config):
        self.config = config

    def _find_logos(self, slide: SlideData) -> list:
        """Find likely logo images (small, corner positions)."""
        logos = []
        for img in slide.images:
            # Logo is typically in a corner and small
            in_corner = (
                (img.left < 0.5 and img.top < 0.5) or  # top-left
                (img.left + img.width > slide.width - 0.5 and img.top < 0.5) or  # top-right
                (img.left < 0.5 and img.top + img.height > slide.height - 0.5) or  # bottom-left
                (img.left + img.width > slide.width - 0.5 and
                 img.top + img.height > slide.height - 0.5)  # bottom-right
            )
            if in_corner and img.width < 2.0 and img.height < 1.0:
                logos.append(img)

        # Also check for small shapes in corners (vector logos)
        for shape in slide.shapes:
            if shape.shape_type in ("auto_shape", "group", "picture"):
                in_corner = (
                    (shape.left < 0.5 and shape.top < 0.5) or
                    (shape.left + shape.width > slide.width - 0.5 and shape.top < 0.5) or
                    (shape.left < 0.5 and shape.top + shape.height > slide.height - 0.5) or
                    (shape.left + shape.width > slide.width - 0.5 and
                     shape.top + shape.height > slide.height - 0.5)
                )
                if in_corner and shape.width < 2.0 and shape.height < 1.0:
                    logos.append(shape)

        return logos

    def check(self, pptx_data: PptxData) -> List[Issue]:
        issues = []

        # Group slides with and without logos
        slides_with_logo = []
        slides_without_logo = []

        for slide in pptx_data.slides:
            logos = self._find_logos(slide)
            if logos:
                for logo in logos:
                    slides_with_logo.append({
                        'slide': slide.slide_index,
                        'logo': logo,
                    })
            else:
                # Skip slides that might not need logo (cover, etc.)
                if slide.slide_index > 0:
                    slides_without_logo.append(slide.slide_index)

        # Report missing logos
        for si in slides_without_logo:
            issues.append(self._make_issue(
                "LOGO-001", "Logo缺失", "S3",
                "本页未检测到Logo",
                "绝大多数页面包含Logo，本页缺失",
                "检查Logo是否被删除或遮挡",
                si,
                auto_fixable=False,
            ))

        # Check logo position consistency
        if len(slides_with_logo) >= 2:
            positions = [(round(s['logo'].left if hasattr(s['logo'], 'left') else s['logo'].left, 1),
                          round(s['logo'].top if hasattr(s['logo'], 'top') else s['logo'].top, 1))
                         for s in slides_with_logo]
            counter = Counter(positions)
            common_pos = counter.most_common(1)[0][0]

            for swl in slides_with_logo:
                logo = swl['logo']
                left = logo.left if hasattr(logo, 'left') else logo.left
                top = logo.top if hasattr(logo, 'top') else logo.top
                left_dev = abs(left - common_pos[0])
                top_dev = abs(top - common_pos[1])

                if left_dev > 1.0 or top_dev > 0.5:
                    issues.append(self._make_issue(
                        "LOGO-002", "Logo位置异常", "S4",
                        f"Logo位置与其他页面不一致",
                        f"Logo实际位置 ({left:.1f}, {top:.1f})，常见位置 ({common_pos[0]:.1f}, {common_pos[1]:.1f})",
                        "统一Logo位置",
                        swl['slide'],
                        auto_fixable=True,
                        fix_type="move",
                        fix_params={"dx": common_pos[0] - left, "dy": common_pos[1] - top},
                    ))

        return issues

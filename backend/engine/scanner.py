"""Scan engine - orchestrates all checkers."""

import time
from typing import List, Optional
from backend.models.issue import Issue, ScanResult, SlideSummary
from backend.parsers import parse_pptx, PptxData
from backend.config import RuleConfig
from backend.engine.scorer import Scorer


class Scanner:
    """Orchestrates PPT parsing and rule checking."""

    def __init__(self, config: Optional[RuleConfig] = None):
        self.config = config or RuleConfig()
        self.scorer = Scorer(self.config)
        self._checkers = []
        self._init_checkers()

    def _init_checkers(self):
        """Initialize all checkers with config."""
        # Lazy imports to avoid circular dependencies
        from backend.rules.font_checker import FontChecker, FontSizeChecker, ColorChecker, SensitiveTextChecker
        from backend.rules.layout_checker import (AlignmentChecker, SpacingChecker,
                                                   OverlapChecker, MarginChecker,
                                                   TextOverflowChecker)
        from backend.rules.page_checker import (PageSizeChecker, BlankPageChecker,
                                                 OffPageChecker, HiddenElementChecker)
        from backend.rules.image_checker import (ImageStretchChecker, ImageQualityChecker,
                                                  ImageBoundChecker)
        from backend.rules.consistency import (TitlePositionChecker, PageNumberChecker,
                                                FooterChecker, LogoChecker)
        from backend.rules.density import DensityChecker

        self._checkers = {
            'page_size': PageSizeChecker(self.config),
            'blank_page': BlankPageChecker(self.config),
            'off_page': OffPageChecker(self.config),
            'hidden': HiddenElementChecker(self.config),
            'font': FontChecker(self.config),
            'font_size': FontSizeChecker(self.config),
            'color': ColorChecker(self.config),
            'alignment': AlignmentChecker(self.config),
            'spacing': SpacingChecker(self.config),
            'overlap': OverlapChecker(self.config),
            'margin': MarginChecker(self.config),
            'text_overflow': TextOverflowChecker(self.config),
            'image_stretch': ImageStretchChecker(self.config),
            'image_quality': ImageQualityChecker(self.config),
            'image_bound': ImageBoundChecker(self.config),
            'title_position': TitlePositionChecker(self.config),
            'page_number': PageNumberChecker(self.config),
            'footer': FooterChecker(self.config),
            'logo': LogoChecker(self.config),
            'density': DensityChecker(self.config),
        }

    @property
    def checkers(self):
        return list(self._checkers.values())

    def get_checker(self, name: str):
        return self._checkers.get(name)

    def scan(self, file_path: str, mode: str = "standard") -> ScanResult:
        """Run scan on a PPTX file.

        Args:
            file_path: Path to .pptx file
            mode: 'quick' or 'standard'

        Returns:
            ScanResult with all issues and scores
        """
        start_time = time.time()

        # Parse
        pptx_data = parse_pptx(file_path)

        # Run checkers
        all_issues = []
        rules_applied = []

        for name, checker in self._checkers.items():
            # Skip non-quick checkers in quick mode
            if mode == "quick" and not checker.is_quick:
                continue

            try:
                issues = checker.check(pptx_data)
                all_issues.extend(issues)
                rules_applied.append(name)
            except Exception as e:
                # Single checker failure shouldn't stop the scan
                pass

        # Organize issues by slide
        slide_map = {}
        for slide in pptx_data.slides:
            slide_map[slide.slide_index] = SlideSummary(
                slide_index=slide.slide_index,
            )

        for issue in all_issues:
            si = issue.location.slide_index
            if si in slide_map:
                slide_map[si].issues.append(issue)

        slides = list(slide_map.values())

        # Calculate score
        score, dimension_scores = self.scorer.calculate(all_issues, pptx_data)
        # Update per-slide scores
        for slide in slides:
            s, _ = self.scorer.calculate(slide.issues, pptx_data)
            slide.score = s

        elapsed = (time.time() - start_time) * 1000

        return ScanResult(
            file_name=file_path.split("/")[-1],
            file_path=file_path,
            file_size=pptx_data.file_size,
            total_pages=len(pptx_data.slides),
            page_size=(pptx_data.slide_width, pptx_data.slide_height),
            slides=slides,
            score=score,
            dimension_scores=dimension_scores,
            scan_time_ms=elapsed,
            rules_applied=rules_applied,
        )

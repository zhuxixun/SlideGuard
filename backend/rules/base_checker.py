"""Base checker class for all PPT quality rules."""

from abc import ABC, abstractmethod
from typing import List
from backend.models.issue import Issue, ElementLocation
from backend.parsers import PptxData, SlideData


class BaseChecker(ABC):
    """Abstract base class for all quality checkers."""

    @abstractmethod
    def check(self, pptx_data: PptxData) -> List[Issue]:
        """Run checks on parsed PPTX data and return list of issues."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Checker name for display."""
        pass

    @property
    def is_quick(self) -> bool:
        """Whether this checker runs in quick mode."""
        return True

    def _location(self, slide_index: int, element=None) -> ElementLocation:
        """Create an ElementLocation."""
        loc = ElementLocation(slide_index=slide_index)
        if element:
            if hasattr(element, 'shape_id'):
                loc.element_id = str(element.shape_id)
            if hasattr(element, 'name'):
                loc.element_name = element.name
            if hasattr(element, 'shape_type'):
                loc.element_type = element.shape_type
            if hasattr(element, 'left'):
                loc.left = element.left
            if hasattr(element, 'top'):
                loc.top = element.top
            if hasattr(element, 'width'):
                loc.width = element.width
            if hasattr(element, 'height'):
                loc.height = element.height
        return loc

    def _make_issue(self, rule_id: str, rule_name: str, severity: str,
                    description: str, detail: str, suggestion: str,
                    slide_index: int, element=None,
                    actual: str = None, expected: str = None,
                    auto_fixable: bool = False, fix_type: str = None,
                    fix_params: dict = None) -> Issue:
        """Create a standardized Issue."""
        return Issue(
            rule_id=rule_id,
            rule_name=rule_name,
            severity=severity,
            description=description,
            detail=detail,
            suggestion=suggestion,
            location=self._location(slide_index, element),
            actual_value=actual,
            expected_value=expected,
            auto_fixable=auto_fixable,
            fix_type=fix_type,
            fix_params=fix_params or {},
        )

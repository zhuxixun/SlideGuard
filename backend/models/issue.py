"""Issue data models for SlideGuard."""

from dataclasses import dataclass, field
from typing import Optional, Any


@dataclass
class ElementLocation:
    """Location of an element on a slide."""
    slide_index: int  # 0-based
    element_id: Optional[str] = None
    element_name: Optional[str] = None
    element_type: str = "unknown"  # text, image, shape, table, chart
    left: float = 0.0  # EMU or points
    top: float = 0.0
    width: float = 0.0
    height: float = 0.0


@dataclass
class Issue:
    """A single quality issue found in a PPT."""
    rule_id: str  # e.g., "FONT-001"
    rule_name: str  # e.g., "非标准字体"
    severity: str  # S1, S2, S3, S4
    description: str  # Human-readable description
    detail: str  # Technical detail / evidence
    suggestion: str  # How to fix
    location: ElementLocation
    actual_value: Optional[str] = None
    expected_value: Optional[str] = None
    auto_fixable: bool = False
    fix_type: Optional[str] = None  # type of fix to apply
    fix_params: dict = field(default_factory=dict)  # parameters for fix
    status: str = "pending"  # pending, fixed, ignored, exception, fix_failed, manual


@dataclass
class SlideSummary:
    """Summary of a single slide's quality."""
    slide_index: int
    issues: list = field(default_factory=list)
    score: float = 100.0
    features: dict = field(default_factory=dict)  # page features for clustering
    cluster_id: int = -1
    anomaly_score: float = 0.0

    @property
    def s1_count(self): return sum(1 for i in self.issues if i.severity == "S1")
    @property
    def s2_count(self): return sum(1 for i in self.issues if i.severity == "S2")
    @property
    def s3_count(self): return sum(1 for i in self.issues if i.severity == "S3")
    @property
    def s4_count(self): return sum(1 for i in self.issues if i.severity == "S4")
    @property
    def total_issues(self): return len(self.issues)
    @property
    def fixable_count(self): return sum(1 for i in self.issues if i.auto_fixable)


@dataclass
class ScanResult:
    """Complete scan result for a PPT file."""
    file_name: str
    file_path: str
    file_size: int
    total_pages: int
    page_size: tuple  # (width, height) in inches
    slides: list = field(default_factory=list)  # list of SlideSummary
    score: float = 100.0
    dimension_scores: dict = field(default_factory=dict)
    scan_time_ms: float = 0.0
    rules_applied: list = field(default_factory=list)

    @property
    def all_issues(self):
        return [i for s in self.slides for i in s.issues]

    @property
    def s1_count(self): return sum(s.s1_count for s in self.slides)
    @property
    def s2_count(self): return sum(s.s2_count for s in self.slides)
    @property
    def s3_count(self): return sum(s.s3_count for s in self.slides)
    @property
    def s4_count(self): return sum(s.s4_count for s in self.slides)
    @property
    def total_issues(self): return sum(s.total_issues for s in self.slides)
    @property
    def fixable_count(self): return sum(s.fixable_count for s in self.slides)

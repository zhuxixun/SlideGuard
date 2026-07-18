"""Scoring engine - calculates quality scores."""

from typing import List, Tuple
from backend.models.issue import Issue
from backend.parsers import PptxData
from backend.config import RuleConfig


class Scorer:
    """Calculate quality scores based on detected issues."""

    def __init__(self, config: RuleConfig):
        self.config = config
        self.severity_deduction = config.severity_deduction
        self.weights = config.score_weights

    def _categorize_issue(self, issue: Issue) -> str:
        """Map issue to scoring dimension."""
        rule_id_prefix = issue.rule_id.split("-")[0]

        # Map rule ID prefixes to dimensions
        dim_map = {
            "PAGE": "document_integrity",
            "HIDDEN": "document_integrity",
            "TEXT": "document_integrity",  # sensitive text = integrity risk
            "FONT": "text_standardization",
            "SIZE": "text_standardization",
            "COLOR": "text_standardization",
            "TEXT-OVF": "text_standardization",
            "ALIGN": "layout_quality",
            "SPACE": "layout_quality",
            "OVERLAP": "layout_quality",
            "MARGIN": "layout_quality",
            "DENSE": "layout_quality",
            "CONSIST": "cross_page_consistency",
            "PAGE-NUM": "cross_page_consistency",
            "FOOTER": "cross_page_consistency",
            "LOGO": "cross_page_consistency",
            "IMG": "image_chart_quality",
        }

        return dim_map.get(rule_id_prefix, "layout_quality")

    def calculate(self, issues: List[Issue], pptx_data: PptxData) -> Tuple[float, dict]:
        """Calculate overall score and per-dimension scores.

        Returns:
            (overall_score, {dimension_name: score})
        """
        # Group issues by dimension
        dim_issues = {dim: [] for dim in self.weights}
        for issue in issues:
            dim = self._categorize_issue(issue)
            if dim in dim_issues:
                dim_issues[dim].append(issue)

        # Calculate per-dimension scores (start at 100, subtract deductions)
        dimension_scores = {}
        for dim, dim_issues_list in dim_issues.items():
            score = 100.0
            # Apply deductions for each issue
            severity_count = {}
            for issue in dim_issues_list:
                sev = issue.severity
                severity_count[sev] = severity_count.get(sev, 0) + 1

            for sev, count in severity_count.items():
                deduction = self.severity_deduction.get(sev, 0)
                # Cap deduction per severity level to prevent snowball
                capped_count = min(count, 5)
                score -= deduction * capped_count

            dimension_scores[dim] = max(0, score)

        # Weighted overall score
        overall = 0.0
        for dim, score in dimension_scores.items():
            overall += score * self.weights.get(dim, 0)

        overall = round(max(0, min(100, overall)), 1)

        # Round dimension scores
        dimension_scores = {k: round(v, 1) for k, v in dimension_scores.items()}

        return overall, dimension_scores

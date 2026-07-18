"""Geometry utilities for layout analysis."""

from typing import Optional


def emu_to_pt(emu: float) -> float:
    """Convert EMU (English Metric Unit) to points."""
    return emu / 12700.0


def emu_to_inches(emu: float) -> float:
    """Convert EMU to inches."""
    return emu / 914400.0


def pt_to_emu(pt: float) -> int:
    """Convert points to EMU."""
    return int(pt * 12700)


def check_overlap(ax: float, ay: float, aw: float, ah: float,
                  bx: float, by: float, bw: float, bh: float) -> float:
    """Calculate overlap ratio between two rectangles.

    Returns overlap area / min(area_a, area_b), 0 if no overlap.
    All coordinates in same unit (EMU or pt).
    """
    # Check if one is completely on one side of the other
    if ax + aw <= bx or bx + bw <= ax or ay + ah <= by or by + bh <= ay:
        return 0.0

    # Calculate overlap area
    ox = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    oy = max(0, min(ay + ah, by + bh) - max(ay, by))
    overlap_area = ox * oy

    area_a = aw * ah
    area_b = bw * bh
    min_area = min(area_a, area_b)

    if min_area <= 0:
        return 0.0

    return overlap_area / min_area


def check_alignment(elements: list, alignment_type: str, tolerance: float = 1.0) -> list:
    """Check if elements are misaligned.

    alignment_type: 'left', 'right', 'top', 'bottom', 'center_h', 'center_v'
    Returns list of (element_index, deviation) for misaligned elements.
    """
    if len(elements) < 3:
        return []

    positions = []
    for el in elements:
        if alignment_type == 'left':
            positions.append(el['left'])
        elif alignment_type == 'right':
            positions.append(el['left'] + el['width'])
        elif alignment_type == 'top':
            positions.append(el['top'])
        elif alignment_type == 'bottom':
            positions.append(el['top'] + el['height'])
        elif alignment_type == 'center_h':
            positions.append(el['left'] + el['width'] / 2)
        elif alignment_type == 'center_v':
            positions.append(el['top'] + el['height'] / 2)

    if not positions:
        return []

    # Find the most common position (mode)
    from collections import Counter
    rounded = [round(p, 1) for p in positions]
    if not rounded:
        return []
    counter = Counter(rounded)
    target = counter.most_common(1)[0][0]

    # Check deviations
    results = []
    for i, pos in enumerate(positions):
        dev = abs(pos - target)
        if dev > tolerance:
            results.append((i, dev))

    return results


def check_spacing(elements: list, spacing_type: str, tolerance: float = 1.5) -> list:
    """Check if spacing between elements is consistent.

    spacing_type: 'horizontal', 'vertical'
    Returns list of (gap, deviation_ratio) for each gap between sorted elements.
    """
    if len(elements) < 3:
        return []

    if spacing_type == 'horizontal':
        # Sort by left position
        sorted_els = sorted(elements, key=lambda e: e['left'])
        gaps = []
        for i in range(1, len(sorted_els)):
            gap = sorted_els[i]['left'] - (sorted_els[i-1]['left'] + sorted_els[i-1]['width'])
            gaps.append(gap)
    else:
        sorted_els = sorted(elements, key=lambda e: e['top'])
        gaps = []
        for i in range(1, len(sorted_els)):
            gap = sorted_els[i]['top'] - (sorted_els[i-1]['top'] + sorted_els[i-1]['height'])
            gaps.append(gap)

    if not gaps:
        return []

    avg_gap = sum(gaps) / len(gaps)
    if avg_gap < 0.01:
        return []

    results = []
    for gap in gaps:
        dev = abs(gap - avg_gap) / avg_gap
        if dev > tolerance / (avg_gap if avg_gap > 0 else 1):
            results.append((gap, dev))

    return results


def is_within_page(element: dict, page_width: float, page_height: float,
                   margin: float = 0) -> bool:
    """Check if element is within page boundaries (with optional margin)."""
    return (element['left'] >= -margin and
            element['top'] >= -margin and
            element['left'] + element['width'] <= page_width + margin and
            element['top'] + element['height'] <= page_height + margin)

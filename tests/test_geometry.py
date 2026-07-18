"""Tests for geometry utility functions."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.utils.geometry import (
    emu_to_pt, emu_to_inches, pt_to_emu,
    check_overlap, check_alignment, check_spacing,
    is_within_page,
)


def test_emu_conversions():
    # 1 inch = 914400 EMU
    assert abs(emu_to_inches(914400) - 1.0) < 0.001
    assert abs(emu_to_inches(1828800) - 2.0) < 0.001
    assert abs(emu_to_inches(0) - 0.0) < 0.001

    # 1 pt = 12700 EMU
    assert abs(emu_to_pt(12700) - 1.0) < 0.001
    assert abs(emu_to_pt(63500) - 5.0) < 0.001

    # Round-trip
    assert pt_to_emu(1.0) == 12700
    assert pt_to_emu(12.0) == 152400


def test_check_overlap_no_overlap():
    # Two non-overlapping rectangles
    r = check_overlap(0, 0, 10, 10, 20, 0, 10, 10)
    assert r == 0.0


def test_check_overlap_full():
    # Identical rectangles = 100% overlap
    r = check_overlap(0, 0, 10, 10, 0, 0, 10, 10)
    assert abs(r - 1.0) < 0.001


def test_check_overlap_partial():
    # Partially overlapping
    r = check_overlap(0, 0, 10, 10, 5, 5, 10, 10)
    assert 0.2 < r < 0.8


def test_check_overlap_edge_touch():
    # Edge touching = no overlap
    r = check_overlap(0, 0, 10, 10, 10, 0, 10, 10)
    assert r == 0.0


def test_check_alignment_few_elements():
    # Less than 3 elements should return empty
    result = check_alignment([{'left': 0, 'width': 10}], 'left')
    assert result == []


def test_check_alignment_left():
    elements = [
        {'left': 1.0, 'width': 5},
        {'left': 1.0, 'width': 3},
        {'left': 1.0, 'width': 4},
    ]
    result = check_alignment(elements, 'left', tolerance=0.5)
    assert result == []  # All aligned


def test_check_alignment_misaligned():
    elements = [
        {'left': 1.0, 'width': 5},
        {'left': 1.0, 'width': 3},
        {'left': 3.0, 'width': 4},  # Misaligned
    ]
    result = check_alignment(elements, 'left', tolerance=0.5)
    assert len(result) > 0


def test_check_alignment_empty():
    assert check_alignment([], 'left') == []


def test_check_spacing_consistent():
    elements = [
        {'left': 0, 'width': 2, 'top': 0, 'height': 1},
        {'left': 5, 'width': 2, 'top': 0, 'height': 1},
        {'left': 10, 'width': 2, 'top': 0, 'height': 1},
    ]
    # Horizontal gaps: 3, 3 -> consistent
    result = check_spacing(elements, 'horizontal', tolerance=1.5)
    assert result == []


def test_check_spacing_empty():
    assert check_spacing([], 'horizontal') == []


def test_is_within_page():
    el = {'left': 1, 'top': 1, 'width': 5, 'height': 3}
    assert is_within_page(el, 10, 10, margin=0)


def test_is_within_page_outside():
    el = {'left': 15, 'top': 1, 'width': 5, 'height': 3}
    assert not is_within_page(el, 10, 10, margin=0)


def test_is_within_page_margin():
    el = {'left': -0.05, 'top': 0, 'width': 1, 'height': 1}
    assert is_within_page(el, 10, 10, margin=0.1)

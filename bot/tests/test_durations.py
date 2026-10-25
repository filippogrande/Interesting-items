"""Test delle funzioni pure del bot: niente Redis, niente rete."""
from app.durations import (
    BETWEEN_SCRAPES_SECONDS,
    SCRAPE_MAX_SECONDS,
    estimate_remaining_seconds,
    format_duration,
)


def test_format_duration_zero():
    assert format_duration(0) == "0min"


def test_format_duration_minuti():
    assert format_duration(30) == "1min"
    assert format_duration(60) == "1min"
    assert format_duration(120) == "2min"


def test_format_duration_ore():
    assert format_duration(3600) == "1h"
    assert format_duration(3660) == "1h 1min"
    assert format_duration(7200) == "2h"


def test_estimate_remaining_seconds():
    assert estimate_remaining_seconds(0) == 0
    per_item = SCRAPE_MAX_SECONDS + BETWEEN_SCRAPES_SECONDS
    assert estimate_remaining_seconds(1) == per_item
    assert estimate_remaining_seconds(3) == 3 * per_item

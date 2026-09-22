"""The max-duration value the scan form hands to the scanner.

The scanner parses it as a Go duration and aborts before walking anything when
it cannot, so a value that reaches it unusable costs a whole scan and reports
no packages.
"""

from bumblebee_gui.duration import problem_for_duration


def _refusal(value: str) -> str:
    """The message that rules a value out, failing the test if it is accepted."""
    message = problem_for_duration(value)
    assert message is not None, f"expected {value} to be refused"
    return message


def test_unset_value_is_accepted():
    """Empty leaves the flag off the command line, so the scanner decides."""
    assert problem_for_duration(None) is None
    assert problem_for_duration("") is None
    assert problem_for_duration("   ") is None


def test_a_number_with_a_unit_is_accepted():
    for value in ("30s", "10m", "2h", "1h30m", "500ms", "1.5h", "10m30s"):
        assert problem_for_duration(value) is None, value


def test_zero_is_accepted_and_means_no_limit():
    assert problem_for_duration("0") is None
    assert problem_for_duration("+0") is None


def test_a_number_without_a_unit_is_refused():
    message = _refusal("10")

    assert "10" in message
    assert "30s" in message


def test_a_word_is_refused():
    message = _refusal("banana")

    assert "banana" in message


def test_the_refusal_says_what_the_value_would_have_cost():
    message = _refusal("banana")

    assert "stops immediately and reports nothing" in message
    assert "Leave it empty" in message


def test_an_uppercase_unit_is_refused_because_the_scanner_refuses_it():
    assert problem_for_duration("10M") is not None


def test_a_negative_duration_is_refused():
    message = _refusal("-5m")

    assert "negative" in message

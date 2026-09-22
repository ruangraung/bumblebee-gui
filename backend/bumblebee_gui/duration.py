"""What a max-duration value has to be for the scanner to accept it.

The CLI parses ``--max-duration`` as a Go duration and aborts the whole scan
when it cannot. It exits non-zero before walking anything, so the scan produces
no packages and the run is recorded as a failure. A value typed into the form
reaches that state with no warning, because the form passes the text through
untouched and the request is accepted first.

This module moves the rejection to the request: the shape of an unusable value,
in the words the form shows. An empty value is not an error. The flag is then
left off the command line, and the scanner applies its own default.
"""

import re
from typing import Optional

# One quantity and one unit, as Go's time.ParseDuration reads it: a decimal
# number followed by ns, us, µs, ms, s, m or h. "1h30m" and "0.5h" are both
# combinations of this.
QUANTITY = re.compile(r"\d+(?:\.\d+)?(?:ns|us|µs|μs|ms|s|m|h)")

# The whole value: an optional sign, then one or more quantity-and-unit pairs,
# plus the bare zero Go accepts.
DURATION = re.compile(r"\+?(?:" + QUANTITY.pattern + r")+")

ACCEPTED_SHAPE = (
    "Use a number and a unit, such as 30s, 10m, 2h or 1h30m, or 0 for no limit. "
    "Leave it empty to use the scanner's own default."
)


def _is_duration(text: str) -> bool:
    """Whether the scanner's own parser would accept this text.

    A bare zero is valid without a unit, which is how a scan asks for no time
    limit at all.
    """
    if text.lstrip("+") == "0":
        return True
    return bool(DURATION.fullmatch(text))


def _sign_problem(text: str) -> Optional[str]:
    """A duration cannot run backwards, and the scanner refuses to try."""
    if text.startswith("-"):
        return f"Max duration {text} is negative, and a scan cannot run for less than no time. {ACCEPTED_SHAPE}"
    return None


def problem_for_duration(value: Optional[str]) -> Optional[str]:
    """What rules one max-duration value out, or None when the scanner takes it.

    An unset value is not a problem: it means the scanner decides how long a
    scan may run.
    """
    text = (value or "").strip()
    if not text:
        return None

    signed = _sign_problem(text)
    if signed:
        return signed

    if _is_duration(text):
        return None

    return (
        f"Max duration {text} is not a duration the scanner accepts, and a scan "
        f"started with it stops immediately and reports nothing. {ACCEPTED_SHAPE}"
    )

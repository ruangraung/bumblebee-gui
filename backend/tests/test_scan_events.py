"""Every open stream for a scan must see every event.

The registry replaced one queue per scan, drained with ``queue.get()`` by every
subscriber. That is work distribution, not broadcast: with two tabs open, each
event reached exactly one of them, and the other waited for the fifteen second
database check to notice the scan had finished.
"""

import asyncio

import pytest

from bumblebee_gui.scan_events import ScanSubscribers


def test_every_subscriber_receives_the_same_event():
    subscribers = ScanSubscribers()
    first = subscribers.subscribe(1)
    second = subscribers.subscribe(1)

    subscribers.publish(1, {"type": "progress", "packages_found": 4})

    assert first.get_nowait()["packages_found"] == 4
    assert second.get_nowait()["packages_found"] == 4


def test_a_terminal_event_reaches_every_subscriber():
    subscribers = ScanSubscribers()
    queues = [subscribers.subscribe(7) for _ in range(3)]

    subscribers.publish(7, {"type": "completed"})

    assert [queue.get_nowait()["type"] for queue in queues] == [
        "completed",
        "completed",
        "completed",
    ]


def test_a_stalled_reader_keeps_only_the_latest_progress():
    """Bounded, and coalesced toward the newest count rather than the oldest."""
    subscribers = ScanSubscribers(buffer_size=2)
    stalled = subscribers.subscribe(1)

    for count in range(5):
        subscribers.publish(1, {"type": "progress", "packages_found": count})

    assert stalled.qsize() == 2
    remaining = [stalled.get_nowait()["packages_found"], stalled.get_nowait()["packages_found"]]
    assert remaining == [3, 4]


def test_a_terminal_event_is_never_lost_to_a_full_buffer():
    subscribers = ScanSubscribers(buffer_size=1)
    queue = subscribers.subscribe(1)

    subscribers.publish(1, {"type": "progress", "packages_found": 12})
    subscribers.publish(1, {"type": "completed"})

    assert queue.get_nowait()["type"] == "completed"


def test_unsubscribe_leaves_no_registry_entry():
    subscribers = ScanSubscribers()
    queue = subscribers.subscribe(1)

    subscribers.unsubscribe(1, queue)

    assert subscribers.subscriber_count(1) == 0


def test_unsubscribing_twice_is_harmless():
    subscribers = ScanSubscribers()
    queue = subscribers.subscribe(1)

    subscribers.unsubscribe(1, queue)
    subscribers.unsubscribe(1, queue)
    subscribers.unsubscribe(99, queue)

    assert subscribers.subscriber_count(1) == 0


def test_publishing_without_subscribers_does_nothing():
    subscribers = ScanSubscribers()

    subscribers.publish(5, {"type": "progress", "packages_found": 1})

    assert subscribers.subscriber_count(5) == 0


def test_close_sends_the_final_event_and_forgets_the_scan():
    subscribers = ScanSubscribers()
    queue = subscribers.subscribe(3)

    subscribers.close(3, {"type": "cancelled"})

    assert queue.get_nowait()["type"] == "cancelled"
    assert subscribers.subscriber_count(3) == 0


def test_close_without_an_event_only_clears_routing():
    subscribers = ScanSubscribers()
    queue = subscribers.subscribe(3)

    subscribers.close(3)

    with pytest.raises(asyncio.QueueEmpty):
        queue.get_nowait()

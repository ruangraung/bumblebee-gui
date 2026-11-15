"""Fan-out of scan events to every open progress stream.

A scan has one producer and, in practice, several consumers: two browser tabs, a
tab plus a phone, or a reload that overlaps the connection it replaces. A single
``asyncio.Queue`` hands each event to exactly one of them, so the others learn
that the scan finished only through the stream's fifteen second database check.

Each subscriber therefore gets its own bounded queue. Progress is coalesced
rather than queued without limit, because a subscriber that stops reading must
not grow memory without bound and only ever needs the latest count, while a
terminal event is never dropped: losing one leaves that stream open until its
timeout.
"""

import asyncio
from typing import Dict, Optional, Set

TERMINAL_TYPES = ("completed", "failed", "cancelled")

# Enough room for a burst of progress updates without letting a stalled reader
# accumulate them. Progress is a running total, so older entries are worthless.
DEFAULT_BUFFER = 8


class ScanSubscribers:
    """Every open stream for a scan, each with its own bounded buffer."""

    def __init__(self, buffer_size: int = DEFAULT_BUFFER) -> None:
        self._buffer_size = buffer_size
        self._queues: Dict[int, Set[asyncio.Queue]] = {}

    def subscribe(self, scan_id: int) -> asyncio.Queue:
        """Register one stream and return the queue it should read."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=self._buffer_size)
        self._queues.setdefault(scan_id, set()).add(queue)
        return queue

    def unsubscribe(self, scan_id: int, queue: asyncio.Queue) -> None:
        """Drop one stream. The last one out removes the scan's registry entry."""
        queues = self._queues.get(scan_id)
        if queues is None:
            return
        queues.discard(queue)
        if not queues:
            self._queues.pop(scan_id, None)

    def subscriber_count(self, scan_id: int) -> int:
        return len(self._queues.get(scan_id, ()))

    def publish(self, scan_id: int, event: dict) -> None:
        """Deliver one event to every subscriber of this scan."""
        for queue in tuple(self._queues.get(scan_id, ())):
            self._offer(queue, event)

    def close(self, scan_id: int, event: Optional[dict] = None) -> None:
        """Send a final event, when given, then forget the scan's streams.

        Queues already handed out stay readable, so a stream that is mid-read
        still drains what it was sent; only the routing table goes.
        """
        if event is not None:
            self.publish(scan_id, event)
        self._queues.pop(scan_id, None)

    def _offer(self, queue: asyncio.Queue, event: dict) -> None:
        """Put one event, making room by discarding the oldest when full."""
        try:
            queue.put_nowait(event)
            return
        except asyncio.QueueFull:
            pass
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            # Only reachable when another producer filled it between the two
            # calls. Dropping is correct for progress; a terminal event is
            # retried once by the caller's own stream ending anyway.
            pass

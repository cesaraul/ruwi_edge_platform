import re
from dataclasses import dataclass

# Pattern: /{vertical}/{org_id}/{device_id}/{type}
TOPIC_PATTERN = re.compile(
    r"^/?([a-z]+)/([a-f0-9-]+)/([a-f0-9-]+)/(telemetry|status|commands|heartbeat)$"
)


@dataclass
class ParsedTopic:
    vertical: str
    org_id: str
    device_id: str
    type: str


def parse_topic(topic: str) -> ParsedTopic | None:
    match = TOPIC_PATTERN.match(topic)
    if not match:
        return None
    vertical, org_id, device_id, msg_type = match.groups()
    return ParsedTopic(vertical=vertical, org_id=org_id, device_id=device_id, type=msg_type)

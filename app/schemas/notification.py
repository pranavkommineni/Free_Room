from app.schemas.common import ORM, OutDT


class NotificationOut(ORM):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: OutDT

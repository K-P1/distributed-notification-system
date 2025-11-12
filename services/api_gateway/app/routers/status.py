"""Status update endpoints for workers"""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query, status

from app.dependencies import get_correlation_id, get_status_service, verify_api_key
from app.schemas import StandardResponse, StatusUpdateRequest
from app.services.status import StatusService
from app.metrics import notification_status_updates_total

log = structlog.get_logger()

router = APIRouter(tags=["status"])


@router.post(
    "/{notification_type}/status/",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_api_key)],
)
async def update_notification_status(
    notification_type: str,
    update_request: StatusUpdateRequest,
    notification_id: str = Query(...),
    status_service: StatusService = Depends(get_status_service),
    correlation_id: str = Depends(get_correlation_id),
) -> dict[str, Any]:
    """
    Update notification status (called by workers).

    Args:
        notification_type: Type of notification (email/push)
        notification_id: UUID of the notification
        update_request: Status update data

    Returns:
        200: Status updated
        404: Notification not found
        422: Invalid status transition
    """
    log.info(
        "update_status_request",
        notification_id=notification_id,
        new_status=update_request.new_status.value,
        changed_by=update_request.changed_by,
        correlation_id=correlation_id,
    )

    try:
        notification_uuid = UUID(notification_id)
    except ValueError:
        return {
            "success": False,
            "data": None,
            "error": {
                "code": "INVALID_UUID",
                "message": "Invalid notification ID format",
                "details": None,
            },
            "message": None,
            "meta": None,
        }

    try:
        status_record = await status_service.update_status(
            notification_uuid,
            update_request.new_status,
            update_request.changed_by,
            update_request.error_message,
            update_request.metadata,
        )

        if not status_record:
            return {
                "success": False,
                "data": None,
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Notification {notification_id} not found",
                    "details": None,
                },
                "message": None,
                "meta": None,
            }

        # Track status update
        notification_status_updates_total.labels(
            notification_type=notification_type,
            status=update_request.new_status.value,
        ).inc()

        return {
            "success": True,
            "data": status_record.model_dump(mode="json"),
            "error": None,
            "message": "Status updated successfully",
            "meta": None,
        }

    except ValueError as e:
        # Invalid transition
        return {
            "success": False,
            "data": None,
            "error": {"code": "INVALID_TRANSITION", "message": str(e), "details": None},
            "message": None,
            "meta": None,
        }

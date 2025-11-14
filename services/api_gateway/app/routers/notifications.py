"""Notification submission endpoints"""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, Request, status

from app.dependencies import (
    check_rate_limit,
    get_correlation_id,
    get_notification_service,
    get_status_service,
    verify_api_key,
)
from app.schemas import NotificationRequest, StandardResponse
from app.services.notification import NotificationService
from app.services.status import StatusService

log = structlog.get_logger()

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "/",
    response_model=StandardResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_api_key), Depends(check_rate_limit)],
)
async def submit_notification(
    request: NotificationRequest,
    notification_service: NotificationService = Depends(get_notification_service),
    correlation_id: str = Depends(get_correlation_id),
) -> dict[str, Any]:
    """
    Submit a new notification for processing.

    - **notification_type**: Type of notification (email/push)
    - **user_id**: UUID of the user
    - **template_code**: Code of the template to use
    - **variables**: Variables for template rendering
    - **priority**: Priority level (1-10)
    - **request_id**: Optional idempotency key

    Returns:
        202: Notification queued successfully
        409: Duplicate request (idempotent)
        422: Validation error
        429: Rate limit exceeded
        503: Service unavailable
    """
    log.info(
        "notification_request_received",
        notification_type=request.notification_type,
        user_id=str(request.user_id),
        template_code=request.template_code,
        has_push_token=request.push_token is not None,
        correlation_id=correlation_id,
    )

    try:
        response = await notification_service.submit_notification(request, correlation_id)
        return response
    except Exception as e:
        log.error(
            "notification_submission_failed",
            error=str(e),
            error_type=type(e).__name__,
            correlation_id=correlation_id,
            exc_info=True,
        )
        raise


@router.get(
    "/{notification_id}/status",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_api_key)],
)
async def get_notification_status(
    notification_id: str,
    request_obj: Request,
    status_service: StatusService = Depends(get_status_service),
    correlation_id: str = Depends(get_correlation_id),
) -> dict[str, Any]:
    """
    Get current status of a notification.

    Args:
        notification_id: UUID of the notification

    Returns:
        200: Status found
        404: Notification not found
    """
    from uuid import UUID

    log.info(
        "get_status_request",
        notification_id=notification_id,
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

    status_record = await status_service.get_status(notification_uuid)

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

    return {
        "success": True,
        "data": status_record.model_dump(mode="json"),
        "error": None,
        "message": "Status retrieved successfully",
        "meta": None,
    }

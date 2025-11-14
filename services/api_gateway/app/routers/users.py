"""User management endpoints"""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from circuitbreaker import CircuitBreakerError
import httpx

from app.dependencies import get_correlation_id, get_user_service
from app.clients.user_service import UserServiceClient
from app.schemas import StandardResponse, UserCreateRequest

log = structlog.get_logger()

router = APIRouter(prefix="/users", tags=["users"])


@router.post(
    "/",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    request: UserCreateRequest,
    user_service: UserServiceClient = Depends(get_user_service),
    correlation_id: str = Depends(get_correlation_id),
) -> dict[str, Any]:
    """
    Create a new user with notification preferences.

    - **email**: User's email address
    - **password**: User's password (min 8 characters)
    - **name**: User's full name
    - **push_token**: Optional FCM push notification token
    - **preferences**: Notification preferences

    Returns:
        201: User created successfully
        400: Invalid request data
        409: User already exists
        503: Service unavailable
    """
    log.info(
        "user_create_request_received",
        email=request.email,
        has_push_token=request.push_token is not None,
        correlation_id=correlation_id,
    )

    try:
        # Prepare user data for the user service
        user_data = {
            "email": request.email,
            "password": request.password,
            "name": request.name,
            "push_token": request.push_token,
            "preferences": request.preferences.model_dump(),
        }

        # Call user service to create the user
        created_user = await user_service.create_user(user_data, correlation_id)

        log.info(
            "user_created_successfully",
            user_id=created_user.get("user_id"),
            email=created_user.get("email"),
            correlation_id=correlation_id,
        )

        return {
            "success": True,
            "data": created_user,
            "error": None,
            "message": "User created successfully",
            "meta": {"correlation_id": correlation_id},
        }

    except httpx.HTTPStatusError as e:
        log.error(
            "user_service_http_error",
            status_code=e.response.status_code,
            error=str(e),
            correlation_id=correlation_id,
        )

        # Handle specific HTTP status codes from user service
        if e.response.status_code == 409:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists",
            )
        elif e.response.status_code == 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user data provided",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="User service unavailable",
            )

    except CircuitBreakerError:
        log.error("user_service_circuit_open", correlation_id=correlation_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User service temporarily unavailable",
        )

    except Exception as e:
        log.error(
            "user_creation_failed",
            error=str(e),
            error_type=type(e).__name__,
            correlation_id=correlation_id,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

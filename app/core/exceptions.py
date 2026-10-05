"""Domain exceptions + consistent error envelope:
{"success": false, "error": {"code": "...", "message": "...", "details": ...}}"""
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("freeroom")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str, *, code: str | None = None, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details


class ValidationAppError(AppError):
    status_code, code = 400, "VALIDATION_ERROR"


class UnauthorizedError(AppError):
    status_code, code = 401, "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code, code = 403, "FORBIDDEN"


class NotFoundError(AppError):
    status_code, code = 404, "NOT_FOUND"


class ConflictError(AppError):
    status_code, code = 409, "CONFLICT"


class RoomNotAvailableError(ConflictError):
    code = "ROOM_NOT_AVAILABLE"


class TooManyRequestsError(AppError):
    status_code, code = 429, "RATE_LIMITED"


def error_body(code: str, message: str, details: Any = None) -> dict:
    err: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        err["details"] = details
    return {"success": False, "error": err}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
        return JSONResponse(status_code=422, content=error_body("REQUEST_VALIDATION_ERROR", "Invalid request.", details))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(status_code=exc.status_code, content=error_body(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)  # details only in server log
        return JSONResponse(status_code=500, content=error_body("INTERNAL_ERROR", "An unexpected error occurred."))

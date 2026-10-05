from fastapi import APIRouter, Depends, status

from app.core.dependencies import AdminUser, DbSession, FacultyOrAdmin
from app.schemas.common import Page
from app.schemas.maintenance import (MaintenanceCreate, MaintenanceOut, MaintenanceUpdate, RestrictionCreate, RestrictionOut)
from app.services.maintenance_service import MaintenanceService, RestrictionService
from app.utils.pagination import PageParams

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])
restrictions_router = APIRouter(prefix="/restrictions", tags=["Restrictions"])


@router.post("", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED,
             summary="Schedule maintenance (ADMIN). Overlapping bookings are cancelled and their owners notified")
async def create_maintenance(data: MaintenanceCreate, admin: AdminUser, session: DbSession):
    return await MaintenanceService(session).create(admin, data)


@router.get("", response_model=Page[MaintenanceOut], summary="List maintenance (FACULTY/ADMIN)")
async def list_maintenance(user: FacultyOrAdmin, session: DbSession, params: PageParams = Depends(), room_id: int | None = None,
                           status: str | None = None):
    items, total = await MaintenanceService(session).list(params, room_id, status)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.put("/{maintenance_id}", response_model=MaintenanceOut, summary="Update maintenance (ADMIN)")
async def update_maintenance(maintenance_id: int, data: MaintenanceUpdate, admin: AdminUser, session: DbSession):
    return await MaintenanceService(session).update(admin, maintenance_id, data)


@router.delete("/{maintenance_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Cancel maintenance (ADMIN, soft delete)")
async def delete_maintenance(maintenance_id: int, admin: AdminUser, session: DbSession):
    await MaintenanceService(session).cancel(admin, maintenance_id)


@restrictions_router.post("", response_model=RestrictionOut, status_code=status.HTTP_201_CREATED, summary="Create a temporary restriction (ADMIN)")
async def create_restriction(data: RestrictionCreate, admin: AdminUser, session: DbSession):
    return await RestrictionService(session).create(admin, data)


@restrictions_router.get("", response_model=Page[RestrictionOut], summary="List restrictions (ADMIN)")
async def list_restrictions(admin: AdminUser, session: DbSession, params: PageParams = Depends(), room_id: int | None = None,
                            status: str | None = None):
    items, total = await RestrictionService(session).list(params, room_id, status)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@restrictions_router.delete("/{restriction_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Lift a restriction (ADMIN, soft delete)")
async def lift_restriction(restriction_id: int, admin: AdminUser, session: DbSession):
    await RestrictionService(session).lift(admin, restriction_id)

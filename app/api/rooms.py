from fastapi import APIRouter, Depends, status

from app.core.dependencies import AdminUser, CurrentUser, DbSession
from app.repositories.room_repository import RoomRepository
from app.schemas.common import Page
from app.schemas.room import BuildingOut, FloorOut, RoomCreate, RoomOut, RoomUpdate
from app.services.room_service import RoomService
from app.utils.pagination import PageParams

router = APIRouter(prefix="/rooms", tags=["Rooms"])
buildings_router = APIRouter(prefix="/buildings", tags=["Rooms"])


@buildings_router.get("", response_model=list[BuildingOut], summary="Buildings with their floors")
async def list_buildings(user: CurrentUser, session: DbSession):
    data = await RoomRepository(session).buildings_with_floors()
    return [BuildingOut(id=b.id, name=b.name, code=b.code, floors=[FloorOut.model_validate(f) for f in fl]) for b, fl in data]


@router.get("", response_model=Page[RoomOut], summary="List rooms (students see only active, student-accessible rooms)")
async def list_rooms(user: CurrentUser, session: DbSession, params: PageParams = Depends(), building_id: int | None = None,
                     floor_id: int | None = None, status: str | None = None, minimum_capacity: int | None = None,
                     has_projector: bool | None = None, has_ac: bool | None = None):
    items, total = await RoomService(session).list(user, params, building_id=building_id, floor_id=floor_id, status=status,
                                                   minimum_capacity=minimum_capacity, has_projector=has_projector, has_ac=has_ac)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(room_id: int, user: CurrentUser, session: DbSession):
    return await RoomService(session).get(user, room_id)


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED, summary="Create a room (ADMIN)")
async def create_room(data: RoomCreate, admin: AdminUser, session: DbSession):
    return await RoomService(session).create(admin, data)


@router.put("/{room_id}", response_model=RoomOut, summary="Update a room (ADMIN)")
async def update_room(room_id: int, data: RoomUpdate, admin: AdminUser, session: DbSession):
    return await RoomService(session).update(admin, room_id, data)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Deactivate a room (ADMIN) - soft delete; future bookings are cancelled and history preserved")
async def delete_room(room_id: int, admin: AdminUser, session: DbSession):
    await RoomService(session).deactivate(admin, room_id)

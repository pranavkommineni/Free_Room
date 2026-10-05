"""Seed FreeRoom.

  python scripts/seed_database.py                                  # AB3 building + 7 floors + period grid (+ rooms if CSV filled)
  python scripts/seed_database.py --rooms-file my_ab3_rooms.csv    # AB3 with the real 77 room numbers
  python scripts/seed_database.py --admin-email a@b.com --admin-password '...'   # first real admin account
  python scripts/seed_database.py --demo --demo-password '...'     # sample users/timetable/bookings in a separate DEMO building
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, engine  # noqa: E402
from app.seed.seed_data import SeedError, ensure_admin, seed_ab3, seed_demo, seed_periods  # noqa: E402


async def main(a: argparse.Namespace) -> int:
    async with SessionLocal() as s:
        try:
            _, msg = await seed_ab3(s, Path(a.rooms_file) if a.rooms_file else None, a.allow_partial)
            print(msg)
            print(f"Period grid: {await seed_periods(s)} period(s) inserted (0 = already configured).")
            if a.admin_email:
                if not a.admin_password or len(a.admin_password) < 10:
                    raise SeedError("--admin-password (min 10 chars) is required with --admin-email")
                print("Admin created." if await ensure_admin(s, a.admin_email, a.admin_password) else "Admin already exists.")
            if a.demo:
                if not a.demo_password or len(a.demo_password) < 10:
                    raise SeedError("--demo-password (min 10 chars) is required with --demo")
                print(await seed_demo(s, a.demo_password))
            await s.commit()
        except SeedError as exc:
            await s.rollback()
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
    await engine.dispose()
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rooms-file", help="CSV with columns floor_number,room_number (default: app/seed/ab3_rooms.csv)")
    p.add_argument("--allow-partial", action="store_true", help="allow fewer than 11 rooms per floor")
    p.add_argument("--admin-email")
    p.add_argument("--admin-password")
    p.add_argument("--demo", action="store_true")
    p.add_argument("--demo-password")
    sys.exit(asyncio.run(main(p.parse_args())))

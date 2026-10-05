"""Command-line timetable import (same validation as POST /api/v1/admin/timetable/import).

  python scripts/import_timetable.py timetable.csv                 # preview only
  python scripts/import_timetable.py timetable.csv --commit        # commit (all rows must be valid)
  python scripts/import_timetable.py timetable.csv --commit --allow-partial
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.exceptions import AppError  # noqa: E402
from app.models import User  # noqa: E402
from app.services.csv_import_service import TimetableImportService  # noqa: E402


async def main(a: argparse.Namespace) -> int:
    path = Path(a.file)
    async with SessionLocal() as s:
        admin = (await s.execute(select(User).where(User.role == "ADMIN", User.is_active.is_(True)).order_by(User.id))).scalars().first()
        if not admin:
            print("No admin user exists. Create one with scripts/seed_database.py --admin-email ...", file=sys.stderr)
            return 1
        svc = TimetableImportService(s)
        try:
            p = await svc.preview(admin, path.name, "text/csv", path.read_bytes())
            print(f"rows={p.total_rows} valid={p.valid_rows} errors={p.error_count}")
            for e in p.errors:
                print(f"  row {e.row}: [{e.code}] {e.field or ''} {e.message}")
            if a.commit:
                r = await svc.confirm(admin, p.import_id, a.allow_partial)
                print(f"committed: inserted={r.inserted} skipped_rows={r.skipped}")
            else:
                print("preview only (use --commit to write).")
        except AppError as exc:
            print(f"ERROR [{exc.code}]: {exc.message}", file=sys.stderr)
            return 1
    await engine.dispose()
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("file")
    p.add_argument("--commit", action="store_true")
    p.add_argument("--allow-partial", action="store_true")
    sys.exit(asyncio.run(main(p.parse_args())))

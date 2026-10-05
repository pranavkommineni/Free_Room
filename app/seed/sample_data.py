"""Demo-only fixtures. They live in a separate DEMO building so they can never be confused with real AB3 rooms."""
DEMO_BUILDING = {"name": "Demo Block (sample data)", "code": "DEMO"}
DEMO_FLOORS = [1, 2]
DEMO_ROOMS = {1: ["D-101", "D-102", "D-103"], 2: ["D-201", "D-202", "D-203"]}   # clearly fake labels

DEMO_ADMIN = ("Demo Admin", "admin@freeroom.example")
DEMO_FACULTY = [("Dr. Demo Faculty One", "faculty1@freeroom.example", "FAC001"), ("Dr. Demo Faculty Two", "faculty2@freeroom.example", "FAC002")]
DEMO_STUDENTS = [("Demo Student One", "student1@freeroom.example", "DEMO0001"), ("Demo Student Two", "student2@freeroom.example", "DEMO0002"),
                 ("Demo Student Three", "student3@freeroom.example", "DEMO0003")]
DEMO_SECTION = {"code": "DEMO-CSE-2-A", "department": "CSE", "year": 2, "section_name": "A", "academic_year": "2026-27", "semester": "WINTER"}
DEMO_COURSES = [("DEMO101", "Database Systems"), ("DEMO102", "Computer Networks")]

# default period grid used only if academic_periods is empty (edit rows in the DB / PUT /timetable/periods to change)
DEFAULT_PERIODS = [(1, "08:00", "08:50"), (2, "08:50", "09:40"), (3, "09:40", "10:30"), (4, "10:30", "11:20"),
                   (5, "11:20", "12:10"), (6, "12:10", "13:00"), (7, "13:00", "13:50"), (8, "13:50", "14:40"), (9, "14:40", "15:30")]

# Weekly timetable: contract

`/app/schedule` becomes a weekly timetable that repeats every week, like a university class
schedule: Monday–Saturday (Sunday allowed but hidden unless used). The old date-based
`schedule_blocks` stay in the database and the export; their API is untouched.

## Table (migration `migrations/012_timetable.sql`)

```
timetable_entries
  id SERIAL PK, user_id TEXT NOT NULL → users ON DELETE CASCADE
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7)   -- 1 = Monday … 7 = Sunday
  start_min SMALLINT NOT NULL CHECK (start_min BETWEEN 0 AND 1435)
  end_min SMALLINT NOT NULL CHECK (end_min BETWEEN 5 AND 1440), CHECK (end_min > start_min)
  title VARCHAR(120) NOT NULL
  kind TEXT NOT NULL DEFAULT 'lecture' CHECK IN ('lecture','practice','lab','seminar','other')
  room VARCHAR(60) NOT NULL DEFAULT '', teacher VARCHAR(80) NOT NULL DEFAULT ''
  note TEXT NOT NULL DEFAULT '' (≤ 500)
  color TEXT NOT NULL DEFAULT 'accent'   -- same list as lib/schedule.js colors
  created_at, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
Index on (user_id, weekday, start_min). Limits: 30 entries per weekday, 150 per user
(400 `LIMIT_REACHED`). Minutes in steps of 5 (400 `VALIDATION_ERROR` otherwise).
Overlapping entries are allowed (the UI warns).

## Routes (all via `api()`; user from the session; owner checked in SQL)

| Method & path | Body | Response |
|---|---|---|
| GET `/api/timetable` | — | `[entry]` ordered by weekday, start_min, id |
| POST `/api/timetable` | `{weekdays:[1..7] (1–7 distinct values), start_min, end_min, title, kind?, room?, teacher?, note?, color?}` | `[entry]` one per weekday, 201, one transaction (per-user lock like other create routes) |
| PATCH `/api/timetable/:id` | any of `{weekday, start_min, end_min, title, kind, room, teacher, note, color}` | entry |
| DELETE `/api/timetable/:id` | — | `{ok:true}` |

Entry shape: `{id, weekday, start_min, end_min, title, kind, room, teacher, note, color, created_at, updated_at}` (numbers as numbers).

Account export adds `timetable_entries`.

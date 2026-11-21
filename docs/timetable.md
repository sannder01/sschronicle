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

## Daily routine update (migration `migrations/013_routine.sql`)

The timetable is a personal **daily routine** (not only classes).

- `kind` values become categories: `study`, `work`, `sport`, `food`, `rest`, `other`
  (default `other`). The migration maps old values: lecture/practice/lab/seminar → `study`,
  `other` stays; then replaces the CHECK constraint (drop the old one by looking up its name in
  `pg_constraint` for `timetable_entries` and the `kind` column; do not assume the name).
  Column default becomes `'other'`. `room` is shown as "place"; `teacher` stays but the UI no
  longer uses it.
- Done marks per date:

```
timetable_done
  entry_id INTEGER NOT NULL → timetable_entries(id) ON DELETE CASCADE
  user_id TEXT NOT NULL → users ON DELETE CASCADE
  day DATE NOT NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  PRIMARY KEY (entry_id, day)
```
Index on (user_id, day).

| Method & path | Body | Response |
|---|---|---|
| GET `/api/timetable/done?day=YYYY-MM-DD` | — | `{day, entry_ids:[...]}` marks of the user for that date |
| PUT `/api/timetable/:id/done` | `{day, done: boolean}` | `{day, entry_id, done}` — idempotent. 400 `VALIDATION_ERROR` if `day`'s weekday (ISO, Monday = 1) is not the entry's weekday, or `day` is more than 1 day in the future or more than 30 days in the past (compare with the user's local date from `users.settings->>'timezone'`, default UTC; see `lib/dates.js` helpers). 404 if the entry is not the user's. |

Export adds `timetable_done`.

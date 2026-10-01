# Notes data and synchronization

Notes live at `/app/notes?folder=<id|all|unfiled|trash>&note=<id>`. The query string drives selection, so direct links and browser Back/Forward work. Desktop shows folders, list and editor; mobile uses successive screens. The visual reference is Apple's Notes guide: https://support.apple.com/en-gb/118442. Mobile browser emulation does not establish pixel accuracy or physical iPhone keyboard behavior.

## Storage and migration

`migrations/002_notes.sql` adds `document JSONB`, integer `version`, `pinned` and `deleted_at`. Every legacy text line becomes a paragraph, including empty and trailing lines. Legacy HTML-looking content remains literal text. The `content` text column remains as a projection for search, export and older readers. No old notes are deleted.

`document` uses a strict Tiptap JSON subset: document, paragraph, text, hard break, headings (levels 1–3), bold, italic, bullet/ordered lists and interactive task lists. The validator rebuilds allowed attributes and rejects unsupported node structures, marks, oversized and deeply nested documents. The editor never inserts stored HTML. Tiptap 3 is used for maintained security fixes.

`GET /api/notes` includes active and deleted notes belonging to the authenticated user. Creation accepts title, document and optional folder_id. `PATCH /api/notes/:id` requires a version and accepts title/document/folder_id/pinned/deleted. The route locks the owned row, checks its version, updates atomically and increments the version. A stale write returns `409 VERSION_CONFLICT` plus the user's current note. Editing a trashed note requires recovery. Permanent `DELETE` requires an already trashed note, matching version and `confirm: "DELETE"`. Folder deletion preserves its notes without a folder and increments their versions.

## Autosave

`lib/notes/autosave.mjs` owns an independent serial queue for each note. New edits are written synchronously to an account- and tab-specific local draft before a debounced request. If the user types during a request, the next request carries only the latest text and the newly acknowledged server version. Switching notes flushes the previous queue; unmount flushes remaining queues without aborting requests that may already have committed. Server responses for A cannot replace the editor for B.

Draft keys are `chronicle:note-draft:v1:<encoded user id>:<note id>:<tab id>`. Storage failure is shown explicitly. Unsaved changes register `beforeunload`; recoverable drafts protect against mobile browsers that skip unload events. Closing a tab before synchronization may therefore require review on the next visit.

Network/session errors retain the draft and show Retry. Version conflicts stop the queue until the user compares the server version and chooses to use it, explicitly replace it with local text, or save the local text as a separate note. Recovered drafts always require review, even when the base version matches, because a lost response or another tab might have changed ownership of a draft. Resolving a recovered snapshot cannot remove a newer snapshot written by another tab. Deletion/moving/pinning wait for the note's queue; unsaved conflicts must be resolved first.

Private local caches are cleared by the shared sign-out workflow. PostgreSQL is authoritative; local drafts provide recovery, not offline account storage.

## Verification

`node --test tests/notes.test.mjs` checks text migration, unsafe formatting, timezone date grouping, rapid edits with delayed responses, switching A to B, network failure/retry, explicit version conflict handling, recovered drafts, account/tab separation, delete/save ordering, session expiry on unmount and unavailable local storage. Live route ownership, migrations and browser UI scenarios belong to the application-wide integration checks.

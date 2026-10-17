# Round 1 review: collaboration as two people

- **Date:** 2026-10-17
- **Live app:** https://naqsha-242926648187.us-central1.run.app
- **Tester:** QA agent, using the built-in browser (desktop at 1280x800, 1366x768, 1440x900 and 1024x768; phone at 375x812).
- **Scope:** Share and the client link; the client view at `/s/<token>`; comments, authors, filters, replies, edit, and delete with undo; applying chosen comments; typed revisions in the Ask bar; the Revisions page; and role gating.

## How the test was set up

- **Owner:** a guest. I made a fresh copy of "Sample · 10 marla modern home, Johar Town" named **"Collab QA round 1 · 10 marla"** (`p_0dca02d101d0`), using `POST /clone {fresh:true}`. Other testers share this browser profile, and the de-duplicated clone would have been shared with them.
- **Client:** the browser's tab cap (9) was full of other testers' tabs for the whole session, so I could not open a second tab. I played the client in the same tab at `/s/VPDXGqFJUG420qlq8YYjTOG-`.
  - So the client counted as a different person, I overrode `localStorage.getItem("naqsha.uid")` in memory for that page only, with a separate guest id. Nothing was written to storage.
  - The "arrives without a reload" checks posted the client's comments and replies through the share API, using the client's id, while the owner page stayed open.
- **Client link:** I turned it on with `POST /api/projects/{pid}/share {enabled:true}` (as the guest owner). The UI does not let a guest open Share (issue 1).
- **Versions made:** v3 (2 applied comments) and v4 (Ask: "make the kitchen bigger") came from the UI. v5 ("make the front lawn planting a little greener") I started through the API, only to check whether the client view picks up a new version (issue 5).
- **No accounts were created.** Team-role flows (invite by email, Team filter with real team members) need accounts, so I could not test them.

## What works (verified)

- **Client link**
  - `/s/<token>` opens a calm, read-only view: the name capsule ("Shared with you · You can comment"), Plan · House, Comments, Orbit/Walk, Comment, the Ask bar ("Leave a note for the owner") and **Approve vN**.
  - **Plan:** shows each floor with numbered pins; the floor stack switches floors.
  - **Walk:** starts at the main door. Pointer lock is refused in the embedded browser, so it falls back to "Drag to look around". WASD moves, and a minimap offers R/1/G.
  - An invalid token shows "This link isn't working / This link is no longer shared."
- **Client comments**
  - Pinning on the house opens a composer with a snapshot, the auto-tagged place ("Drawing Room window glass, ground floor") and an inline "Your name". An empty name is blocked ("Add your name to post.").
  - The comment then appears as **You · Client** with an SM avatar.
  - **Ask-bar notes:** text typed into Ask asks for a name (empty is blocked: "Add your name to continue."), then posts a "Whole home" note ("Sent to the owner"). It never revises.
  - **Replies:** the client can reply to the owner's comment and to their own.
  - **Approve v3** posts "Approved version 3." and shows the toast "Approval sent to the owner".
- **Live updates, both ways, with no reload**
  - A client comment reached the open owner page in about 11 s, and a client reply in about 14 s (owner polls every 20 s).
  - An owner reply reached the client view in about 4 s (client polls every 10 s).
  - The Comments count updated each time.
- **Authors:** the owner sees "Sana Malik · Client", "You · Owner" and Naqsha replies under the نقشہ avatar. Avatars are initials in role colours (owner teal, client magenta).
- **Filters (owner):** All, Mine, Team, Client, Open and Resolved each returned exactly the right comments. "Nothing here with this filter." shows for an empty result.
- **Edit:** Edit opens with the caret at the end (`selectionStart = selectionEnd = 56 = length`). The saved text persisted on the server.
- **Delete with undo:**
  - Delete removes the comment and its 3D pin at once, and the toast "Comment deleted · Undo" appears.
  - Undo restores it, and it was still on the server 7 s later.
  - Without Undo, the DELETE is sent after the 5 s window.
- **Apply chosen comments**
  - "Apply 3 open comments…" opens "Choose what to change" with every open comment ticked. Unticking one changes the button to "Apply 2 comments".
  - The revision applied only the 2 picked comments. The unpicked one stayed `open`.
- **Progress feed:**
  - The Conversation sheet shows "Your changes", which ticks off: Reading your 2 notes… → Looking at Front Balcony, Master Bedroom… → Checking the change against the LDA and livability rules… → updating furniture per room → Saving the revised version… → Changes (4 bullets) → Version 3 is ready.
  - The top capsule reads "Revising from 2 comments" and ends with "Version 3 is ready · What changed".
- **Naqsha's replies in the threads**
  - Each applied comment got a reply from Naqsha (`author.role = "agent"`, `status: resolved`, `version_id` = v3), and its status changed to **Done**.
  - Naqsha also used a reply in the thread ("Also an island counter if it fits") and added a kitchen island.
  - **The client sees the answers:** after a reload the client's "On earlier versions" shows both threads with "Done" and Naqsha's answers, plus the older "Not possible" thread with its reason.
- **Typed change in the Ask bar ("make the kitchen bigger")**
  - The command popover shows "Ask Naqsha · make the kitchen bigger". Enter starts a revise ("Revising from 'make the kitchen bigger'").
  - **Re-attach:** after navigating away and back, the page re-attached to the running revise.
  - **Result:** v4, titled "make the kitchen bigger" (Open Kitchen 9' × 15'3" → 10' × 15'3", +15 sq ft; 36/36 LDA, 9/9 livable).
- **Revisions page**
  - **Version rail:** v4 (Latest) / v3 / v2 / v1, each with its source ("From 2 comments", the quoted request, "The first design") and LDA/livable counts. "Version 4 · in progress" shows during a run.
  - **"What Naqsha is doing":** a timestamped log of the run.
  - **"What changed":** per-room before → after with sq ft deltas and "From 1 comment".
  - **"Your comments":** each thread with Naqsha's answer.
  - **Before · Wipe · After plan compare:** changed rooms are outlined, with a floor switch.
- **Role gating (client)**
  - **In the UI:** no Brief or Concepts, no Share, no "Apply", no Edit, Delete or "Mark as done", and Ask posts a note.
  - **On the server, with the client's guest id:** `POST /revise`, `GET`/`PATCH`/`DELETE /projects/{pid}`, `POST /share`, `GET /members`, `PATCH`/`DELETE /comments/{id}` and `POST /design` all return **404**.
  - The public share payload uses `CLIENT_FIELDS`, with no brief or share token.
- **Phone (375x812)**
  - **Client:** the top row (name, comments with count), a full-width Plan/House switch, and the dock at the bottom. Comments open as a bottom sheet.
  - **Owner:** the comments bottom sheet has wrapped filter chips and a visible "…" menu (not hover-only).
- **Console:** no app errors. The only 404s came from my deliberate probes and the invalid token.

## Issues

Each issue lists its severity, area and repro, with the fix I would expect.

### 1. Security: the public client link leaks guest ids, which are the guests' login credentials (major)
- **Area:** sharing / API.
- **Problem:** `GET /api/share/{token}` needs no authentication. It returns `comments[].author.id` and `replies[].author.id`. For any guest author (the owner while a guest, and every client), that id is their raw `X-Naqsha-User` guest UUID.
- **Why it matters:** the backend treats that UUID as the whole identity. `role_of()` → `owner_keys` includes `guest_id`.
- **Proof:** the owner's `localStorage["naqsha.uid"]` (`7c27b88c-…-cbadfcae4ffd`) appears verbatim in the public share payload. So do the client's id and a sample creator's id (`dc96fe0a-…`).
- **Impact:**
  - Anyone holding a client link can copy a commenter's id into `X-Naqsha-User` and act as that person on their own guest homes.
  - For a guest owner, that means owner rights: edit, revise, share, delete.
  - For a guest client, it means every home in their own guest workspace.
- **Not tested:** I did not use a leaked id against anyone else's data.
- **Repro:** turn on a client link on a guest-owned home that has comments, then run `fetch('/api/share/<token>').then(r=>r.json())` and read `comments.map(c=>c.author.id)`.
- **Expected:** never send raw guest ids to other people.
  - Send an opaque per-project author handle (for example an HMAC of the id), or drop `id`.
  - Return a boolean `mine` computed server-side for the caller.

### 2. A guest owner cannot share at all (major)
- **Area:** sharing / auth.
- **Problem:** every Share entry point (the top-right Share, the title menu's "Share…", the Next pill "Share", the ⌘K "Share…") calls `requireAccount("share")`.
  - It opens "Create an account to share", and there is no way past it.
  - "Or keep going as a guest. Your homes stay in this browser." is plain text, not a button.
- **The backend allows it:** `POST /api/projects/{pid}/share` works for a guest owner (200, token returned).
- **Impact:** a judge or visitor without an account can never reach the client link, so the whole collaboration story is invisible to them.
- **Repro:** as a guest, open any home → click Share → you get the sign-up form. Esc closes it; there's no Share dialog.
- **Expected:** let a guest turn on the client link (and copy it) without an account. Ask for an account only for email invites (or for "Save your work"). At least, make "keep going as a guest" a real action.

### 3. Client view: the Ask dock covers Walk and Comment (major)
- **Area:** client view layout.
- **Problem:** on desktop widths below ~1440, the bottom dock is drawn over the Orbit/Walk toggle and the Comment button, which share its row. They become unclickable (`elementFromPoint` returns the dock's textarea).
- **Measured:**

  | Viewport | Comments sheet open | Comments sheet closed |
  |---|---|---|
  | 1280x800 | Walk and Comment fully covered | Comment's right edge (the "C" key hint) under the dock |
  | 1366x768 | Comment covered | — |
  | 1024x768 | Walk and Comment covered | Comment covered |

- **Repro:** at 1280x800, open `/s/<token>` → open Comments → try to click Walk or Comment.
- **Expected:**
  - The client's Orbit/Walk/Comment row sits above the dock, as it does in the owner's House view (owner controls are at y≈413 and the dock at y≈473 on the 800-high frame).
  - Or the dock narrows and starts after the controls.

### 4. Unapplied and late comments are stranded on the old version (major)
- **Area:** comments / revise workflow.
- **Owner's view after a revision:**
  - The Comments sheet says "No comments yet". The Comments count disappears.
  - The 3D pins are gone. The Next pill no longer offers "Revise with N comments".
- **Hidden, unless the owner opens the version picker and selects v2:**
  - The threads with Naqsha's answers.
  - Any comment the owner unticked in "Choose what to change" (still `open` on v2).
- **Can't be applied later:** "Apply" is only offered on the latest version (`canApply` requires `isLatest`), so a stranded open comment can never go into a later revision.
- **Same for late client notes:** the client's notes posted while v4 was being generated landed on v3 ("make the kitchen bigger", "Approved version 3.") and are equally hidden from the owner on v4.
- **The client is better served:** the client sheet has "On earlier versions"; the owner's sheet does not.
- **Repro:**
  1. Have 3 open comments on v2.
  2. Apply 2 → v3.
  3. Open Comments on v3: it says "No comments yet", and the third comment can't be applied.
- **Expected:**
  - Carry open comments forward to the new version, or list them in the owner's sheet ("Still open from v2", with Apply).
  - Show the resolved threads with Naqsha's answers under "On earlier versions", as the client sheet does.

### 5. The client view never picks up a new version without a reload (minor)
- **Area:** client view.
- **Problem:** the 10 s poll in `ClientView` refreshes only `comments`. The `project`, the version and "Approve vN" stay as they were at page load.
- **Effect:** a client who keeps the link open while the owner revises keeps commenting on, and approving, the old version, which feeds issue 4.
- **Verified live:**
  - With the client link open on v4, I started a revise from the owner. The server's `current_version_id` became v5 (versions 1–5), but the client view still showed **Approve v4** after more than 3 poll cycles.
  - Earlier, the client posted "Approved version 3." while v4 was being built.
- **Also:** the poll re-downloads the full `/api/share/{token}` payload (68 KB, the plan included) every 10 s, though `/api/share/{token}/comments` (7 KB) exists.
- **Expected:**
  - Poll the lighter comments endpoint.
  - Check `current_version_id`. When it changes, show "Version 4 is ready · View" (or switch to it).

### 6. Pin colours differ between the 3D/plan pins and the Comments sheet (minor)
- **Area:** comments visuals.
- **Where the colours come from:**
  - **3D and plan pins:** `authorHue()`, a hash of the author id across 6 hues.
  - **Comments sheet:** the avatar and pin-number badge use `roleColor(role)`.
- **Example:** the owner's comment #1 is amber `#A8641A` in 3D and on the plan, but its "1" badge and avatar in the sheet are teal `#0D7C72`. Client comment #2 is slate in 3D but magenta in the sheet.
- **Why it matters:** DESIGN.md asks for a number "that matches in Plan and House", in the author's hue. Matching pin 2 in the scene to the right card relies on the number alone.
- **Expected:** one colour source for pins, badges and avatars.

### 7. A client's reply posts as anonymous "Client" (minor)
- **Area:** client comments.
- **Problem:** the name is asked only for a new comment or an Ask note. A client whose first action is **Reply** posts as "Client · Client" (`author_name` is undefined).
- **Effect:** their later comments carry their real name, so one person shows as two authors. The early reply isn't counted under "Mine".
- **Repro:** on a fresh client link (no saved name), open Comments → Reply on the owner's comment → send.
- **Expected:** ask for the name once, the first time the visitor writes anything, replies included.

### 8. "On earlier versions" ignores the filters (client sheet) (minor)
- **Area:** comments filters.
- **Problem:** with **Mine** (or Team, Client, Open) selected, the "On earlier versions" section still lists every earlier comment, including the owner's.
- **Repro:** client view → Comments → Mine: the owner's "Can we extend the car porch…" still shows under "On earlier versions".
- **Expected:** apply the same filter to that section.

### 9. Approval is just an open comment (minor)
- **Area:** client approve.
- **Problem:** **Approve vN** posts an ordinary comment, "Approved version N.", with status `open` and a general pin. The owner then sees it as an open change request:
  - it counts toward "Revise with N comments";
  - it is pre-ticked in "Choose what to change", so it would be sent to the reviser as an instruction.
- **Also:** its pin sits exactly on top of other "Whole home" notes (same general anchor), so one hides the other.
- **Expected:**
  - Record approval as its own kind or status, for example "✓ Approved by Sana", resolved by default and excluded from Apply.
  - Offset general pins.

### 10. The client walk has no room navigator (minor)
- **Area:** client view / walk.
- **Problem:** the owner's House has **Rooms** (the room navigator), but the client's walk offers only WASD/drag and the minimap. There is also no **Comment** button in client walk mode.
- **Expected:** the same Rooms navigator for the client, since walking room by room is what the dock line promises ("…or walk through it room by room").

### 11. The Revisions page stays in "live" mode when a run finishes there (minor)
- **Area:** Revisions page.
- **Problem:** if the owner watches a revise finish on the Revisions page ("Follow"), the result is incomplete until a reload:
  - The right panel keeps the in-progress caption "The plan as it stands; changes appear here as Naqsha makes them."
  - There is no Before · Wipe · After switch.
  - "What changed" lacks the per-room before → after deltas.
- **Also:**
  - Steps replayed on re-attach all show the re-attach time ("2:10" for the first three steps).
  - After a re-attach the House capsule loses the request text ("Revising from your changes" instead of "Revising from 'make the kitchen bigger'").
- **Repro:** type a change in Ask → click "Follow" → wait for "Version 4 is ready".
- **Expected:** swap to the finished compare and deltas when `done` arrives, and keep the original event times.

### 12. Progress-feed polish during a revise (polish)
- **Duplicate step:** "Checking the change against the LDA and livability rules…" appears twice in a row with nothing to tell them apart. The second is the fix-loop pass.
- **Status lines disagree:** at the same moment the top capsule said "All 45 checks pass", while the feed and the dock line still said "Checking…".
- **Clipped capsule:** with the Conversation sheet open on the left, the top-centre status capsule slides under the sheet when its text is long ("…sing from 2 comments / …oking at Front Balcony…").
- **Stale chips:** the Conversation sheet still shows setup chips ("Show me layout concepts", "Review LDA setbacks for 10 marla") during a revise.
- **Both sheets open at 1280x800:** the Ask field shrinks to about 90 px and shows only "Tell".

### 13. Name and role repeat (polish)
- **Area:** comments.
- **Problem:** guest authors show their role twice: "Owner · Owner · just now" and "Client · Client · 10 minutes ago". The fallback name is the role.
- **Expected:** "Owner · just now", or drop the role caption when the name equals the role.

### 14. The sticky floor/room header lets content peek above it (polish)
- **Area:** Comments sheet.
- **Problem:** when the list scrolls, a few pixels of the comment above show between the sheet title and the sticky group header ("Ground floor · Drawing Room").

### 15. The client's command popover says "Ask Naqsha" (polish)
- **Area:** client view.
- **Problem:** typing in the client's Ask shows "Ask Naqsha · …". Enter actually sends a note to the owner.
- **Expected:** "Send to the owner · …".

## Not tested
- Team role: invite by email, the role menu, Remove, and the Team filter with a real team member. All need accounts.
- The Share dialog UI itself (toggle, Copy link, "Link copied" toast): it can't be reached as a guest (issue 2).
- Two real tabs side by side: the tab cap was full, so I emulated the second person in one tab (see setup).

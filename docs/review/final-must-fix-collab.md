# Final must-fix check: collaboration (share, comments, revise, revisions)

- **Date:** 2026-10-17
- **Live app:** https://naqsha-242926648187.us-central1.run.app
- **Build tested:** Cloud Run revision `naqsha-00008-6qt` (deployed 05:59 UTC, serving 100%), bundle `assets/index-BaiWuXqd.js`.
- **Tester:** QA agent in the built-in browser, two tabs of its own at 1440x900, plus 375x812 for the phone check. Headless Chrome (a fresh profile, so a genuinely new visitor) was used for the high-resolution client captures.
- **Evidence:** screenshots are in `docs/review/final-must-fix-collab/`. They are referenced by file name below.

## Set-up

- **Home:** the sample "Sample · 10 marla modern home, Johar Town" (`p_5a5893a2bcaa`).
  - Clicking the sample opened an existing de-duplicated copy (`p_c870411a38db`), which belongs to the guest profile other testers share.
  - To avoid stepping on them, I made my own copy, **"Collab QA final · 10 marla"** (`p_09764f64bdaa`), with `POST /clone {fresh:true}`. It starts at v1/v2 of the sample.
- **Owner:** the shared guest profile in tab 1.
- **Client "Sana Malik":** tab 2, a real second tab.
  - Before the client route mounted, I overrode `naqsha.uid` in that page's memory only, so the client was a different person from the owner. Nothing was written to storage. The server confirmed the separate identity: her comment came back `mine: true`, author `a_21f8…`, role `client`.
- **Second client "Bilal Ahmed":** posted one comment and one reply through `POST /api/share/{token}/…`, with a third guest id. This gave three people on one home.
- **No accounts were created,** so the Team role was not tested.
- **Cleanup:** at the end I turned the client link off from the Share dialog.

## Verdicts on the five focus items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Share with a client: turn on the client link on a copy, open `/s/<token>` in a second tab, see the design, comment with a name | **FIXED** | See below |
| 2 | Comments from different people show authors and roles, and replies work | **FIXED** | See below |
| 3 | The owner applies chosen comments, the revise runs, and Naqsha's answers appear in the threads (the client sees them) | **FIXED** (mechanics) | See below. Two quality problems in what the revise did are logged as issues B and C. |
| 4 | A typed change in the Ask bar runs a revise | **PARTLY** | It runs, but it silently includes every open comment, even one the owner held back on purpose (issue A). |
| 5 | The Revisions page is clear | **PARTLY** | The structure is clear, but the check counts contradict each other and the typed request vanishes after a reload (issues D and E). |
| 6 | Collaboration doesn't make the app less intuitive | **PARTLY** | The surfaces are calm and easy to find. Issues A and B break the owner's sense of control. |

### 1. Share with a client

- **Turning the link on (guest owner, House view):**
  - **Share** opens "Share this home": "Send your client a link to view and comment. No account needed for that."
  - Turning on **Client link** showed the link field, **Copy link** and the toast "Client link is on, and copied". Evidence: `01-owner-share-dialog-client-link-on.jpg`.
  - "Invite by email" asks for an account, which is right.
  - So round 1's blocker (a guest could not share) is gone.
- **What the client sees (tab 2, `/s/QTXOzqw1tAg1fVbrpnU6NzfB`):**
  - The capsule "Collab QA final · 10 marla · Shared with you · You can comment", a Plan · House switch and Comments.
  - Orbit/Walk, **Rooms (M)** and **Comment (C)**, sitting above the dock.
  - The note box "Leave a note for the owner" and **Approve v2**.
  - Plan shows the vector plan with the floor stack and "Walk through it".
  - Evidence: `client-link-desktop-1440.png` and `client-link-plan-1440.png` (headless, fresh visitor), and `17-client-link-phone-375.jpg` (phone, no horizontal scroll: `scrollWidth` 375).
- **Commenting with a name:**
  - Comment, then a click on the house, opened the composer with the auto tag "Curtains in the master bedroom, first floor", a snapshot, and **Your name** ("So the owner knows who wrote this. Asked once.").
  - The comment posted as **"You · Client · just now"**, with the toast "Comment pinned". Evidence: `02-client-posted-comment-as-sana.jpg`.
  - The client's Ask posts a "Whole home" note. Its popover reads "Send to the owner · …" and the toast reads "Sent to the owner".
- **Live, both ways, without a reload:**
  - The client's comment reached the open owner tab within 20 s: "Comments 1", and Next became "Revise with 1 comment".
  - The owner's comment and reply reached the client within one 10 s poll.
- **Security re-check:**
  - The public `GET /api/share/{token}` and `/comments` contain **no raw guest UUIDs**. Authors are opaque handles (`a_…`) and `brief` is absent.
  - With the client's id, `POST /revise`, `POST /share` and `GET /projects/{pid}` all return **404**.

### 2. Authors, roles and replies

- **Owner's Comments sheet:**
  - Comments are grouped by place: "Ground floor · Front boundary wall", "First floor · Master Bedroom", "Roof · …".
  - Each one shows a hued initials avatar, the name, the role and the time: **"Bilal Ahmed · Client"**, **"Sana Malik · Client"** and **"You"** (the owner).
  - Replies thread under the parent: Bilal's "Agree with Sana…" under Sana's comment; Sana's "Yes please, and keep space for the solar panels." under the owner's pergola comment; the owner's "Let me hold this one…" under Bilal's.
  - Evidence: `04-owner-sheet-authors-roles-replies.jpg`.
- **Client's view of the owner:** the owner shows as "Owner · just now". The old "Owner · Owner" duplicate is gone.
- **Filters (owner):** each returned exactly the right comments.
  - **Client:** Bilal and Sana.
  - **Mine:** the pergola comment.
  - **Open:** the three open comments.
  - **Resolved:** "Nothing on this version with this filter", then the earlier-version threads.
  - **Team:** the owner's comments.
- **Pins:** within one viewer, the pins, the number badges and the avatars use the same hue (Sana magenta `#C23F78`, Bilal teal `#0D7C72`).

### 3. Apply chosen comments → revise → Naqsha answers in the threads

- **The chooser:**
  - Next **"Revise with 3 comments"** opens **"Choose what to change"**: "Naqsha will make a new version with these changes and answer each one in its thread."
  - Every open comment had a ticked checkbox. Unticking Bilal's comment changed the button to **"Revise with 2 comments"**. Evidence: `05-choose-what-to-change-unticked.jpg`.
- **The run:**
  - The chooser closed and the Conversation opened with "Your changes". The capsule read "Revising from 2 comments · Reading your 2 notes…".
  - Steps ticked off: "Looking at Bedroom 2, Bath 2, … Master Dressing…", "Checking the change against the LDA and livability rules…", "Updating the furniture in…", "Updating the facade…", "Saving…".
  - **Version 3 was ready in about 150 s.** Evidence: `07-revise-progress.jpg`, `08-version-3-ready-owner.jpg`.
- **What it applied:**
  - The master glass went from 9 ft to 10 ft and the bedroom from 10 ft to 10.5 ft.
  - A steel-and-teak pergola went on the rear-right roof terrace.
  - `v3.source.comment_ids` = exactly the 2 picked comments.
- **The held comment:** Bilal's unticked comment stayed **open** and moved to v3. Next became "Revise with 1 comment". (Round 1's "stranded comments" is fixed.)
- **Naqsha's answers:**
  - Each applied thread got a Naqsha reply (نقشہ avatar) and the **Done** chip, for example "We widened the master bedroom to 10.5 ft so its front floor-to-ceiling sliding glass opening could expand to a full 10 ft…".
  - The owner's sheet lists them under "On earlier versions".
- **What the client saw:**
  - The answers appeared without a reload, with the toast **"Version 3 is ready · View"**.
  - After **View**, the house showed the pergola and the button read **Approve v3**. Evidence: `09-client-sees-naqsha-answers-v3-toast.jpg`.
- **Approval:**
  - The client's **Approve v4** stored `kind: "approval"` with status `resolved`. It shows as "✓ Approved by Sana Malik", with the toast "You approved version 4. The owner can see it in the comments."
  - It is not counted for revise: the owner's Next stayed "Share". Evidence: `15-client-approved-v4.jpg`, `16-owner-sheet-v4-approval-earlier.jpg`.

### 4. A typed change in Ask

- **The run:**
  - I typed "make the master dressing room big enough for a proper wardrobe". The popover read "Ask Naqsha · …" (`10-typed-ask-popover.jpg`), and Enter started a revise.
  - The capsule read "Revising from “make the master dressing room big enough for a prop…” · Follow". **Version 4 was ready in about 113 s.**
  - The dressing room went from 5′×5′6″ to 6′×6′6″, with a 5 ft wardrobe.
- **But:** the same run also applied Bilal's comment, the one the owner had unticked and answered "Let me hold this one for the next round" (issue A).

### 5. The Revisions page

- **What works:**
  - The version rail: v4 Latest, then v3 "From 2 comments", v2, and v1 "The first design".
  - A plain-sentence headline, **Walk through it** and **Open the plan**.
  - **"What changed":** per-change cards with before → after room deltas in mono ("Master Dressing 5′ × 5′6″ → 6′ × 6′6″ +12 sq ft", "Door 9′ wide → 10′ wide"), each tagged "From 1 comment".
  - **"Your comments":** each thread with Naqsha's answer.
  - **Plan compare:** R/1/G with Before · Wipe · After.
  - The last card can scroll clear of the dock.
  - Evidence: `11-revisions-v4-top.jpg`, `13-revisions-v3-what-changed.jpg`, `18-revisions-v4-after-reload.jpg`.
- **What is unclear:** see issues D and E, plus N (polish).

### 6. Intuitiveness

- **What works:**
  - One Share button and one dialog.
  - The name is asked once, inline in the composer.
  - Next names the move: Revise with N comments, then See what changed, then Share.
  - The chooser defaults to everything, with plain checkboxes.
  - The client gets a calm, read-only shell with "Send to the owner" wording.
  - Nothing in the collaboration flow needs explaining.
- **What breaks it:**
  - **Issue A:** typing in Ask quietly does more than you asked, and overrides a choice you just made in the chooser.
  - **Issue B:** a later change quietly undoes an earlier "Done".
  - Both damage the promise that "the owner picks which comments go into a revision".

## Round-1 collaboration issues, re-checked

| Round-1 issue | Verdict | Evidence |
|---|---|---|
| 1. The public link leaks guest ids | **FIXED** | No UUIDs in `/api/share/{token}` or `/comments`. Authors are `a_…` handles. |
| 2. A guest owner cannot share | **FIXED** | The Share dialog opens for a guest, and the toggle gives a link (`01-…`). |
| 3. The client dock covers Walk and Comment | **FIXED** at 1440 and 375 | The Orbit/Walk/Rooms/Comment row sits above the dock (`client-link-desktop-1440.png`, `17-…`). 1280 was not re-tested. |
| 4. Unapplied comments are stranded on the old version | **FIXED** | The unticked comment followed v3 and stayed applicable. The owner's sheet shows "On earlier versions". |
| 5. The client view never picks up a new version | **FIXED** | "Version 3 is ready · View", then Approve v3 (and the same for v4). |
| 6. Pin hue differs between the pins and the sheet | **FIXED** (within one viewer) | The same hue on the pin, the badge and the avatar. The cross-viewer difference is new issue I. |
| 8. "On earlier versions" ignores the filters | **FIXED** (owner) | Mine, Client and Open hide unrelated earlier threads. Resolved and Team show the right ones. |
| 9. Approval is just an open comment | **FIXED** | `kind: approval`, resolved, "✓ Approved by …", and excluded from Revise. |
| 10. The client walk has no room navigator | **FIXED** | The client HUD has **Rooms (M)**. Walking itself was not exercised. |
| 12. Progress-feed polish: stale chips, contradicting tallies | **NOT FIXED** | See issues D and M. |
| 13. "Owner · Owner" | **FIXED** | "Owner · just now" for clients, "You" for the owner. |
| 15. The client popover says "Ask Naqsha" | **FIXED** | "Send to the owner · …". The field is named "Note for the owner". |

## Issues

### A. A typed change in Ask silently applies every open comment, including ones the owner held back (major)
- **Area:** revise, owner control.
- **What happened:**
  1. The owner unticked Bilal's comment in "Choose what to change".
  2. The owner replied in its thread "Let me hold this one for the next round, Bilal."
  3. The owner then typed an unrelated change into Ask.
  4. v4 applied Bilal's comment too: `v4.source = {comment_ids: ["cm_5c16634466ec"], instruction: "make the master dressing room…"}`.
- **What everyone then saw:**
  - The run said "Reading your 1 note and your request…", and the rail says "From 1 comment and your request".
  - Bilal's thread now reads: owner "Let me hold this one…", then Naqsha **Done**, "We updated the front boundary wall…".
  - The client sees that contradiction, and so does the Revisions page (`19-revisions-v4-your-comments-contradiction.jpg`).
- **Nothing warns the owner:** Ask shows only "Ask Naqsha · <text>".
- **Root cause:**
  - The Ask handler in House calls `startRevise([], text)` (`web/src/app/explore/HouseView.tsx:311`).
  - `startRevise` sends `comment_ids: ids.length ? ids : undefined` (L261-265).
  - The server reads a missing `comment_ids` as "every open comment on this version" (`api/app/main.py:783-787`).
- **Repro:** have 2 open comments → apply 1 of them → type any change in Ask → read `source.comment_ids` of the new version.
- **Fix:**
  - A typed change should send `comment_ids: []` (instruction only).
  - Or say it up front ("…and 1 open note") and let the owner choose.

### B. A later revision silently undoes a client's "Done" request (major)
- **Area:** revise, trust in thread answers.
- **The history of the master bedroom's front glass (`f_master_slide`):**
  - **v2:** 9 ft.
  - **v3:** 10 ft (bedroom 10′6″). Sana's thread says **Done**: "…could expand to a full 10 ft".
  - **v4** (the wardrobe request): the bedroom shrank to 9′6″ and the glass to **8 ft**, which is narrower than before the client asked.
- **Nothing mentions it:**
  - Naqsha's v4 answer ("We enlarged the master dressing room… while keeping a spacious 6 ft by 8 ft master bath") does not mention it.
  - Sana's "Done" thread is not touched.
  - "What changed" on v4 shows "Master Bedroom −14 sq ft" but no door delta (v3 showed "Door 9′ wide → 10′ wide").
- **Repro:** apply "wider window" → then ask for a bigger dressing room → compare `plan.openings[f_master_slide].width_ft` across v2, v3 and v4.
- **Fix:**
  - Treat earlier resolved comments as constraints for the reviser (keep them unless the request conflicts, and then say so).
  - When an opening shrinks, show its delta in "What changed".
  - Reopen or annotate the affected thread.

### C. A revise from comments introduced a new livability failure and told the client the opposite (minor)
- **Area:** revise quality.
- **What v3 added (as-built checks):**
  - **fail** "No wardrobe in the Master Dressing": the bedroom grew into it.
  - **warn** "Pergola stands in the roof area kept clear for solar panels".
- **What the client was told:** Naqsha's answer to Sana says the pergola keeps "the front and central roof area completely clear for your solar panels".
- **What the owner sees:** only "3 notes from the 3D model" in the capsule (`14-owner-3d-model-notes.jpg`). The tallies and the Revisions header did not change ("36 of 36 LDA checks pass, 5 to check").
- **Fix:**
  - Feed the as-built results back into the reviser's check loop.
  - Don't answer "Done" with claims that the engine contradicts.

### D. Check counts disagree across surfaces for the same version (minor)
- **Area:** Revisions and status line clarity.
- **For v4 at once:**
  - The capsule: "36/36 LDA · 10/15 livable · 5 to check · 2 notes from the 3D model".
  - The Revisions header: "36 of 36 LDA checks pass, 5 to check".
  - The run log on the same page: "All 45 checks pass".
- **The untouched sample (v2) already reads "10/15 livable · 5 to check".** That contradicts the claim that both samples pass every livable check, at least as a client or judge reads it.
- **Fix:** one tally, used everywhere.

### E. The Revisions page loses the typed request; the new version's label is stale (minor)
- **Area:** Revisions page.
- **Lost after a reload:**
  - The rail reads "From 1 comment and your request", but the page never shows the request text ("make the master dressing room…") or Naqsha's answer to it.
  - Both appear only in the live "How Naqsha made it" log, which is gone after a reload.
- **Stale label:** right after an in-app revise, the rail labelled v4 **"A revision"** until a reload. Evidence: `11-revisions-v4-top.jpg` vs `18-revisions-v4-after-reload.jpg`.
- **Headline:** it leads with the comment change ("Finished the front boundary wall…, and 1 more change"), not the thing the owner typed.
- **Fix:**
  - Show "Your request" as a card with Naqsha's answer, next to "Your comments".
  - Refresh `project.versions[].summary` when the run ends.

### F. The roof pin label reads "Roof (roof), roof" (polish)
- **Where:** the composer tag and the suggestion chips "Move the roof (roof)" and "Change the roof (roof) to". The sheet groups it as "Roof · Roof (roof)" (`03-owner-pin-roof-label.jpg`).
- **Source:** `web/src/engine/structure/slabs-geo.ts:138` (`label: \`Roof (${U.name})\``) and `web/src/app/explore/Composer.tsx:25`.

### G. The owner stays in pin mode after posting (polish)
- **Problem:** after "Pin it", the owner's Comment button still reads "Click to pin" with the hint "Click anything to pin a note", so the next click on the house opens another composer.
- **The client is different:** its mode closes after posting (`share/HouseStage.tsx:124`).
- **Cause:** `saveDraft` in `explore/HouseView.tsx:247` doesn't clear `commentMode`.

### H. A typed revise in House doesn't open the Conversation (polish)
- **Problem:** a comment revise opens "Your changes". A typed one in House shows progress only in the capsule and the dock, because `HouseView`'s Ask `onSubmit` skips `toggleChat(true)`.
- **Spec:** DESIGN.md says a change typed into Ask opens the conversation.

### I. The owner's own pin has a different colour for the owner and the client (polish)
- **Problem:** the owner's pergola pin is amber `#A8641A` in the owner's tab and green `#2F7A3A` in the client's.
- **Cause:** the owner's payload keeps the raw id, while clients get the hashed handle, and the hue is a hash of the id.
- **Fix:** hash the same public handle for everyone.

### J. Pin numbers change between versions (polish)
- **Problem:** Bilal's pin was **3** on v2 and **1** on v3 and v4, so "see pin 3" means something different after a revise.

### K. A revoked link fails late and drops the text (polish)
- **Problem:** after the owner turned the link off, the open client page still said "You can comment". Sending a note then failed ("Couldn't save the comment · This link is no longer shared."), and the typed text was cleared.
- **Fix:** keep the text, and show the "no longer shared" state on the next poll.

### L. The Share dialog shows the toggle off for a moment (polish)
- **Problem:** when the dialog opens on a home whose link is on, the toggle renders **off** with no link field until `/members` loads (about 1 s).
- **Fix:** a loading state instead of a wrong one.

### M. Stale setup chips in the Conversation during and after a revise (polish, round-1 #12)
- **Problem:** "Show me concepts", "Add a prayer room" and "Add a study" sit above "Your changes" during and after a revise (`06-revise-started-stale-setup-chips.jpg`, `08-…`).

### N. Numbered room keys on the Revisions plan look like comment pins (polish)
- **Problem:** the compare legend "① Stair Hall · ② Dressing 3" uses the same circled numbers as comment pins, on a page that also lists comments.
- **Fix:** use letters or a different shape.

## Not tested
- **Team role:** invite by email, the role menu, and the Team filter with a real member. These need accounts, which I don't create.
- **Watching a revise finish on the Revisions page** (round-1 #11). I watched from House and then opened Revisions.
- **A client who replies before giving a name** (round-1 #7).
- **The client walk itself.** Only the Rooms entry point was checked.
- **The 1280x800 client layout.** The link was off by the time I took the high-resolution captures.

## Console
- No application errors.
- The only 404s and 422s came from my own probes (the samples by id, the client's attempts at revise and share, a malformed share comment) and from the revoked-link polls.

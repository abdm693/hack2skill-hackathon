# House SDK: engine notes for design.js authors (pasted into Argon's prompt)

## Projections (LDA)
- Nothing may cross a plot edge with a **zero setback** (a party wall). Stop at the outer wall face.
- Into an open setback, canopies, chajjas, fins, frames and similar may project past the setback line by at most:
  - **1.5 ft** where that open space is under 10 ft deep;
  - **3 ft** where it is 10 ft or more.
- The engine cuts anything beyond these limits back, with a warning, and the as-built LDA check reports it. Design inside the limits.

## Geometry semantics
- `facade.canopy({ h_ft })`: `h_ft` is the height of the canopy's **top surface** above the road crown.
- `facade.frame(region)`: the region is the frame's **outer** bounds.
- `RoomHandle.ceiling_h_ft` is **absolute** (above the road crown). `interior.accent_wall` heights (`from_h_ft`/`to_h_ft`) are **relative to the room's floor**.
- Custom geometry on the boundary wall should use a kind starting with `boundary_`, so it isn't counted as a building projection.

## Sections
- Each section runs on its own. Re-read what you need from `s.plan`, `s.room(id)` and `s.face(side, level)` instead of relying on variables from other sections.
- Prefer `furnish(...)` with `against`/`along_ft` for wall-hugging items (beds, wardrobes, sofas, TV units, kitchen counters, vanities) and `at`/`rot_deg` for free-standing ones (dining tables, coffee tables, rugs, islands).
- Use `auto_furnish(room)` for minor rooms (store, laundry, powder).

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


## What the engine guarantees (do not fight it)
- **Stairs** are built at code from `plan.stairs`: treads at least 10 in, a mid-landing as deep as the flight, and a 3 ft clear strip in front of the first riser on every floor (a dog-leg also arrives there). Stacked stairs share one layout. If the stair room is too short, the build reports it; make the stair room longer in the plan rather than shrinking the stair.
- **A flight reaches the roof.** If the plan has none from the top floor, the engine copies the stair below.
- **The mumty** grows to cover the top flight and its 3 ft top landing. Its door goes on a wall that touches that landing, at roof level, never over the stairwell, a party wall or the tank. Do not add your own roof door.
- **Guards**: every stairwell edge and every edge with a drop over 30 in gets a 3.5 ft railing in the `railing` style you chose; roof terraces stand behind the roof parapet. Do not draw your own stair or terrace railings.
- **Openings** are cut only into the wall between the two rooms they name, on their own level. An opening onto a room on another floor is not built. Doors are placed first (the main door before all); a window on the same wall is narrowed (down to 1.5 ft) or moved to make room. Any opening that cannot be built is reported, and a missing door is a fail: keep 0.3 ft between openings on one wall.
- **A stair never passes low over a door.** If a flight or landing would be less than 7 ft above the floor in front of a door below it, the engine turns the stair around (or mirrors it); if that does not clear every door, the build fails "Stair landing blocks <door>". Do not put a door under a stair's mid-landing.
- **Stair windows**: glass beside a flight or landing keeps 3 ft above the treads; the engine raises the sill, or adds a guard rail across the glass, and reports it.
- **Balconies that touch**: two balconies or terraces on an upper floor that share an edge and are not `open_to` each other get a 7 ft privacy screen between them, so one bedroom is never reached through another's balcony.

## Furniture
- `along_ft` is measured from the wall's LEFT end as you face that wall from inside the room: on the **front** wall that is its high-x end (x = room.x + room.w − along_ft); back wall: low-x end; left wall: low-y end; right wall: high-y end.
- Keep these clear (the engine moves anything placed there, or leaves it out): every door, arch and sliding door's width × 3 ft on BOTH sides plus the leaf's swing (no furniture, counter, fixture or appliance ever stands there), the open-plan crossing between rooms, the stair, its foot and top landings, and 2 ft in front of windows for tall pieces (wardrobes, bookshelves, fridges, a TV unit with its TV).
- Every bedroom gets a bed, every bath a WC, every kitchen a fridge and a hob, every dressing room a wardrobe: if the room cannot hold one with its doorways clear, the build fails. Size those rooms for them.
- TV: the `tv_unit` keeps 1.5 ft from every door and arch frame, never on the wall the room is entered through (a lounge's main-door wall), and in a bedroom only on the wall the bed faces. Put the `tv` at the same `against`/`along_ft` as its `tv_unit` (the engine lines them up anyway).
- Nightstands (`side_table`) stand on the two sides of the bed (the engine puts them there; leave 1.5 ft each side of the bed); `table_lamp`s stand on them. Hob, sink and microwave stand on a kitchen counter.
- Wall items only on solid wall: never a TV, painting, mirror, AC or towel rail over a door or window, or on an open-plan side.
- Every door and stair landing keeps a 3 ft path: leave walking room between pieces (sofa to coffee table at least 1.5 ft, 2.5 ft beside beds).
- A tiny WC or bath (under 36 sq ft) gets an outward-opening door so the WC and basin stay clear.

## Parking and the way in
- Cars go into parking bays the engine lays out in the porch (and the driveway for a further car), nose toward the house, leaving a 3 ft walkway from the pedestrian gate to the main door. Call `furnish("car_sedan" | "car_suv", { room: porch })` once per car in the brief (a 2-car porch needs two calls); the position you give only picks the nearest bay. Bays sit side by side, either side of the walkway, or one behind the other in a deep porch; a porch needs about 9 ft of width per car plus the walkway, and 18 ft of depth. A car that does not fit is a fail: "Only N of M cars fit".
- Nothing may stand on that walkway (plants, swings, motorbikes are moved).

## Roof
- `plan.roof.water_tank.material`: "plastic" (blue ribbed tank on a pad) or "concrete" (rendered RCC box). Do not model your own tank.
- `plan.roof.solar`: the engine keeps its area clear ("panels" also builds the panel rows). Keep the roof clear: no domes, cupolas, chhatris, minarets or pergolas unless the brief asks; they are reported when they stand in the solar area.

## Kinds for viewers
- Cars and motorbikes are tagged kind `vehicle`; the road, footpaths, poles, wires, street trees and neighbouring houses kind `context`. Keep custom street context in `s.landscape.street()`; tag your own context objects `kind: "context"`.

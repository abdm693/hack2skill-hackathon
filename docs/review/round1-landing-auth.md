# Round 1 review: landing, workspace, auth, share gate, mobile

**Date:** 17 Oct 2026
**Build:** live Cloud Run app (`/assets/index-CoebF8Ij.js`)
**Tool:** built-in browser, one tab
**Widths checked:** 280, 320, 375 (mobile preset), 768, 1024, 1280 and 1440 px

## Method notes

- **Shared guest identity.** Every tab in the built-in browser shares one guest identity (`localStorage["naqsha.uid"]`), so all testers' homes land in the same workspace. Another tester's home `p_156ca2b22f81` crashes that workspace (issue 1).
- **Isolated test identity.** To keep testing without touching other testers' data, I wrapped `window.fetch` in my own tab only. The wrapper rewrote the `X-Naqsha-User` header to a throwaway UUID kept in `sessionStorage`. I changed no app code and no shared storage.
- **Not done, by design.** I created no accounts, typed no passwords and sent no reset emails. Validation was tested client-side only, and I confirmed no Identity Toolkit request went out. I tested the Delete confirmation up to Cancel and Escape, but did not run the final destructive Delete.
- **Test data left behind,** all under throwaway guest ids:
  - `p_be8a8b5b7130`
  - `p_87337093a571` (renamed "QA villa copy")
  - `p_c6b151b7be83` (the crashing home)
  - `p_b549410c8afc` and `p_a54f23ba8fa0`
  - `p_b611d47095d3` and `p_86d66538ca3a` (from the race test)
  - one clone made for timing

## Issues

### 1. BLOCKER: a brief without a plot crashes the home and the whole workspace

**Repro**
1. Go to `/app` and type "A modern house for my family of five" in the composer, then press Enter.
2. The setup agent replies ("…Which development authority…") and saves `brief.plot = null`.
3. The project page immediately shows "This page didn't load". The console shows `TypeError: Cannot read properties of null (reading 'area_marla')`. It comes from `Hk`, which is `shell/DetailsDialog.tsx:13` (`b.plot.area_marla`). DetailsDialog builds its rows even while closed.
4. Go back to `/app`. The workspace also shows "This page didn't load", with `TypeError … reading 'width_ft'`. It comes from `Workspace.tsx:258` (`p.brief?.plot.width_ft` in `Thumb`).
5. "Try again" crashes again, and the error screen has no link back to your homes.

**Impact**
- The user is locked out of that home and of every other home.
- This is happening right now: the shared guest workspace in this browser is dead because of `p_156ca2b22f81` ("Untitled home", brief "Family of 5 people", `plot: null`).
- `contracts/api-types.ts` types `plot` as non-null, but the backend emits `null`.

**Expected**
- Guard every `brief.plot` read (`?.`), and make the backend never send `plot: null` (omit the field or send the brief as `null`).
- Give the error boundary a "Back to your homes" link.

### 2. MAJOR: every landing sample card opens the same home, and not the one pictured

**Repro**
1. On `/`, go to Sample homes and click "10 marla family home · Johar Town · Stone and teak".
2. It opens "Sample · 1 kanal Spanish villa" (`/app/p/p_87337093a571/house`).
3. "Courtyard frame house", "Corner home · 1 kanal · Stone and glass", "Walk through one" and the hero's "Explore a sample home" all open that same villa.

**Cause**
- `Landing.tsx` hard-codes `SAMPLES` with stock images (`/mock/concept-1.jpg`, `/landing/home-day.jpg`, `/mock/concept-2.jpg`).
- Every card calls `openSampleHome(navigate)` with no id, so it gets `samples[0]`.
- The real samples are "10 marla modern home, Johar Town" and "1 kanal Spanish villa". A "Courtyard frame house" and a "Corner home" don't exist.

**Expected:** render the cards from `/api/samples` (name, thumbnail, caption) and pass the sample id.

### 3. MINOR: opening a sample twice at the same time makes two copies

**Repro:** send two `POST /api/projects/p_f14122441822/clone` requests in parallel with the same `X-Naqsha-User`.

**Result:** two different copies (`p_b611d47095d3` and `p_86d66538ca3a`), and the workspace count is 2. Sequential opens dedupe correctly. This happens to anyone who opens a sample in two tabs or on two devices at once, because `find_clone` and `clone_project` aren't atomic.

**Expected:** an idempotent clone, for example a deterministic doc id per owner and sample, or a transaction.

### 4. MINOR: auth errors appear under the wrong field

**Repro**
- On Create account, leave the name empty. "Tell us your name. Clients will see it on what you share." appears under the Password hint, two fields below Name.
- On Sign in, leave the email empty. The email error shows under Password.

**Also**
- The red caption isn't linked with `aria-describedby`.
- It stays visible while the person types the fix.

**Expected (DESIGN.md Input):** a fail border plus a caption under that input, cleared on edit.

### 5. MINOR: focus is lost after the Rename and Delete dialogs close

**Repro**
1. Using only the keyboard, focus a card's "More for …" button and press Enter.
2. Press Down twice and Enter (Rename), then press Escape.
3. `document.activeElement` is now `BODY`.

The same happens after Delete, whether closed with Cancel or Escape. Keyboard and screen-reader users lose their place.

**Expected:** focus returns to the card's "More" button.

### 6. MINOR: phone touch targets are under 44 px, and the phone landing has no Sign in

**At 375 px**

| Page | Control | Height |
|---|---|---|
| Landing | "Open portal" | 32 px |
| Landing | Footer links | 22 px |
| Workspace | "Sign in" | 32 px |
| Workspace | Your homes / Samples tabs | 30 px |
| Workspace | Card "More" | 36 px |
| Workspace | "start with questions" | 22 px |

**Sign in:** below 640 px the landing header hides Sign in (`hidden sm:inline-flex`), so it's only in the footer.

**Expected (DESIGN.md Mobile):** 44 px targets, and Sign in reachable from the header.

### 7. MINOR: heavy first load on mobile

**Bundle:** `/assets/index-CoebF8Ij.js` is 937,515 bytes, served with no `content-encoding` and with `cache-control: private`. That means no gzip or brotli, and no long-lived caching for a hashed file.

**Thumbnails:** the workspace and Samples thumbnails are full concept PNGs of about 1.6 to 1.7 MB each. For example, `/api/assets/projects/p_68031426a48a/concepts/c_f4248981bffb.png` is 1,684,161 bytes.

**Expected**
- Compress the bundle.
- Serve `/assets/*` with `public, max-age=31536000, immutable`.
- Use resized JPEG or WebP thumbnails.

### 8. POLISH: landing copy is inconsistent

- "How it works" says "Three places" (Brief, Concepts, House), but the app has four views (Brief · Concepts · Plan · House).
- The title "Plot to approval-ready plan in minutes" sits over the line "the same afternoon".
- The Portal button appears as "Open portal" in the header, "Portal" in the footer and "Open the Portal" in the builders band. The spec calls it "Portal".

### 9. POLISH: the animation chips crowd the frame on phones

At 280 to 375 px the frame is about 248 × 169 px. The "42/42 LDA · 5/5 livable" chip, the caption chip and Replay cover about 40% of it, and the drawing's labels become unreadable.

**Expected:** smaller chips, or hide the LDA chip below `sm`.

### 10. POLISH: sample and untitled cards are hard to read

- Sample cards repeat "Sample" twice: the name "Sample · 1 kanal Spanish villa" plus a "Sample" badge.
- Copies keep the "Sample ·" prefix in Your homes.
- An "Untitled home" card's placeholder (a dashed box with a "+") looks like the New home tile next to it.
- Every "start with questions" or "New home" click leaves another empty "Untitled home" card behind.

### 11. POLISH: share and SEO metadata

- `og:image` is relative (`/og.jpg`). WhatsApp and LinkedIn previews need an absolute URL.
- `/s/<invalid>` keeps the previous page's tab title ("Your homes · Naqsha").
- A project page shows the landing title until the project loads.

## Verified working

**Landing**
- Large hero headline, subhead, "Start your home" (to `/app`) and "Explore a sample home" are all present.
- The header turns to glass on scroll, with How it works, Samples, Sign in and "Open portal" (to `/app`).
- The construction animation plays on view:
  - the plot outline draws and its dimensions count up;
  - the LDA envelope and the +0′, +11′ and +21′ levels appear;
  - walls go hatched then solid, then the stair, solar and tank;
  - a wipe reveals the day render, then the night render, with captions throughout.
- Replay restarts the animation: it shows on hover on desktop and is always visible on phone.
- three.js is lazily loaded, not on the landing.
- There are six business-focused features in a 3×2 grid, then How it works, Samples, the builders band with "Open the Portal", and the footer.
- No horizontal overflow at 280, 320, 375, 768, 1024, 1280 or 1440 px, and the landing console is clean.

**Auth UI**
- The dialog has three modes: Welcome back, Create your account (name as clients will see it, password hint) and Reset password.
- Client-side validation blocks submit with no network call for an empty email, a malformed email (`abc@def`), an empty password and an empty name. The bad field gets `aria-invalid` and focus.
- The show/hide password toggle works.
- Escape closes the dialog and returns focus to Sign in. Focus is trapped inside, and a scrim click closes it.
- Below 640 px it becomes a bottom sheet with a grabber.
- `/app/signin` and `/app/signup` pages exist with "Continue as a guest", and `?next` is sanitised.

**Guest mode**
- The workspace shows "Guest · saved in this browser" and Sign in.
- A new guest lands on the Samples tab first.
- "Save your work to an account" (workspace) and "Save your work…" (title menu) both open the "Save your work" sign-up.

**Share as a guest owner**
- Share in the header, the title menu "Share…" and the Next pill all go through `startShare`, which opens "Create an account to share".
- Dismissing that dialog does not open the Share dialog.

**Workspace**
- The composer creates a home and opens Brief.
- "start with questions" creates a home with suggestion chips.
- A double-click on New home creates only one home.

**Sample dedupe**
- Opening the 10 marla sample twice returns the same copy (`p_be8a8b5b7130`), and the count stays at 1.
- After renaming the villa copy to "QA villa copy", reopening the sample still returns it.

**Card menu, Rename and Delete**
- The card menu works by keyboard: Enter opens it, the arrow keys move, and Escape closes it and returns focus to its trigger.
- Rename preselects the name, Enter saves and the server updates, and Escape cancels with nothing saved.
- Delete asks for confirmation ("…will be gone for everyone. This can't be undone."), with focus on Cancel by default. Escape and Cancel both keep the home.

**Client link:** `/s/<invalid>` shows "This link isn't working".

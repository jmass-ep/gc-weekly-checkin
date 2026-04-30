# Loading Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark navy loading overlay with a frosted-glass white background and enlarge the video to hero size.

**Architecture:** All changes are confined to the `LoadingScreen` function component in `app/page.tsx` (lines 161–308). No new files, no new dependencies. The backdrop blur uses the native CSS `backdrop-filter` property which is supported in all modern browsers.

**Tech Stack:** React (inline styles), CSS `backdrop-filter`

---

### Task 1: Remove the SVG grain filter and its overlay div

**Files:**
- Modify: `app/page.tsx:197-222`

The grain filter was designed for the dark overlay — it's invisible on a light background and adds unnecessary DOM noise.

- [ ] **Step 1: Delete the SVG grain filter element**

In `app/page.tsx`, remove lines 197–211 (the entire `<svg>` block):

```diff
-      {/* SVG grain filter */}
-      <svg width="0" height="0" style={{ position: 'absolute' }}>
-        <defs>
-          <filter id="grain">
-            <feTurbulence
-              type="fractalNoise"
-              baseFrequency="0.65"
-              numOctaves="3"
-              stitchTiles="stitch"
-            />
-            <feColorMatrix type="saturate" values="0" />
-            <feBlend in="SourceGraphic" mode="multiply" />
-          </filter>
-        </defs>
-      </svg>
```

- [ ] **Step 2: Delete the grain overlay div**

Remove lines 213–222 (the grain overlay `<div>`):

```diff
-      {/* Grain overlay */}
-      <div
-        style={{
-          position: 'absolute',
-          inset: 0,
-          filter: 'url(#grain)',
-          opacity: 0.08,
-          pointerEvents: 'none',
-        }}
-      />
```

- [ ] **Step 3: Verify the file still compiles**

```bash
cd "$(git rev-parse --show-toplevel)" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "remove grain filter from loading screen"
```

---

### Task 2: Apply frosted-glass white background

**Files:**
- Modify: `app/page.tsx` — the root `<div>` style of `LoadingScreen`

- [ ] **Step 1: Update the root overlay div style**

Find the root `<div>` of `LoadingScreen` (the one with `position: 'fixed'`). Replace its `backgroundColor` and add `backdropFilter`:

```diff
       style={{
         position: 'fixed',
         inset: 0,
         zIndex: 50,
         display: 'flex',
         flexDirection: 'column',
         alignItems: 'center',
         justifyContent: 'center',
-        backgroundColor: 'rgba(13,33,55,0.90)',
+        backgroundColor: 'rgba(255,255,255,0.82)',
+        backdropFilter: 'blur(16px)',
+        WebkitBackdropFilter: 'blur(16px)',
         opacity: visible ? 1 : 0,
         transition: 'opacity 800ms ease',
         pointerEvents: visible ? 'auto' : 'none',
       }}
```

- [ ] **Step 2: Verify the file still compiles**

```bash
cd "$(git rev-parse --show-toplevel)" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "loading screen: frosted glass white background"
```

---

### Task 3: Update text and UI colours to dark

**Files:**
- Modify: `app/page.tsx` — title, loading label, EP wordmark, progress bar track

All white/light colours need to flip to dark so they remain readable on the light background.

- [ ] **Step 1: Update the title colour**

Find the `{/* Title */}` paragraph. Change `color`:

```diff
       <p
         style={{
           fontFamily: 'var(--font-bebas)',
           fontSize: 'clamp(2rem, 6vw, 4rem)',
-          color: '#ffffff',
+          color: '#0D2137',
           letterSpacing: '0.05em',
           marginBottom: '2rem',
           textAlign: 'center',
           lineHeight: 1,
         }}
       >
```

- [ ] **Step 2: Update the progress bar track colour**

Find the `{/* Progress bar */}` outer div. Change `backgroundColor`:

```diff
       <div
         style={{
           marginTop: '2rem',
           width: 'clamp(180px, 30vw, 340px)',
           height: '3px',
-          backgroundColor: 'rgba(255,255,255,0.15)',
+          backgroundColor: 'rgba(0,0,0,0.10)',
           borderRadius: '2px',
           overflow: 'hidden',
         }}
       >
```

- [ ] **Step 3: Update the loading label**

Find the `{/* Label */}` paragraph. Replace `color` and remove `opacity`:

```diff
       <p
         style={{
           marginTop: '0.75rem',
-          color: '#ffffff',
+          color: '#64748B',
           fontSize: '0.7rem',
           letterSpacing: '0.18em',
           textTransform: 'uppercase',
-          opacity: 0.7,
         }}
       >
```

- [ ] **Step 4: Update the EP wordmark**

Find the `{/* EP wordmark */}` paragraph. Replace `color` and remove `opacity`:

```diff
       <p
         style={{
           position: 'absolute',
           bottom: '1.5rem',
           left: '50%',
           transform: 'translateX(-50%)',
-          color: '#ffffff',
+          color: 'rgba(13,33,55,0.35)',
           fontSize: '0.6rem',
           letterSpacing: '0.25em',
           textTransform: 'lowercase',
-          opacity: 0.4,
           whiteSpace: 'nowrap',
         }}
       >
```

- [ ] **Step 5: Verify the file still compiles**

```bash
cd "$(git rev-parse --show-toplevel)" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "loading screen: flip text and UI colours to dark"
```

---

### Task 4: Increase video to hero size

**Files:**
- Modify: `app/page.tsx` — video element and progress bar width

- [ ] **Step 1: Update the video width**

Find the `<video>` element. Change `width`:

```diff
       <video
         src="/justin-phone.mp4"
         autoPlay
         muted
         loop
         playsInline
         style={{
-          width: 'clamp(180px, 30vw, 340px)',
+          width: 'clamp(340px, 60vw, 660px)',
           borderRadius: '12px',
           display: 'block',
         }}
       />
```

- [ ] **Step 2: Match the progress bar width to the video**

Find the `{/* Progress bar */}` outer div. Change `width` to match:

```diff
       <div
         style={{
           marginTop: '2rem',
-          width: 'clamp(180px, 30vw, 340px)',
+          width: 'clamp(340px, 60vw, 660px)',
           height: '3px',
           backgroundColor: 'rgba(0,0,0,0.10)',
           borderRadius: '2px',
           overflow: 'hidden',
         }}
       >
```

- [ ] **Step 3: Verify the file still compiles**

```bash
cd "$(git rev-parse --show-toplevel)" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "loading screen: hero-size video"
```

---

### Task 5: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
cd "$(git rev-parse --show-toplevel)" && npm run dev
```

Open http://localhost:3000 in a browser.

- [ ] **Step 2: Verify the loading screen**

On page load the loading screen should appear briefly. Check:
- Background is white/frosted (not dark navy)
- Dashboard content is visible but blurred behind the overlay
- Video is large (roughly 60% of the viewport width on a desktop screen)
- Title, loading label, and "elite prospects" wordmark are all dark/readable
- Red progress bar is visible against the light background
- No grain texture visible
- Overlay fades out smoothly once data loads

- [ ] **Step 3: Check on a narrow viewport**

Resize the browser to mobile width (~375px). Confirm:
- Video fills the width sensibly (the `clamp` floor of 340px means it will be close to full-width on small screens — this is intentional)
- No horizontal overflow or clipping

- [ ] **Step 4: Final commit if any last tweaks were made**

```bash
git add app/page.tsx
git commit -m "loading screen redesign: visual polish"
```

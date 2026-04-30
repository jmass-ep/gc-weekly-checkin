# Loading Screen Redesign

**Date:** 2026-04-30  
**Status:** Approved

## Goal

Replace the dark navy loading overlay with a frosted-glass white overlay and make the video significantly larger (hero size).

## Current State

The `LoadingScreen` component in `app/page.tsx` renders a fixed full-screen overlay with:
- Background: `rgba(13,33,55,0.90)` (dark navy)
- White text/UI elements
- SVG grain filter overlay
- Video: `clamp(180px, 30vw, 340px)` wide

## Design

### Background

Replace the dark overlay with a frosted-glass white panel:

```
backgroundColor: 'rgba(255,255,255,0.82)'
backdropFilter: 'blur(16px)'
WebkitBackdropFilter: 'blur(16px)'
```

This blurs the dashboard content visible beneath, giving a clean iOS-style frosted glass effect.

### Video Size

Increase from the current small/medium size to hero size:

```
width: 'clamp(340px, 60vw, 660px)'
```

The progress bar width matches the video width (same `clamp` value).

### Text & UI Colours

All elements flip from white/light to dark to remain readable on the light background:

| Element | Before | After |
|---|---|---|
| Title | `#ffffff` | `#0D2137` |
| Loading label | `rgba(255,255,255,0.7)` | `#64748B` |
| Progress bar track | `rgba(255,255,255,0.15)` | `rgba(0,0,0,0.10)` |
| EP wordmark | `rgba(255,255,255,0.4)` | `rgba(13,33,55,0.35)` |

### Grain Filter

Remove the SVG `<filter id="grain">` and its overlay `<div>`. The grain was designed for the dark overlay; it's invisible on a light background and adds unnecessary DOM noise.

## Scope

Single component: the `LoadingScreen` function in `app/page.tsx` (lines 161–308). No other files change.

## Out of Scope

- Loading duration / progress bar timing
- Fade-in/out transition timing
- Any changes to the dashboard content beneath

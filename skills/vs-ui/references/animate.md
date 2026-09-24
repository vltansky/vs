> **Additional context needed**: how often users hit each surface, performance constraints.

Motion is judged by what the user never notices. When an interaction behaves exactly as assumed, the user moves on without a second thought; that is the goal. Every animation below must survive four questions, in order, before any code is written.

Adapted from Emil Kowalski's MIT-licensed `emil-design-eng` skill (https://github.com/emilkowalski/skills); see [../LICENSE.emil-design-eng](../LICENSE.emil-design-eng).

---

## Register

Brand: motion is part of the voice; one well-rehearsed entrance beats scattered micro-interactions. The saturated AI default is fade-and-rise reveals on every scrolled section; that's a tell, not a choreography. Rare, first-time surfaces may carry delight.

Product: crisp and fast. Motion conveys state: feedback, reveal, transitions between views. No page-load choreography; users are in a task and won't wait for it.

---

## The Decision Framework

### 1. Should this animate at all? (frequency gate)

| How often the user sees it | Decision |
|---|---|
| 100+ times/day (keyboard shortcuts, command palette, tab switching via keys) | No animation. Ever. |
| Tens of times/day (hover, list navigation, toggles) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts, menus) | Standard animation |
| Rare / first-time (onboarding, celebrations, empty states) | Can add delight |

**Never animate keyboard-initiated actions.** Opening a command palette with Cmd+K appears instantly; Raycast has no open/close animation and that is the optimal experience for something used hundreds of times a day.

### 2. What is the purpose?

Valid answers: spatial consistency (toast exits the way it entered), state indication, explanation, feedback (press acknowledged), preventing jarring appearance/disappearance. "It looks cool" on a frequently seen element is not an answer; cut it.

### 3. Which easing?

- Entering or exiting → ease-out
- Moving / morphing on screen → ease-in-out
- Hover / color change → ease
- Constant motion (progress, marquee) → linear
- Default → ease-out

Built-in CSS curves are too weak. Use strong custom curves:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* UI enters, exits, presses */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS-like sheets and drawers */
```

**Never use ease-in for UI.** It delays the first frames, which is exactly when the user is watching; a 300ms ease-in dropdown feels slower than a 300ms ease-out one.

### 4. How fast?

| Element | Duration |
|---|---|
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects, menus | 150–250ms |
| Modals, drawers | 200–500ms |
| Marketing / explanatory | Can be longer |

UI animations stay under 300ms. Exit is faster than enter. Speed is perception: a 180ms select feels more responsive than a 400ms one even when nothing else changed.

---

## Component Rules

- **Pressable elements respond.** `transform: scale(0.97)` on `:active` with `transition: transform 160ms var(--ease-out)`. Range 0.95–0.98. Applies to buttons, menu items that act, cards that navigate.
- **Never enter from `scale(0)`.** Start at `scale(0.95)` + `opacity: 0`. Nothing real appears from nothing.
- **Popovers are origin-aware.** Dropdowns, menus, tooltips scale from their trigger: set `transform-origin` to the trigger side (or `var(--transform-origin)` / `var(--radix-popover-content-transform-origin)` in Base UI / Radix). **Modals are exempt**: they stay centered.
- **Tooltips: delay the first, skip the rest.** Initial open waits (~400-600ms) to prevent accidental triggers. Once one is open, adjacent tooltips open instantly with `transition-duration: 0ms`.
- **Transitions over keyframes for interactive UI.** Transitions retarget mid-flight; keyframes restart from zero. Anything that can be triggered rapidly (toasts, toggles, hover, open/close) uses transitions. Keyframes are for one-shot sequences.
- **Enter with `@starting-style`** instead of a `mounted` state flag when support allows:
  ```css
  .toast {
    transition: opacity 250ms var(--ease-out), transform 250ms var(--ease-out);
    @starting-style { opacity: 0; transform: translateY(100%); }
  }
  ```
- **Percent translates.** `translateY(100%)` moves an element by its own height; prefer it over hardcoded pixels for toasts and drawers.
- **Asymmetric timing.** Slow where the user is deciding (hold-to-confirm: 1-2s linear), fast where the system responds (release snaps back in 200ms ease-out).
- **Blur masks rough crossfades.** If two states overlapping look like two objects, add `filter: blur(2px)` during the swap. Keep blur under 20px (Safari cost).
- **Stagger lists, not sections.** 30–80ms between items, cap the total; never block interaction while a stagger plays.
- **Hover only where hover exists.** Wrap hover motion in `@media (hover: hover) and (pointer: fine)`; touch devices fire hover on tap.

## Springs

Use springs for drag, gestures that can be interrupted, and "alive" elements; they keep velocity when interrupted where CSS restarts. Prefer the duration/bounce form: `{ type: "spring", duration: 0.5, bounce: 0.2 }`. Bounce 0.1–0.3 only for drag-to-dismiss and playful surfaces; zero bounce everywhere else. Decorative pointer-tracking goes through a spring (`useSpring`), never raw mouse values; functional data (charts, finance) gets no spring at all.

## Gestures

- Dismiss on velocity, not just distance: `Math.abs(delta) / elapsedMs > 0.11` dismisses even short flicks.
- Past a boundary, apply damping (friction grows with distance) instead of a hard stop.
- `setPointerCapture` once a drag starts; ignore extra touch points mid-drag.

## Performance

- Animate `transform` and `opacity` by default; blur, clip-path and shadow are fine when bounded to small areas and verified smooth. Never casually animate `width`, `height`, `top`, `left`, margins, padding.
- Don't drive per-frame motion through an inherited CSS variable on a parent (restyles every child); set `transform` on the moving element.
- Framer Motion `x`/`y`/`scale` shorthands run on the main thread; under load use `transform: "translateX(...)"` or CSS/WAAPI.
- CSS animations and WAAPI run off the main thread and stay smooth while the page loads; use them for predetermined motion.
- Scroll reveals: IntersectionObserver, unobserve after firing, and content must be visible by default (reveal enhances, never gates).

## clip-path toolkit

`clip-path: inset(...)` is animatable and GPU-cheap: tab color transitions (clip a duplicated active tab list), hold-to-delete overlays (`inset(0 100% 0 0)` → `inset(0)`), scroll image reveals, comparison sliders.

## Accessibility

Reduced motion means fewer and gentler, not zero. Keep opacity/color fades that aid comprehension; remove translate/scale movement.

```css
@media (prefers-reduced-motion: reduce) {
  .popover, .toast, .drawer { transition-property: opacity; transform: none; }
}
```

## Review Format

When reviewing motion code, output a single markdown table, one row per issue:

| Before | After | Why |
|---|---|---|
| `transition: all 300ms` | `transition: transform 200ms var(--ease-out)` | Name exact properties |
| `transform: scale(0)` | `scale(0.95); opacity: 0` | Nothing appears from nothing |
| `ease-in` on dropdown | `var(--ease-out)` | ease-in feels sluggish |
| Cmd+K palette fades in 250ms | No animation | Keyboard action, used 100+/day |

## Checklist

| Issue | Fix |
|---|---|
| `transition: all` | Exact properties |
| `scale(0)` entry | `scale(0.95)` + opacity |
| `ease-in` on UI | Custom ease-out |
| Popover scales from center | Origin at trigger (modals exempt) |
| Keyboard-triggered animation | Remove it |
| UI duration > 300ms | 150–250ms |
| Hover motion without media query | `@media (hover: hover) and (pointer: fine)` |
| Keyframes on rapidly triggered UI | Transitions |
| No `:active` feedback on pressables | `scale(0.97)` |
| Enter and exit same speed | Exit faster |
| Every tooltip waits the full delay | Instant after the first |

## Verify

Play every animation at 2-5x duration (or step frames in DevTools Animations). Check: origin correct, properties in sync, no double-image in crossfades, exit faster than enter, keyboard paths instant, reduced motion still readable.

When the motion clarifies state instead of decorating it, hand off to `/vs-ui polish` for the final pass.

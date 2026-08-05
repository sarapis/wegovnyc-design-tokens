# @wegovnyc/design-tokens

> One design system for **wegov.nyc** and **unnyc.wegov.nyc**, as two brand
> variants over a shared core. CSS custom properties only — no build step, no
> framework, no runtime.

## Install and use

```css
/* the shared language + exactly one brand variant */
@import '@wegovnyc/design-tokens/core.css';
@import '@wegovnyc/design-tokens/unnyc.css';   /* or /wegov.css */
```

Then mark the subtree the variant governs:

```jsx
<div className="unnyc-page wg-unnyc" data-brand="unnyc">
```

`index.css` loads the core plus both variants if you need them side by side
(each is class-scoped, so nothing applies until you opt in).

## The two tiers, and why the distinction matters

| Tier | Prefix | Role |
|---|---|---|
| Reference | `--db-*` + civic additions | Raw values. A palette, not a decision. **Never consume these.** |
| Semantic | `--wg-*` | Roles — "the brand colour", "the page surface", "the muted text". **Consume only these.** |

A brand variant is nothing more than a remap of the semantic tier onto
different reference values. That is the whole mechanism.

If a component reads `--db-primary` directly, the variant system cannot reach
it and that component is permanently the same in every brand. That is the bug
this package exists to prevent.

## Why both variants are nearly empty

Audited 2026-08-05: **wegov.nyc and UNNYC already resolved to identical token
values** — same canonical navy `#162e51`, same UN-blue and gold, same warm
neutrals (`#F8F6F0` / `#F4F1EB`), same shadow ramp on `#1b2a4a`, same
`6/10/16/24` radii, same ease curve. They were two prefixes (`--wegov-*` and
`--unnyc-*`) over one design language, not two designs.

So the shared language lives in `core.css`, and each variant file is the **seam**
where that brand's divergence goes when it is actually wanted. Copying core's
values into a variant "for completeness" would rebuild exactly the duplication
this package deletes. Don't.

The divergence knobs are listed in each variant file.

## Known warts (deliberate, not oversights)

These were all left alone so the adoption refactor could be proven
value-identical. Each is a real cleanup, and each is a **visible** change, so
each deserves its own decision.

1. **`--db-*` is a historical prefix.** The reference values were harvested from
   Databook's token file, which is why they carry its prefix — but Databook is
   **not** part of this system and does not consume this package. Renaming the
   tier touches every consumer.
2. **`--wg-font-serif` includes `'Times New Roman'`; the products' display stack
   does not** (`DM Serif Display → Georgia → serif`). Nothing consumes
   `--wg-font-serif`, so it is left as-is rather than silently altering a value
   mid-refactor. `--wg-font-display` carries the correct stack.
3. **The shadow ramp is built on `#1b2a4a`, the *pre-convergence* navy**, not on
   `--db-navy-900` (`#0b1f3a`). Both products ship exactly these shadows, so
   they are the system's real ramp. Moving them onto the canonical navy changes
   how every card looks.
4. **Five type steps and two space steps are literal** (`1.125 / 2 / 2.75 / 3.5
   / 4.5rem`; `20px` / `96px`) because the reference ramp has no equivalent.
   Snapping them to the nearest reference step is a type change, not a refactor.

## Verifying a change is value-identical

The adoption refactor was proven pixel-preserving by capturing, before and
after, every consumed token's resolved value plus 16 representative elements ×
17 computed properties, and diffing. It found zero differences.

**Await `document.fonts.ready` before capturing.** An element with
`line-height: normal` computes to a font-metrics-dependent pixel value, so a
capture taken mid-font-load differs from one taken after by a fraction of a
pixel — which reads as a regression and is not one. This cost real debugging
time; don't repeat it.

## Consumers

| Product | Variant | Status |
|---|---|---|
| `unnyc.wegov.nyc` — [sarapis/unnyc](https://github.com/sarapis/unnyc) | `unnyc` | Adopted; `--unnyc-*` aliases the semantic tier |
| `wegov.nyc` — [wegovnyc/wegovnyc_front](https://github.com/wegovnyc/wegovnyc_front) | `wegov` | Pending; `--wegov-*` still aliases the reference tier directly |

Both currently **vendor** these files rather than installing the package, since
it is not published yet. The vendored copies are marked; treat this repo as
canonical and re-copy rather than hand-editing them, or the fork comes back.

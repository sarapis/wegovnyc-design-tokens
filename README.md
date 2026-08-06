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

## State colours

Four states — `danger`, `success`, `warning`, `info` — each with four roles:

| Token | Use |
|---|---|
| `--wg-<state>` | The colour itself: borders, icons, rules |
| `--wg-<state>-surface` | Soft tinted background for a message block |
| `--wg-<state>-text` | Darkened, for body copy **on that surface** |
| `--wg-<state>-on-brand` | Lightened, for use **on the dark brand surface** |

**`-on-brand` is not a nicety.** On `--wg-brand` (`#162e51`), `--db-danger`
measures **1.95:1** — a clear WCAG failure — while `--wg-danger-on-brand` is
**6.20:1**. An error message on the navy campaign form styled with the plain
danger colour is unreadable. Use `-on-brand` whenever the backdrop is
`--wg-brand` or `--wg-brand-deep`.

⚠ **`--wg-warning` is 3.16:1 on white — large text or non-text only.** For
warning body copy on a light surface use `--wg-warning-text`.

Every other pairing passes AA body text; the measured figures are in
`core.css` beside the tokens.

**Provenance.** `--wg-danger-on-brand` is `#FF8F8F`, already shipping and
eyeballed in the UNNYC campaign forms. The other three `-on-brand` values are
**computed** — the same lightness and saturation as that one, applied to each
state's own hue, a rule which reproduces `#FF8F8F` exactly for danger. They are
accessible by measurement but have not been seen in product. Eyeball before
first use, and preserve the rule rather than the individual value.

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

## The lint: `wg-lint-tokens`

The package ships a **warn-only** guard for the one rule that matters:

```bash
npx wg-lint-tokens                    # scan ./src
npx wg-lint-tokens --update-baseline  # record known findings
npx wg-lint-tokens --strict           # exit 1 (opt in; not the default)
```

Both consumers run it as `prebuild`, so it prints on every local and Vercel build
and can never fail a deploy. It flags exactly two things, both of which make a
value **unreachable by the brand variant**:

1. a colour literal in a declaration
2. a reference-tier read, `var(--db-*)`

**What it deliberately ignores**, so the report stays worth reading: `rgba()`/`hsla()`
with alpha (overlays like "white at 8%" have no semantic equivalent — flagging ~25
forever is how a warning becomes wallpaper), hex inside a `var()` fallback, and
anything annotated `wg-lint-ok` on its own line **or in the comment block directly
above it**.

**It baselines.** `wegov.nyc`'s legacy `globals.css` alone carries 46 distinct
pre-system literals; those are recorded in `.wg-lint-baseline.json` and only NEW
findings are reported. Keys are file+kind+value+property, never line numbers, so an
edit above a finding doesn't resurface it. Config: `.wg-lintrc.json`
(`{ "roots": [...], "ignore": ["printable-doc.css"] }`) — print stylesheets are
legitimately brand-independent.

⚠ **Test it by trying to defeat it.** Two bugs shipped past review and were caught
only by deliberately adding a violation: it skipped every single-line rule
(`.x { color: #abc; }`) because it matched `^prop: value` per line, and `wg-lint-ok`
only matched the declaration's own line, so every multi-line reason was ignored.

## ⚠ Consumers pin to a commit — bump them together

Both sites install this as a **git dependency**, which resolves to a *commit*, not
a moving version. Adding a token here does **not** make it available to a consumer
until that consumer reinstalls:

```bash
npm install --save github:sarapis/wegovnyc-design-tokens
```

**This has already bitten once.** During the UNNYC migration (2026-08-05) that app
still had v0.1.0 installed while the package was at v0.3.0. Sixteen rules were
rewritten to `var(--wg-text-inverse)` — a token that did not exist in the installed
copy — and every one of them **silently fell back to the inherited colour**. The
build passed. Nothing warned. It was caught only because a before/after computed-style
diff flagged 11 elements.

That is the failure mode to design against: **an undefined custom property fails
silently**, not loudly. `var(--nope)` is not an error; it just makes the declaration
invalid at computed-value time and the property inherits.

So:

- After adding a token here, reinstall in **every** consumer before using it, and
  check `node_modules/@wegovnyc/design-tokens/package.json` actually shows the new
  version.
- A defensive fallback — `var(--wg-brand-raised, #1f3a63)` — would have masked this
  rather than surfaced it. That is the trade-off: fallbacks make a stale install
  invisible instead of merely silent. Prefer no fallback plus a diff you trust.
- Verify with computed styles, never by reading the token's own text.

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

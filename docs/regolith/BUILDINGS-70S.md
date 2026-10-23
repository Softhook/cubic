# Regolith buildings: 70s flat style

Goal: move the surface-hex buildings away from a shiny, airbrushed 90s look towards 70s flatness — hard tonal bands, flat paint, bold outlines, supergraphic stripes.

## Where the gloss comes from

1. **Specular lighting** — `feSpecularLighting` in the `rg-built` filter (`packages/art/src/regolith/light.ts`, `built()`).
2. **Smooth diffuse shading** — the height map is lit as a continuous slope, giving airbrushed domes; the 6-step colour ramp at the end of `built()` keeps it smooth.
3. **Gradients** — radial/linear fills in `BUILDING_GRADIENTS` (`parts.ts`: `rg-vault`, `rg-sphere`, …).
4. **Painted glints and glows** — white highlight ellipses in `buildings.ts` (dome, tank) and soft, screen-blended `glow()` halos (plants, windows, flames, reactor).

## Changes

1. **`light.ts` `built()`**
   - Drop the specular pass (or set its `k3` to 0).
   - Posterize the diffuse light into 3 hard bands (lit / mid / shade) with `feComponentTransfer type="discrete"`.
   - Turn the grime noise way down — clean flat paint.
   - Set the cast-shadow blur to 0.
2. **Palette** — replace the warm-steel ramp with a 70s set: cream, ochre, burnt orange, brown, avocado; one accent colour per building type.
3. **`parts.ts` gradients** — flat fills, or 2–3 hard-stop bands for a striped look.
4. **`buildings.ts`**
   - Delete the highlight ellipses.
   - `glow()` → flat discs, no blur, no screen blend. Flames become stacked flat shapes (orange / yellow / cream).
   - Add a thin dark outline to each building footprint.
   - Add a supergraphic stripe band (2–3 parallel coloured stripes) around domes and tanks.
5. **Height map** (optional) — stepped/terraced domes instead of smooth hemispheres, so light falls in facets.

## Order

Do steps 1 and 4 first — removing the specular, posterizing and deleting the glints gives most of the change. Palette and stripes follow.

## Checking

- Run `packages/art/test/regolith.test.ts` and update the golden snapshot.
- Review in `docs/moodboards/regolith/HexSurface.dc.html`, then sync the change to the claude.ai design canvas.

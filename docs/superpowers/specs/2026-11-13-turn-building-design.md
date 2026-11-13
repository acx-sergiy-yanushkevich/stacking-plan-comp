# Turn the building

Date: 2026-11-13. Status: approved in conversation (after the motion design).

## Intent

Two buttons on the Building view turn the building model a quarter at a time. It is for the eye: a building
turning on the main screen is the most appealing shot of the demo video and the Best UI vote, and it shows the
real footprint from its other sides, which helps to match it with the map. Every suite already shows on the
front wall at the usual angle, so it adds no data and is not presented as if it did.

## Goals

- "Turn the building left" and "Turn the building right", icon buttons on the model's caption line while the
  model stands alone (no floor open).
- Quarter turns from the usual corner view (−34°): 56°, 146°, 236°. Every stop shows two walls; a face-on view
  (0°, 90°) would show one flat wall.
- The turn eases with the model's existing tween (760 ms), the short way round; under reduced motion it is at
  once.
- The turn is in the address (`turn=1`–`3`), like every view setting, so it can be linked and photographed.

## Non-goals

- Drag to spin: the floors are click targets, and a drag would compete with a click.
- Turning a docked model: with a floor open the model faces front to match the plate, as it does today; closing
  the floor brings back the chosen turn.

## Anti-goals

- A turn that overlaps the list of floors or leaves its leaders pointing at the old corners.
- A turn from the last quarter that spins three quarters back.

## Approaches

1. Buttons driving the existing `angle` tween, with the turn in the address (chosen): the geometry, the shading
   and the tween already handle any angle.
2. Drag to rotate: more direct, but it competes with picking a floor and has no keyboard path.
3. A free angle slider: precise but fussy, and most angles show one flat wall.

## The design

- `PlanState.turn` (0–3), parsed and serialized like `ring`.
- `turnAngle(turn)` = −34° + 90° × turn; `nearestTurn(from, to)` picks the equivalent of `to` closest to
  `from`, so each turn is a quarter.
- While the model turns, the leaders from the labels hide and come back when it settles; they re-measure to the
  new anchors.
- Checked by unit tests (`turn.ts`, `planState`), `BuildingView` render tests, and a `verify.mjs` step.

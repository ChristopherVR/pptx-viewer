/**
 * connector-hit-target.ts: how wide a connector's pointer target has to be.
 *
 * WHY this exists at all: a connector's wrapper is `pointer-events: none`, so
 * an empty bounding box (connectors are usually large and mostly empty) never
 * swallows clicks meant for the shapes it spans. That also left the LINE
 * unclickable, so no pointer route reached a connector and the inspector's
 * connector card could only be opened from the Elements list. Every binding
 * therefore paints a transparent stroke along the path that opts back INTO hit
 * testing with `pointer-events: stroke`, keeping the target on the line and off
 * the box.
 *
 * WHY its own module: `buildConnectorGeometry` hands the width to the three
 * bindings that consume the geometry object, but Vanilla renders a connector
 * without ever building one, so it needs the rule and nothing else. Four
 * bindings agreeing on a magic number by copying it is how they drifted the
 * first time.
 *
 * @module render/connector-hit-target
 */

/**
 * Narrowest a connector's pointer target may be, in px.
 *
 * WHY a floor: a hairline connector is one or two px of ink, and a target that
 * thin cannot be hit with a mouse, never mind a finger. PowerPoint shows the
 * same generosity around a line.
 */
export const CONNECTOR_HIT_MIN_WIDTH = 14;

/**
 * Width of the transparent stroke that makes a connector clickable.
 *
 * WHY 3x: the target has to be comfortably wider than the ink so a near miss
 * still lands, while staying proportional for a thick line.
 */
export function connectorHitStrokeWidth(strokeWidth: number): number {
	return Math.max(strokeWidth * 3, CONNECTOR_HIT_MIN_WIDTH);
}

/**
 * Pure derivation of the on-canvas focus target a running tool refers to, so
 * the viewer can behave like a live collaborator: as the assistant reads or
 * edits the deck, the canvas navigates to the relevant slide and highlights the
 * element(s) the tool is touching.
 *
 * The mapping is intentionally structural (it reads well-known input fields:
 * `slideIndex`, `elementId`, `elementIdA/B`, `elementIds`, `slideIndexes`,
 * `newOrder`) and framework-agnostic, so every binding drives the same live
 * focus. It NEVER performs navigation itself; it only says "what to look at".
 */

/** The slide / element(s) a tool invocation is focused on. */
export interface ToolCanvasTarget {
	/** Zero-based slide index to navigate to, when the tool names one. */
	slideIndex?: number;
	/** Element ids on that slide to highlight (may be empty for slide-level tools). */
	elementIds: string[];
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function pushId(ids: string[], value: unknown): void {
	if (typeof value === 'string' && value.length > 0) {
		ids.push(value);
	}
}

/**
 * Derive the canvas focus target for a tool call from its name + input.
 * Returns `null` when the tool has no single slide/element to point at (e.g.
 * `get_deck_overview`, `get_theme`, `find_text`, `replace_all`, theme edits),
 * so the caller can skip navigation and leave the canvas where it is.
 */
export function toolCanvasTarget(toolName: string, input: unknown): ToolCanvasTarget | null {
	const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

	const elementIds: string[] = [];
	pushId(elementIds, o.elementId);
	pushId(elementIds, o.elementIdA);
	pushId(elementIds, o.elementIdB);
	if (Array.isArray(o.elementIds)) {
		for (const value of o.elementIds) {
			pushId(elementIds, value);
		}
	}

	let slideIndex: number | undefined = isFiniteNumber(o.slideIndex) ? o.slideIndex : undefined;
	if (
		slideIndex === undefined &&
		Array.isArray(o.slideIndexes) &&
		isFiniteNumber(o.slideIndexes[0])
	) {
		slideIndex = o.slideIndexes[0];
	}
	if (slideIndex === undefined && Array.isArray(o.newOrder) && isFiniteNumber(o.newOrder[0])) {
		slideIndex = o.newOrder[0];
	}
	// `duplicate_slide` navigates to the source slide it is copying.
	if (slideIndex === undefined && toolName === 'duplicate_slide' && isFiniteNumber(o.slideIndex)) {
		slideIndex = o.slideIndex;
	}

	if (slideIndex === undefined && elementIds.length === 0) {
		return null;
	}
	return { slideIndex, elementIds };
}

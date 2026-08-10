/**
 * Ordinal bookkeeping for `a:buAutoNum` paragraphs inside one text body.
 *
 * A numbered paragraph does not know its own ordinal: `a:buAutoNum/@startAt`
 * gives the value the *list* starts at, and the ordinal is that start plus the
 * count of preceding paragraphs belonging to the same list. "The same list"
 * means an unbroken run at the same indent level using the same numbering
 * scheme, so a heading, a plain sentence, or a switch from arabic to roman all
 * begin a new list at `startAt` again. Deeper paragraphs nest inside the run
 * rather than interrupting it, and each ancestor item restarts the levels
 * beneath it.
 *
 * The state is threaded through the text body's paragraph walk instead of being
 * recomputed per paragraph: numbering is inherently sequential, so one ordered
 * pass costs a single step per paragraph.
 *
 * @module auto-number-sequence
 */

/** Per-level record of the last ordinal emitted and the scheme that emitted it. */
interface LevelSequence {
	scheme: string;
	ordinal: number;
}

/** Mutable numbering state for a single text body. */
export interface AutoNumberSequence {
	readonly levels: Map<number, LevelSequence>;
}

/** Create empty numbering state for one text body. */
export function createAutoNumberSequence(): AutoNumberSequence {
	return { levels: new Map<number, LevelSequence>() };
}

/** Drop the recorded ordinals for `level` and every level nested inside it. */
function forgetFromLevel(sequence: AutoNumberSequence, level: number): void {
	for (const recorded of sequence.levels.keys()) {
		if (recorded >= level) {
			sequence.levels.delete(recorded);
		}
	}
}

/**
 * Record a paragraph that carries no automatic number and therefore ends any
 * list running at its own level.
 *
 * @param sequence - The text body's numbering state.
 * @param level - Zero-based indent level of the paragraph.
 */
export function breakAutoNumberRun(sequence: AutoNumberSequence, level: number): void {
	forgetFromLevel(sequence, level);
}

/**
 * Advance the numbering state for an auto-numbered paragraph and return the
 * ordinal to render.
 *
 * @param sequence - The text body's numbering state.
 * @param level - Zero-based indent level of the paragraph.
 * @param scheme - The paragraph's `a:buAutoNum/@type`.
 * @param startAt - The paragraph's `a:buAutoNum/@startAt`, defaulting to 1.
 * @returns The ordinal for this paragraph.
 */
export function nextAutoNumber(
	sequence: AutoNumberSequence,
	level: number,
	scheme: string,
	startAt: number,
): number {
	const running = sequence.levels.get(level);
	const ordinal = running && running.scheme === scheme ? running.ordinal + 1 : startAt;
	forgetFromLevel(sequence, level + 1);
	sequence.levels.set(level, { scheme, ordinal });
	return ordinal;
}

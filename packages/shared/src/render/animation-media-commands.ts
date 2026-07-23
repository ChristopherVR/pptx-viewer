/**
 * `animation-media-commands` - pure helpers for OOXML `p:cmd` media playback
 * commands in the timing tree. A `p:cmd` node (parsed onto
 * {@link PptxNativeAnimation.commandString}) tells the player to drive a media
 * element (play / pause / seek) at a point in the slide timeline. These helpers
 * recognise the command, build the {@link TimelineStepCommand} carried on a
 * timeline step, and parse the command string into a browser-actionable verb.
 *
 * Framework-agnostic: the actual DOM `HTMLMediaElement` control lives in each
 * binding, which maps the parsed verb onto `play()` / `pause()` / `currentTime`.
 *
 * @module render/animation-media-commands
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import type { TimelineStepCommand } from './animation-timeline-types';

/**
 * Browser-actionable media command verbs we map from an OOXML `p:cmd` string.
 *
 * Deferred / unmapped forms (e.g. arbitrary `evt`/`verb` command strings with no
 * media meaning) resolve to `undefined` from {@link parseMediaCommand} and the
 * playback layer no-ops them.
 */
export type MediaCommandVerb = 'playFrom' | 'play' | 'pause' | 'stop' | 'togglePlay';

/** Result of parsing a `p:cmd` command string into a media verb. */
export interface ParsedMediaCommand {
	/** The recognised verb. */
	verb: MediaCommandVerb;
	/**
	 * For `playFrom`, the seek target in seconds (OOXML encodes the argument in
	 * seconds, e.g. `playFrom(2.5)`). Defaults to `0` when absent or unparseable.
	 */
	seekSeconds?: number;
}

/**
 * True when a parsed native animation carries a non-empty `p:cmd` command
 * string. Such nodes have no preset effect and would otherwise be dropped by the
 * timeline builder; instead they become command steps.
 */
export function isMediaCommandAnimation(anim: PptxNativeAnimation): boolean {
	return typeof anim.commandString === 'string' && anim.commandString.trim().length > 0;
}

/**
 * Build the {@link TimelineStepCommand} for a command animation, or `undefined`
 * when the animation carries no command string.
 */
export function buildStepCommand(anim: PptxNativeAnimation): TimelineStepCommand | undefined {
	if (!isMediaCommandAnimation(anim)) {
		return undefined;
	}
	const command = (anim.commandString ?? '').trim();
	return {
		type: anim.commandType,
		command,
		targetId: anim.targetId ?? '',
	};
}

/**
 * Parse an OOXML `p:cmd/@cmd` string into a browser-actionable media verb.
 *
 * Recognised forms (case-insensitive):
 * - `playFrom(<seconds>)` -> seek to `<seconds>` then play.
 * - `play` / `resume` -> resume playback.
 * - `pause` -> pause playback.
 * - `stop` / `stopMedia` -> pause and rewind to the start.
 * - `togglePlay` -> pause if playing, else play.
 *
 * Any other command string (including non-media `evt` / `verb` commands, or a
 * numeric verb code with no browser analogue) returns `undefined` so the caller
 * can no-op it.
 */
export function parseMediaCommand(commandString: string): ParsedMediaCommand | undefined {
	const raw = commandString.trim();
	if (!raw) {
		return undefined;
	}

	const playFromMatch = raw.match(/^playfrom\s*\(\s*(-?\d*\.?\d+)?\s*\)$/i);
	if (playFromMatch) {
		const seconds = playFromMatch[1] !== undefined ? Number.parseFloat(playFromMatch[1]) : 0;
		return { verb: 'playFrom', seekSeconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0 };
	}

	const lower = raw.toLowerCase();
	if (lower === 'play' || lower === 'resume') {
		return { verb: 'play' };
	}
	if (lower === 'pause') {
		return { verb: 'pause' };
	}
	if (lower === 'stop' || lower === 'stopmedia') {
		return { verb: 'stop' };
	}
	if (lower === 'toggleplay') {
		return { verb: 'togglePlay' };
	}

	return undefined;
}

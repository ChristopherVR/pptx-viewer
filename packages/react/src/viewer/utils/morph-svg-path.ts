/**
 * SVG path parsing, serialization, equalization, and interpolation
 * for shape morphing during morph transitions.
 *
 * @module utils/morph-svg-path
 */
import type { SvgPathCommand } from './morph-types';

// ---------------------------------------------------------------------------
// SVG path parsing and serialization
// ---------------------------------------------------------------------------

/**
 * Parse an SVG path `d` attribute string into a sequence of commands.
 * Supports M, L, C, Q, Z, A, H, V, S and their lowercase variants.
 *
 * @param d - The SVG path `d` attribute string.
 * @returns An array of parsed SVG path commands.
 */
export function parseSvgPath(d: string): SvgPathCommand[] {
	if (!d || typeof d !== 'string') {
		return [];
	}

	const commands: SvgPathCommand[] = [];
	// Split on command letters while keeping the letter
	const tokens = d.match(/[MLCQZAHVSmlcqzahvs][^MLCQZAHVSmlcqzahvs]*/gi);
	if (!tokens) {
		return [];
	}

	for (const token of tokens) {
		const type = token[0];
		const rest = token.slice(1).trim();
		const values: number[] = [];

		if (rest.length > 0) {
			// Extract numbers (including negative and decimal)
			const nums = rest.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
			if (nums) {
				for (const n of nums) {
					const val = Number.parseFloat(n);
					if (Number.isFinite(val)) {
						values.push(val);
					}
				}
			}
		}

		commands.push({ type, values });
	}

	return commands;
}

/**
 * Serialize SVG path commands back to a `d` attribute string.
 *
 * @param commands - The SVG path commands to serialize.
 * @returns A string suitable for the `d` attribute of an SVG `<path>` element.
 */
export function serializeSvgPath(commands: SvgPathCommand[]): string {
	return commands
		.map((cmd) => {
			if (cmd.values.length === 0) {
				return cmd.type;
			}
			return `${cmd.type}${cmd.values.map((v) => Number(v.toFixed(2))).join(' ')}`;
		})
		.join(' ');
}

// ---------------------------------------------------------------------------
// Path equalization helpers (private)
// ---------------------------------------------------------------------------

/** Find the last non-Z command in a path. */
function findLastNonZ(cmds: SvgPathCommand[]): SvgPathCommand {
	for (let i = cmds.length - 1; i >= 0; i--) {
		if (cmds[i].type.toUpperCase() !== 'Z') {
			return cmds[i];
		}
	}
	return cmds[0];
}

/** Check if a path ends with a Z (close-path) command. */
function hasClosingZ(cmds: SvgPathCommand[]): boolean {
	return cmds.length > 0 && cmds[cmds.length - 1].type.toUpperCase() === 'Z';
}

/** Convert an L (line-to) command into a degenerate C (cubic bezier). */
function lineToCubic(cmd: SvgPathCommand): SvgPathCommand {
	const isLower = cmd.type === 'l';
	const [x, y] = cmd.values.length >= 2 ? cmd.values : [0, 0];
	// Degenerate cubic: control points at start (0,0 for relative) and end
	return {
		type: isLower ? 'c' : 'C',
		values: [0, 0, x, y, x, y],
	};
}

// ---------------------------------------------------------------------------
// Path equalization
// ---------------------------------------------------------------------------

/**
 * Equalise two SVG path command arrays so they have the same number of
 * commands and each corresponding pair has the same type and value count.
 *
 * Strategy:
 * - If one path is shorter, duplicate its last non-Z command to pad.
 * - If command types differ at a position, convert simpler commands
 *   (L -> C by creating a degenerate cubic) so both have the same type.
 * - Z commands are kept aligned.
 *
 * Returns null if the paths are too structurally different to interpolate.
 *
 * @param a - The first path command array.
 * @param b - The second path command array.
 * @returns A tuple of equalised path arrays, or null if incompatible.
 */
export function equalizePaths(
	a: SvgPathCommand[],
	b: SvgPathCommand[],
): [SvgPathCommand[], SvgPathCommand[]] | null {
	if (a.length === 0 || b.length === 0) {
		return null;
	}

	const resultA = a.map((c) => ({ type: c.type, values: [...c.values] }));
	const resultB = b.map((c) => ({ type: c.type, values: [...c.values] }));

	// Pad shorter path by duplicating last non-Z command at its final position
	while (resultA.length < resultB.length) {
		const last = findLastNonZ(resultA);
		resultA.splice(resultA.length - (hasClosingZ(resultA) ? 1 : 0), 0, {
			type: last.type,
			values: [...last.values],
		});
	}
	while (resultB.length < resultA.length) {
		const last = findLastNonZ(resultB);
		resultB.splice(resultB.length - (hasClosingZ(resultB) ? 1 : 0), 0, {
			type: last.type,
			values: [...last.values],
		});
	}

	// Align command types and value counts
	for (let i = 0; i < resultA.length; i++) {
		const ca = resultA[i];
		const cb = resultB[i];

		// Both Z — fine
		if (ca.type.toUpperCase() === 'Z' && cb.type.toUpperCase() === 'Z') {
			continue;
		}

		// Promote L to C (degenerate cubic) if the other side is C
		if (ca.type.toUpperCase() === 'L' && cb.type.toUpperCase() === 'C') {
			resultA[i] = lineToCubic(ca);
		} else if (cb.type.toUpperCase() === 'L' && ca.type.toUpperCase() === 'C') {
			resultB[i] = lineToCubic(cb);
		}

		// Ensure value counts match by padding with zeros or trimming
		const maxLen = Math.max(resultA[i].values.length, resultB[i].values.length);
		while (resultA[i].values.length < maxLen) {
			resultA[i].values.push(0);
		}
		while (resultB[i].values.length < maxLen) {
			resultB[i].values.push(0);
		}
	}

	return [resultA, resultB];
}

// ---------------------------------------------------------------------------
// Path interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate between two equalised SVG path command arrays at parameter t.
 * Both arrays must have the same length and matching command types.
 *
 * @param from - The starting path commands.
 * @param to - The ending path commands.
 * @param t - Interpolation parameter, clamped to [0, 1].
 * @returns Interpolated path commands.
 */
export function interpolatePaths(
	from: SvgPathCommand[],
	to: SvgPathCommand[],
	t: number,
): SvgPathCommand[] {
	const clamped = Math.max(0, Math.min(1, t));
	const result: SvgPathCommand[] = [];

	const len = Math.min(from.length, to.length);
	for (let i = 0; i < len; i++) {
		const fa = from[i];
		const fb = to[i];
		const interpolatedValues = fa.values.map((v, j) => {
			const target = j < fb.values.length ? fb.values[j] : v;
			return v + (target - v) * clamped;
		});
		result.push({ type: fb.type, values: interpolatedValues });
	}

	return result;
}

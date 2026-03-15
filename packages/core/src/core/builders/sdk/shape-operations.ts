/**
 * Shape replacement and geometry morphing operations for the headless PPTX SDK.
 *
 * Provides functions to swap the geometry of an existing shape while
 * preserving formatting (fill, stroke, text, effects, position/size),
 * replace geometry with custom SVG paths, and interpolate between
 * two SVG path strings for morph transitions.
 *
 * @module sdk/shape-operations
 */

import type { ShapePptxElement } from "../../types/elements";

// ---------------------------------------------------------------------------
// SVG path command parsing
// ---------------------------------------------------------------------------

/**
 * A parsed SVG path command with its type letter and numeric arguments.
 */
interface PathCommand {
	/** The command letter (M, L, C, Q, A, Z, etc.) — always uppercase. */
	type: string;
	/** Numeric arguments for this command. */
	args: number[];
}

/**
 * Parse an SVG path data string into an array of commands.
 *
 * Supports all common SVG path commands: M, L, H, V, C, S, Q, T, A, Z
 * (both absolute and relative). Commands are normalised to uppercase for
 * consistent processing.
 *
 * @param d - SVG path data string.
 * @returns Array of parsed path commands.
 */
function parsePathData(d: string): PathCommand[] {
	if (!d || d.trim() === "") return [];

	const commands: PathCommand[] = [];
	// Match command letter followed by its numeric arguments
	const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(d)) !== null) {
		const type = match[1].toUpperCase();
		const argsStr = match[2].trim();

		if (type === "Z") {
			commands.push({ type: "Z", args: [] });
			continue;
		}

		if (argsStr === "") {
			commands.push({ type, args: [] });
			continue;
		}

		// Parse numeric arguments (handles negative numbers, decimals, scientific notation)
		const args = argsStr
			.replace(/,/g, " ")
			.replace(/-/g, " -")
			.split(/\s+/)
			.filter((s) => s !== "")
			.map(Number)
			.filter((n) => !isNaN(n));

		commands.push({ type, args });
	}

	return commands;
}

/**
 * Serialise an array of path commands back into an SVG path data string.
 *
 * @param commands - Parsed path commands.
 * @returns SVG path data string.
 */
function serializePathData(commands: PathCommand[]): string {
	return commands
		.map((cmd) => {
			if (cmd.type === "Z") return "Z";
			const argsStr = cmd.args
				.map((n) => (Number.isInteger(n) ? n.toString() : n.toFixed(4)))
				.join(" ");
			return `${cmd.type} ${argsStr}`;
		})
		.join(" ");
}

/**
 * Get the expected number of arguments per command letter.
 */
function getCommandArgCount(type: string): number {
	switch (type) {
		case "M":
		case "L":
		case "T":
			return 2;
		case "H":
		case "V":
			return 1;
		case "C":
			return 6;
		case "S":
		case "Q":
			return 4;
		case "A":
			return 7;
		case "Z":
			return 0;
		default:
			return 0;
	}
}

/**
 * Normalise a path by expanding implicit repeated commands into
 * individual command entries. For example, `M 0 0 10 10` becomes
 * `M 0 0 L 10 10` (implicit lineTo after moveTo).
 */
function normaliseCommands(commands: PathCommand[]): PathCommand[] {
	const result: PathCommand[] = [];

	for (const cmd of commands) {
		const argCount = getCommandArgCount(cmd.type);

		if (argCount === 0 || cmd.args.length <= argCount) {
			result.push({ type: cmd.type, args: [...cmd.args] });
			continue;
		}

		// Split repeated arguments into separate commands
		const implicitType = cmd.type === "M" ? "L" : cmd.type;
		for (let i = 0; i < cmd.args.length; i += argCount) {
			const slice = cmd.args.slice(i, i + argCount);
			if (slice.length === argCount) {
				result.push({ type: i === 0 ? cmd.type : implicitType, args: slice });
			}
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Shape Replacement
// ---------------------------------------------------------------------------

/**
 * Replace the geometry of an existing shape while preserving all formatting.
 *
 * Swaps the `shapeType` and optionally the `shapeAdjustments`, clearing
 * any custom path data (since the shape is now a preset geometry).
 * All other properties — fill, stroke, text, effects, position, size —
 * remain untouched.
 *
 * @param element - The shape element to modify (mutated in place).
 * @param newShapeType - The new preset geometry name (e.g. "ellipse", "roundRect", "star5").
 * @param adjustments - Optional adjustment values for the new geometry.
 * @throws {Error} If `newShapeType` is empty.
 *
 * @example
 * ```ts
 * const shape = createShapeElement("rect", { fill: { type: "solid", color: "#FF0000" } });
 * replaceShapeGeometry(shape, "ellipse");
 * // shape.shapeType === "ellipse", fill/stroke/text unchanged
 * ```
 */
export function replaceShapeGeometry(
	element: ShapePptxElement,
	newShapeType: string,
	adjustments?: Record<string, number>,
): void {
	if (!newShapeType || newShapeType.trim() === "") {
		throw new Error("newShapeType must be a non-empty string");
	}

	// Replace the preset geometry
	element.shapeType = newShapeType;

	// Replace or clear adjustments
	if (adjustments !== undefined) {
		element.shapeAdjustments = { ...adjustments };
	} else {
		element.shapeAdjustments = undefined;
	}

	// Clear custom path data since we're now using a preset geometry
	element.pathData = undefined;
	element.pathWidth = undefined;
	element.pathHeight = undefined;
	element.customGeometryPaths = undefined;

	// Clear adjustment handles — new preset will have its own
	element.adjustmentHandles = undefined;
}

/**
 * Replace a shape's geometry with custom SVG path data.
 *
 * Sets the element's `pathData` to the provided SVG path and clears
 * the `shapeType` (since it is no longer a preset). All other
 * properties — fill, stroke, text, effects, position, size — remain
 * untouched.
 *
 * @param element - The shape element to modify (mutated in place).
 * @param svgPath - The SVG path data string (e.g. "M 0 0 L 100 0 L 100 100 Z").
 * @param pathWidth - Optional coordinate-space width for the custom path.
 * @param pathHeight - Optional coordinate-space height for the custom path.
 * @throws {Error} If `svgPath` is empty.
 *
 * @example
 * ```ts
 * const shape = createShapeElement("rect");
 * replaceWithCustomGeometry(shape, "M 0 0 L 50 100 L 100 0 Z");
 * // shape.shapeType === undefined, shape.pathData === "M 0 0 L 50 100 L 100 0 Z"
 * ```
 */
export function replaceWithCustomGeometry(
	element: ShapePptxElement,
	svgPath: string,
	pathWidth?: number,
	pathHeight?: number,
): void {
	if (!svgPath || svgPath.trim() === "") {
		throw new Error("svgPath must be a non-empty string");
	}

	// Clear preset geometry
	element.shapeType = undefined;
	element.shapeAdjustments = undefined;
	element.adjustmentHandles = undefined;

	// Set custom path data
	element.pathData = svgPath;
	element.pathWidth = pathWidth;
	element.pathHeight = pathHeight;

	// Clear structured custom geometry paths — the raw pathData is authoritative
	element.customGeometryPaths = undefined;
}

// ---------------------------------------------------------------------------
// Shape Morphing / Geometry Interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate between two SVG path data strings.
 *
 * For morph transitions, this function linearly interpolates the numeric
 * coordinates of matching path commands between a source and target path.
 * When `t = 0` the result equals `from`; when `t = 1` the result equals `to`.
 *
 * **Command matching rules:**
 * - Commands are matched positionally (1st from ↔ 1st to, etc.).
 * - When commands have the same type, their arguments are lerped.
 * - When command types differ, the arguments from the `from` side are
 *   lerped towards the `to` side (the `to` command type is used for the
 *   second half of the transition, i.e. when `t >= 0.5`).
 * - When one path has fewer commands, missing commands are zero-padded.
 *
 * @param from - SVG path data for the starting shape.
 * @param to - SVG path data for the ending shape.
 * @param t - Interpolation parameter in the range [0, 1].
 * @returns Interpolated SVG path data string.
 *
 * @example
 * ```ts
 * const mid = interpolateShapeGeometry(
 *   "M 0 0 L 100 0 L 100 100 Z",
 *   "M 0 0 L 200 0 L 200 200 Z",
 *   0.5,
 * );
 * // => "M 0 0 L 150 0 L 150 150 Z"
 * ```
 */
export function interpolateShapeGeometry(
	from: string,
	to: string,
	t: number,
): string {
	// Clamp t to [0, 1]
	const tc = Math.max(0, Math.min(1, t));

	// Fast paths
	if (tc === 0) return from;
	if (tc === 1) return to;

	const fromCmds = normaliseCommands(parsePathData(from));
	const toCmds = normaliseCommands(parsePathData(to));

	// Handle empty inputs
	if (fromCmds.length === 0 && toCmds.length === 0) return "";
	if (fromCmds.length === 0) return to;
	if (toCmds.length === 0) return from;

	const maxLen = Math.max(fromCmds.length, toCmds.length);
	const result: PathCommand[] = [];

	for (let i = 0; i < maxLen; i++) {
		const fCmd = fromCmds[i];
		const tCmd = toCmds[i];

		if (!fCmd && tCmd) {
			// Pad from side with zero-arg version of target command
			const zeroArgs = new Array(tCmd.args.length).fill(0);
			result.push({
				type: tCmd.type,
				args: tCmd.args.map((tVal, j) => lerp(zeroArgs[j], tVal, tc)),
			});
			continue;
		}

		if (fCmd && !tCmd) {
			// Pad to side with zero-arg version of from command
			const zeroArgs = new Array(fCmd.args.length).fill(0);
			result.push({
				type: fCmd.type,
				args: fCmd.args.map((fVal, j) => lerp(fVal, zeroArgs[j], tc)),
			});
			continue;
		}

		if (!fCmd || !tCmd) continue;

		// Both commands exist
		if (fCmd.type === "Z" && tCmd.type === "Z") {
			result.push({ type: "Z", args: [] });
			continue;
		}

		// Handle Z vs non-Z
		if (fCmd.type === "Z" || tCmd.type === "Z") {
			// Use the non-Z command type, lerp from/to zero for the Z side
			const nonZ = fCmd.type !== "Z" ? fCmd : tCmd;
			const isFromZ = fCmd.type === "Z";
			const zeroArgs = new Array(nonZ.args.length).fill(0);

			result.push({
				type: nonZ.type,
				args: nonZ.args.map((val, j) => {
					if (isFromZ) return lerp(zeroArgs[j], val, tc);
					return lerp(val, zeroArgs[j], tc);
				}),
			});
			continue;
		}

		// Same command type — straightforward lerp
		if (fCmd.type === tCmd.type) {
			const maxArgs = Math.max(fCmd.args.length, tCmd.args.length);
			const args: number[] = [];
			for (let j = 0; j < maxArgs; j++) {
				const fVal = j < fCmd.args.length ? fCmd.args[j] : 0;
				const tVal = j < tCmd.args.length ? tCmd.args[j] : 0;
				args.push(lerp(fVal, tVal, tc));
			}
			result.push({ type: fCmd.type, args });
			continue;
		}

		// Different command types — use crossfade:
		// In the first half (t < 0.5), use the `from` command type.
		// In the second half (t >= 0.5), use the `to` command type.
		const activeType = tc < 0.5 ? fCmd.type : tCmd.type;
		const maxArgs = Math.max(fCmd.args.length, tCmd.args.length);
		const args: number[] = [];
		for (let j = 0; j < maxArgs; j++) {
			const fVal = j < fCmd.args.length ? fCmd.args[j] : 0;
			const tVal = j < tCmd.args.length ? tCmd.args[j] : 0;
			args.push(lerp(fVal, tVal, tc));
		}
		result.push({ type: activeType, args });
	}

	return serializePathData(result);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Linear interpolation between two numbers.
 */
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Exported utilities (useful for advanced use cases)
// ---------------------------------------------------------------------------

/**
 * Parse an SVG path data string into a structured array of commands.
 *
 * Exposed for advanced consumers who need to inspect or manipulate
 * individual path commands before interpolation.
 *
 * @param d - SVG path data string.
 * @returns Array of parsed and normalised path commands.
 */
export function parseSvgPath(d: string): { type: string; args: number[] }[] {
	return normaliseCommands(parsePathData(d));
}

/**
 * Serialise parsed path commands back into an SVG path data string.
 *
 * @param commands - Array of path commands.
 * @returns SVG path data string.
 */
export function serializeSvgPath(
	commands: { type: string; args: number[] }[],
): string {
	return serializePathData(commands);
}

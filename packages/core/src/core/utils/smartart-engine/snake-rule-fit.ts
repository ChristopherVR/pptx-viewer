/**
 * A `snake` whose cells a `dgm:rule` may shrink (ECMA-376 Part 1, 21.4.2.x
 * `dgm:rule`: "Meet the Team"'s `<dgm:rule type="w" for="ch"
 * forName="compNode" val="50"/>`), and whose cells grow to their content
 * (`<dgm:rule type="h" val="INF"/>` on the cell). Such a grid does not scale
 * uniformly: the cell's photo scales with its width but its name and role
 * lines are fixed millimetre heights, so the grid is re-laid at each
 * candidate width.
 *
 * PowerPoint finds the width by bisection between the rule's `val` and the
 * cell's constrained width, FIVE probes, keeping the last probe that fits
 * (or the rule's `val` when none does), breaking lines when the canvas edge
 * is reached (`bkpt="endCnv"`, the default). Measured on the gallery's
 * cached drawings, EMU-exact: "Meet the Team" flat3 (3 cells from 100mm:
 * probes 75, 62.5, 68.75, 71.88, 73.44mm, kept 73.44mm = 2643750 EMU) and
 * hier5 (4 cells from the 650pt frame width: the fifth probe, 2001719 EMU,
 * is the first that fits, one row of four); hier8 (6 cells) never fits a
 * probe and lands on the 50mm floor, two rows of four and two.
 */

import { compositeChildBoxes } from './alg-composite';
import { applyConstraint, relatedNodes } from './constraint-eval';
import type { Box, EngineNode } from './engine-node';
import type { LdRule } from './layout-def-types';
import { evaluateWithReference } from './layout-driver';
import { canGrow } from './text-grow';

const POINTS_PER_MM = 72 / 25.4;
const PROBES = 5;

export interface SnakeCellFit {
	cellW: number;
	cellH: number;
	along: number;
	across: number;
	cols: number;
}

function sizeRule(node: EngineNode): LdRule | undefined {
	return node.rules.find(
		(rule) =>
			(rule.type === 'w' || rule.type === 'h') &&
			rule.for !== 'self' &&
			Number.isFinite(rule.val) &&
			rule.val >= 0,
	);
}

/** Re-evaluate `node`'s constraints with the rule's targets held at `value`. */
function evaluateAt(
	node: EngineNode,
	box: Box,
	rule: LdRule,
	targets: EngineNode[],
	value: number,
): void {
	evaluateWithReference(node, box.w, box.h);
	for (const target of targets) {
		target.values.set(rule.type, value);
	}
	for (const constraint of node.constraints) {
		const setsTarget =
			constraint.type === rule.type &&
			constraint.for === rule.for &&
			constraint.forName === rule.forName;
		if (!setsTarget) {
			applyConstraint(node, constraint);
		}
	}
	for (const target of targets) {
		target.values.set(rule.type, value);
	}
}

/** How tall a growing cell's content stands at width `w` (its children as its constraints place them). */
function contentHeight(cell: EngineNode, w: number, h: number): number {
	if (!canGrow(cell, 'h') || cell.alg.type !== 'composite') {
		return h;
	}
	const saved = new Map(cell.values);
	const frame = { x: 0, y: 0, w, h };
	evaluateWithReference(cell, w, h);
	compositeChildBoxes(cell, frame);
	let bottom = h;
	for (const child of cell.children) {
		const b = child.box;
		if (b && b.w > 0 && b.h > 0) {
			bottom = Math.max(bottom, b.y + b.h);
		}
	}
	cell.values = saved;
	return bottom;
}

function measure(
	node: EngineNode,
	box: Box,
	cells: EngineNode[],
	spacer: EngineNode | undefined,
	row: boolean,
): SnakeCellFit {
	const cellW = Math.max(...cells.map((c) => c.values.get('w') ?? box.w));
	const assignedH = Math.max(...cells.map((c) => c.values.get('h') ?? box.h));
	const cellH = Math.max(...cells.map((c) => contentHeight(c, cellW, assignedH)));
	const along = Math.max(0, spacer?.values.get(row ? 'w' : 'h') ?? node.values.get('sibSp') ?? 0);
	const across = Math.max(0, node.values.get('sp') ?? 0);
	const lineLimit = row ? box.w : box.h;
	const cell = row ? cellW : cellH;
	const cols = Math.max(
		1,
		Math.min(cells.length, Math.floor((lineLimit + along + 1e-6) / (cell + along))),
	);
	return { cellW, cellH, along, across, cols };
}

function fits(fit: SnakeCellFit, n: number, box: Box, row: boolean): boolean {
	const lines = Math.ceil(n / fit.cols);
	const lineLen = fit.cols * (row ? fit.cellW : fit.cellH) + (fit.cols - 1) * fit.along;
	const across = lines * (row ? fit.cellH : fit.cellW) + (lines - 1) * fit.across;
	return row
		? lineLen <= box.w + 1e-6 && across <= box.h + 1e-6
		: lineLen <= box.h + 1e-6 && across <= box.w + 1e-6;
}

/**
 * The cell size and line length a rule-shrunk snake settles on, or
 * `undefined` when the node has no such rule (or its cells do not grow), for
 * the uniform-scale path in `alg-snake.ts`.
 */
export function fitSnakeByRule(
	node: EngineNode,
	box: Box,
	cells: EngineNode[],
	spacers: EngineNode[],
	row: boolean,
): SnakeCellFit | undefined {
	const rule = sizeRule(node);
	if (!rule || !cells.some((c) => canGrow(c, 'h'))) {
		return undefined;
	}
	const targets = relatedNodes(node, rule.for, rule.forName, rule.ptType);
	if (targets.length === 0 || !targets.every((t) => cells.includes(t))) {
		return undefined;
	}
	const start = Math.max(
		...targets.map((t) => t.values.get(rule.type) ?? (rule.type === 'w' ? box.w : box.h)),
	);
	const floor = rule.val * POINTS_PER_MM;
	const at = (value: number): SnakeCellFit => {
		evaluateAt(node, box, rule, targets, value);
		return measure(node, box, cells, spacers[0], row);
	};
	let best = at(start);
	if (fits(best, cells.length, box, row) || !(start > floor)) {
		return best;
	}
	let lo = floor;
	let hi = start;
	let kept: number | undefined;
	for (let i = 0; i < PROBES; i++) {
		const mid = (lo + hi) / 2;
		if (fits(at(mid), cells.length, box, row)) {
			kept = mid;
			lo = mid;
		} else {
			hi = mid;
		}
	}
	best = at(kept ?? floor);
	return best;
}

/**
 * Minimum-cost assignment for the same-media morph matching pass.
 *
 * When several pictures on one slide share a media part, the pass has to pick
 * one incoming counterpart per outgoing picture - and with a uniform shift
 * there can be equally-valid bijections whose TOTAL travel is identical, so
 * nearest-first greedy and cardinality-first augmenting paths cannot tell
 * them apart. This module solves the choice as a minimum-cost one-to-one
 * assignment (Kuhn-Munkres with potentials, O(k^3)) over every legal
 * same-media edge.
 *
 * Everything here is pure; `morph-heuristics` builds the candidate list and
 * consumes the result one-way.
 *
 * @module render/morph-media-assignment
 */

import type { PptxElement } from 'pptx-viewer-core';

/**
 * One legal pairing edge of the media pass: an outgoing picture, an incoming
 * picture painting the same media part, how strongly they advertise the match
 * (same Selection Pane name beats unnamed) and how far apart they sit.
 */
export interface MediaCandidate {
	readonly to: PptxElement;
	readonly named: boolean;
	readonly dist: number;
	/** How far apart the two BOXES are (`|dw| + |dh|`), breaking exact ties. */
	readonly sizeDelta: number;
	/** Incoming-array index: deterministic tie-break among equal candidates. */
	readonly toIndex: number;
}

/**
 * Preference order for one outgoing picture's candidate list.
 *
 * Lexicographic preference encoded as weights whose scales cannot cross: an
 * unnamed edge pays a bonus-sized penalty, then raw travel distance, then how
 * unlike the two BOXES are, then the incoming input index (a power-of-two
 * divisor stays binary-exact) for full determinism.
 */
export function mediaEdgeCost(candidate: MediaCandidate): number {
	return (
		(candidate.named ? 0 : NAMED_EDGE_PENALTY) +
		candidate.dist +
		candidate.sizeDelta +
		candidate.toIndex / 1024
	);
}

/** Penalty for pairing against a counterpart without the outgoing pane name. */
export const NAMED_EDGE_PENALTY = 1e9;

/** Absent-edge cost, far above any attainable sum of real edge costs. */
export const ABSENT_EDGE_COST = 1e12;

/**
 * Solve the pass as a minimum-cost one-to-one assignment over every legal
 * same-media pairing edge.
 *
 * @returns For each outgoing id, the column assigned to it, expressed as an
 *          index into ITS OWN candidate array (`undefined` when the solver
 *          had to park it on padding, i.e. it stays unmatched).
 */
export function minCostMediaAssignment(
	candidatesOf: Map<string, MediaCandidate[]>,
): Map<string, number> {
	const fromIds = [...candidatesOf.keys()];
	const toIds: string[] = [];
	for (const candidates of candidatesOf.values()) {
		for (const candidate of candidates) {
			if (!toIds.includes(candidate.to.id)) {
				toIds.push(candidate.to.id);
			}
		}
	}

	const size = Math.max(fromIds.length, toIds.length);
	const grid: number[][] = [];
	for (let r = 0; r < fromIds.length; r++) {
		const candidates = candidatesOf.get(fromIds[r]);
		const row: number[] = new Array(size).fill(ABSENT_EDGE_COST);
		if (candidates) {
			for (const candidate of candidates) {
				row[toIds.indexOf(candidate.to.id)] = mediaEdgeCost(candidate);
			}
		}
		grid.push(row);
	}
	while (grid.length < size) {
		grid.push(new Array(size).fill(ABSENT_EDGE_COST));
	}

	const rowToCol = hungarianAssignment(grid);

	const assignment = new Map<string, number>();
	for (let r = 0; r < fromIds.length; r++) {
		const col = rowToCol[r];
		if (col === undefined || col >= toIds.length) {
			continue;
		}
		const candidates = candidatesOf.get(fromIds[r]);
		const localIndex = candidates?.findIndex((c) => c.to.id === toIds[col]);
		if (localIndex !== undefined && localIndex >= 0) {
			assignment.set(fromIds[r], localIndex);
		}
	}
	return assignment;
}

/**
 * O(k^3) Kuhn-Munkres assignment (potential method) for a SQUARE cost matrix.
 *
 * @returns `columns[r]`, the 0-based column assigned to row r.
 */
export function hungarianAssignment(cost: readonly (readonly number[])[]): number[] {
	const k = cost.length;
	if (k === 0) {
		return [];
	}
	const u = new Array<number>(k + 1).fill(0);
	const v = new Array<number>(k + 1).fill(0);
	// p[j]: the row (1-based) currently matched to column j; way[j]: the
	// previous column on the alternating path that reached j.
	const matchOfCol = new Array<number>(k + 1).fill(0);
	const parent = new Array<number>(k + 1).fill(0);
	for (let i = 1; i <= k; i++) {
		matchOfCol[0] = i;
		let j0 = 0;
		const minv = new Array<number>(k + 1).fill(Number.POSITIVE_INFINITY);
		const used = new Array<boolean>(k + 1).fill(false);
		do {
			used[j0] = true;
			const i0 = matchOfCol[j0];
			let delta = Number.POSITIVE_INFINITY;
			let j1 = 0;
			for (let j = 1; j <= k; j++) {
				if (used[j]) {
					continue;
				}
				const current = cost[i0 - 1][j - 1] - u[i0] - v[j];
				if (current < minv[j]) {
					minv[j] = current;
					parent[j] = j0;
				}
				if (minv[j] < delta) {
					delta = minv[j];
					j1 = j;
				}
			}
			for (let j = 0; j <= k; j++) {
				if (used[j]) {
					u[matchOfCol[j]] += delta;
					v[j] -= delta;
				} else {
					minv[j] -= delta;
				}
			}
			j0 = j1;
		} while (matchOfCol[j0] !== 0);
		do {
			const j1 = parent[j0];
			matchOfCol[j0] = matchOfCol[j1];
			j0 = j1;
		} while (j0 !== 0);
	}
	const columns = new Array<number>(k).fill(-1);
	for (let j = 1; j <= k; j++) {
		if (matchOfCol[j] > 0) {
			columns[matchOfCol[j] - 1] = j - 1;
		}
	}
	return columns;
}

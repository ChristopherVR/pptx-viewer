/**
 * Hit-target ids and the right-click menu of Edit Points mode.
 *
 * A binding renders every vertex, handle and segment with the target string
 * from the view descriptor on a `data-pptx-edit-points-target` attribute and
 * hands that string back with each pointer event, so it never has to know how
 * a target is addressed. The menu is decided here too (which entries, which are
 * greyed, which is checked), in PowerPoint's order: a vertex menu and a segment
 * menu.
 *
 * @module render/edit-points/edit-points-menu
 */
import { hasNode, hasSegment } from './edit-points-geometry-utils';
import type { EditGeometry, EditHandleRef, EditNodeRef, EditSegmentRef } from './edit-points-types';

/** What a pointer event landed on. */
export type EditPointsTarget =
	| { kind: 'node'; ref: EditNodeRef }
	| { kind: 'handle'; ref: EditHandleRef }
	| { kind: 'segment'; ref: EditSegmentRef }
	| { kind: 'background' };

/** DOM attribute a binding puts the target id on. */
export const EDIT_POINTS_TARGET_ATTR = 'data-pptx-edit-points-target';

/** The target id string for `target`. */
export function formatEditPointsTarget(target: EditPointsTarget): string {
	switch (target.kind) {
		case 'node':
			return `node:${target.ref.subpath}:${target.ref.node}`;
		case 'handle':
			return `handle:${target.ref.subpath}:${target.ref.segment}:${target.ref.which}`;
		case 'segment':
			return `segment:${target.ref.subpath}:${target.ref.segment}`;
		default:
			return 'background';
	}
}

/** Parse a target id (anything unrecognised is the background). */
export function parseEditPointsTarget(id: string | null | undefined): EditPointsTarget {
	const parts = (id ?? '').split(':');
	const nums = parts.slice(1, 3).map(Number);
	if (nums.some((n) => !Number.isInteger(n) || n < 0)) {
		return { kind: 'background' };
	}
	if (parts[0] === 'node' && parts.length === 3) {
		return { kind: 'node', ref: { subpath: nums[0], node: nums[1] } };
	}
	if (parts[0] === 'segment' && parts.length === 3) {
		return { kind: 'segment', ref: { subpath: nums[0], segment: nums[1] } };
	}
	if (parts[0] === 'handle' && parts.length === 4 && (parts[3] === 'c1' || parts[3] === 'c2')) {
		return {
			kind: 'handle',
			ref: { subpath: nums[0], segment: nums[1], which: parts[3] },
		};
	}
	return { kind: 'background' };
}

/** Every command the Edit Points right-click menu can offer. */
export type EditPointsCommandId =
	| 'add-point'
	| 'delete-point'
	| 'delete-segment'
	| 'open-path'
	| 'close-path'
	| 'smooth-point'
	| 'straight-point'
	| 'corner-point'
	| 'straight-segment'
	| 'curved-segment'
	| 'exit';

/** Every command id, in menu order (the customisation catalogue reads this). */
export const EDIT_POINTS_COMMAND_IDS: readonly EditPointsCommandId[] = [
	'add-point',
	'delete-point',
	'delete-segment',
	'open-path',
	'close-path',
	'smooth-point',
	'straight-point',
	'corner-point',
	'straight-segment',
	'curved-segment',
	'exit',
];

const LABEL_KEYS: Record<EditPointsCommandId, string> = {
	'add-point': 'pptx.editPoints.addPoint',
	'delete-point': 'pptx.editPoints.deletePoint',
	'delete-segment': 'pptx.editPoints.deleteSegment',
	'open-path': 'pptx.editPoints.openPath',
	'close-path': 'pptx.editPoints.closePath',
	'smooth-point': 'pptx.editPoints.smoothPoint',
	'straight-point': 'pptx.editPoints.straightPoint',
	'corner-point': 'pptx.editPoints.cornerPoint',
	'straight-segment': 'pptx.editPoints.straightSegment',
	'curved-segment': 'pptx.editPoints.curvedSegment',
	exit: 'pptx.editPoints.exit',
};

/** The i18n key for a command. */
export function editPointsCommandLabelKey(id: EditPointsCommandId): string {
	return LABEL_KEYS[id];
}

/** One rendered menu entry. */
export interface EditPointsMenuEntry {
	id: EditPointsCommandId;
	labelKey: string;
	separatorBefore?: boolean;
	disabled?: boolean;
	/** Radio-style check (the vertex's current type, the segment's kind). */
	checked?: boolean;
}

function entry(
	id: EditPointsCommandId,
	extra: Partial<EditPointsMenuEntry> = {},
): EditPointsMenuEntry {
	return { id, labelKey: LABEL_KEYS[id], ...extra };
}

function pointCount(geometry: EditGeometry): number {
	return geometry.subpaths.reduce((sum, sub) => sum + sub.nodes.length, 0);
}

/**
 * The menu for a right-click on `target`, or `null` when it opens no menu
 * (the background, a handle). `hidden` removes host-hidden commands.
 */
export function buildEditPointsMenu(
	geometry: EditGeometry,
	target: EditPointsTarget,
	hidden: ReadonlySet<EditPointsCommandId> = new Set(),
): EditPointsMenuEntry[] | null {
	let groups: EditPointsMenuEntry[][];
	if (target.kind === 'node' && hasNode(geometry, target.ref)) {
		const sub = geometry.subpaths[target.ref.subpath];
		const type = sub.nodes[target.ref.node].type;
		groups = [
			[
				entry('add-point', { disabled: sub.segments.length === 0 }),
				entry('delete-point', { disabled: pointCount(geometry) <= 2 }),
				sub.closed ? entry('open-path') : entry('close-path', { disabled: sub.nodes.length < 2 }),
			],
			[
				entry('smooth-point', { checked: type === 'smooth' }),
				entry('straight-point', { checked: type === 'straight' }),
				entry('corner-point', { checked: type === 'corner' }),
			],
			[entry('exit')],
		];
	} else if (target.kind === 'segment' && hasSegment(geometry, target.ref)) {
		const sub = geometry.subpaths[target.ref.subpath];
		const kind = sub.segments[target.ref.segment].kind;
		groups = [
			[
				entry('add-point'),
				entry('delete-segment', { disabled: pointCount(geometry) <= 2 }),
				// On a closed path, Delete Segment is what opens it at this segment.
				...(sub.closed ? [] : [entry('close-path')]),
			],
			[
				entry('straight-segment', { checked: kind === 'line' }),
				entry('curved-segment', { checked: kind === 'curve' }),
			],
			[entry('exit')],
		];
	} else {
		return null;
	}
	// Host-hidden entries go first, then empty groups, so a separator only ever
	// sits between two groups that both still have something in them.
	const visible = groups
		.map((group) => group.filter((e) => !hidden.has(e.id)))
		.filter((group) => group.length > 0)
		.flatMap((group, index) =>
			group.map((e, i) => (index > 0 && i === 0 ? { ...e, separatorBefore: true } : e)),
		);
	return visible.length > 0 ? visible : null;
}

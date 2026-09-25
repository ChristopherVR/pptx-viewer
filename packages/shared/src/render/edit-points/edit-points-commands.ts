import type { EditPointsCommandId, EditPointsTarget } from './edit-points-menu';
import { incomingSegmentIndex, outgoingSegmentIndex } from './edit-points-pen';
/**
 * Dispatch from an Edit Points menu command (or its keyboard / Ctrl+click
 * shortcut) to the structural operation it runs.
 *
 * @module render/edit-points/edit-points-commands
 */
import {
	addEditPoint,
	closeEditPath,
	deleteEditPoint,
	deleteEditSegment,
	openEditPathAtNode,
	setEditNodeType,
	setEditSegmentKind,
} from './edit-points-structure-ops';
import type { EditGeometry, EditNodeRef } from './edit-points-types';

/** The outcome of a command: the new geometry and the vertex to select. */
export interface EditPointsCommandResult {
	geometry: EditGeometry;
	selected?: EditNodeRef | null;
}

function wrap(geometry: EditGeometry | undefined, selected?: EditNodeRef | null) {
	return geometry ? { geometry, selected } : undefined;
}

/**
 * Run `id` against `target` (`t` is where on a segment the command applies,
 * for Add Point). `undefined` when the command does not apply.
 */
export function runEditPointsCommand(
	geometry: EditGeometry,
	id: EditPointsCommandId,
	target: EditPointsTarget,
	t = 0.5,
): EditPointsCommandResult | undefined {
	if (target.kind === 'node') {
		const ref = target.ref;
		const sub = geometry.subpaths[ref.subpath];
		if (!sub) {
			return undefined;
		}
		switch (id) {
			case 'add-point': {
				// From a vertex, PowerPoint adds the new point along the segment that
				// leaves it (or arrives, at the open end of a path).
				const out = outgoingSegmentIndex(sub, ref.node);
				const seg = out ?? incomingSegmentIndex(sub, ref.node);
				if (seg === undefined) {
					return undefined;
				}
				const added = addEditPoint(geometry, { subpath: ref.subpath, segment: seg }, 0.5);
				return added ? { geometry: added.geometry, selected: added.node } : undefined;
			}
			case 'delete-point':
				return wrap(deleteEditPoint(geometry, ref), null);
			case 'open-path':
				return wrap(openEditPathAtNode(geometry, ref), { subpath: ref.subpath, node: 0 });
			case 'close-path':
				return wrap(closeEditPath(geometry, ref.subpath), null);
			case 'smooth-point':
				return wrap(setEditNodeType(geometry, ref, 'smooth'), ref);
			case 'straight-point':
				return wrap(setEditNodeType(geometry, ref, 'straight'), ref);
			case 'corner-point':
				return wrap(setEditNodeType(geometry, ref, 'corner'), ref);
			default:
				return undefined;
		}
	}
	if (target.kind === 'segment') {
		const ref = target.ref;
		switch (id) {
			case 'add-point': {
				const added = addEditPoint(geometry, ref, t);
				return added ? { geometry: added.geometry, selected: added.node } : undefined;
			}
			case 'delete-segment':
				return wrap(deleteEditSegment(geometry, ref), null);
			case 'close-path':
				return wrap(closeEditPath(geometry, ref.subpath), null);
			case 'straight-segment':
				return wrap(setEditSegmentKind(geometry, ref, 'line'));
			case 'curved-segment':
				return wrap(setEditSegmentKind(geometry, ref, 'curve'));
			default:
				return undefined;
		}
	}
	return undefined;
}

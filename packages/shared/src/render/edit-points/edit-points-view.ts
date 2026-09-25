/**
 * The framework-neutral view descriptor of an Edit Points session: everything
 * a binding draws, already in SLIDE pixels (the unscaled stage space every
 * binding's overlays share) and already sized for the current zoom.
 *
 * A binding renders one `<svg>` the size of the slide over the stage and maps
 * this descriptor onto it: a full-size transparent background rect, one wide
 * transparent hit stroke per `segments` entry, the `outlineD` path, a line and
 * square per `handles` entry, and a square per `nodes` entry. Every hit shape
 * carries its `target` on {@link EDIT_POINTS_TARGET_ATTR}.
 *
 * @module render/edit-points/edit-points-view
 */
import { editLocalToSlide } from './edit-points-frame';
import { nodeHandles, segmentEndIndex } from './edit-points-geometry-utils';
import type { EditPointsMenuEntry } from './edit-points-menu';
import { formatEditPointsTarget } from './edit-points-menu';
import type {
	EditFrame,
	EditGeometry,
	EditNodeRef,
	EditPoint,
	EditPointNodeType,
} from './edit-points-types';

/** Colours and on-screen sizes (CSS px at 100% zoom) of the overlay. */
export const EDIT_POINTS_STYLE = {
	outlineColor: '#c00000',
	outlineWidth: 1,
	nodeFill: '#000000',
	nodeStroke: '#ffffff',
	selectedNodeFill: '#ffffff',
	selectedNodeStroke: '#000000',
	nodeSize: 8,
	handleFill: '#ffffff',
	handleStroke: '#2f5597',
	handleLineColor: '#2f5597',
	handleSize: 7,
	hitStrokeWidth: 10,
} as const;

/** One vertex square. */
export interface EditPointsNodeView {
	target: string;
	x: number;
	y: number;
	size: number;
	selected: boolean;
	type: EditPointNodeType;
}

/** One Bezier handle square plus the line back to its vertex. */
export interface EditPointsHandleView {
	target: string;
	x: number;
	y: number;
	anchorX: number;
	anchorY: number;
	size: number;
}

/** One segment's hit stroke. */
export interface EditPointsSegmentView {
	target: string;
	d: string;
}

/**
 * The right-click menu. `x`/`y` place it in slide pixels (inside the scaled
 * stage, drawn at `transform: scale(inverseScale)` from its top-left so it
 * stays screen-sized at any zoom); `clientX`/`clientY` are the same spot in
 * viewport pixels for a binding that renders it outside the stage instead.
 */
export interface EditPointsMenuView {
	x: number;
	y: number;
	inverseScale: number;
	clientX: number;
	clientY: number;
	entries: EditPointsMenuEntry[];
}

/** Everything a binding draws for an Edit Points session. */
export interface EditPointsView {
	outlineD: string;
	outlineWidth: number;
	segments: EditPointsSegmentView[];
	nodes: EditPointsNodeView[];
	handles: EditPointsHandleView[];
	hitStrokeWidth: number;
	menu: EditPointsMenuView | null;
}

function num(value: number): string {
	return String(Math.round(value * 100) / 100);
}

function segmentD(frame: EditFrame, geometry: EditGeometry, s: number, i: number): string {
	const sub = geometry.subpaths[s];
	const seg = sub.segments[i];
	const p0 = editLocalToSlide(frame, sub.nodes[i]);
	const p3 = editLocalToSlide(frame, sub.nodes[segmentEndIndex(sub, i)]);
	if (seg.kind === 'line') {
		return `M ${num(p0.x)} ${num(p0.y)} L ${num(p3.x)} ${num(p3.y)}`;
	}
	const c1 = editLocalToSlide(frame, seg.c1);
	const c2 = editLocalToSlide(frame, seg.c2);
	return `M ${num(p0.x)} ${num(p0.y)} C ${num(c1.x)} ${num(c1.y)} ${num(c2.x)} ${num(c2.y)} ${num(p3.x)} ${num(p3.y)}`;
}

/** The whole outline in slide space. */
export function editGeometryToSlidePath(frame: EditFrame, geometry: EditGeometry): string {
	const parts: string[] = [];
	const at = (p: EditPoint): string => {
		const s = editLocalToSlide(frame, p);
		return `${num(s.x)} ${num(s.y)}`;
	};
	for (const sub of geometry.subpaths) {
		if (sub.nodes.length === 0) {
			continue;
		}
		parts.push(`M ${at(sub.nodes[0])}`);
		sub.segments.forEach((seg, i) => {
			const end = sub.nodes[segmentEndIndex(sub, i)];
			parts.push(seg.kind === 'line' ? `L ${at(end)}` : `C ${at(seg.c1)} ${at(seg.c2)} ${at(end)}`);
		});
		if (sub.closed) {
			parts.push('Z');
		}
	}
	return parts.join(' ');
}

/** Build the descriptor for `geometry` at editor zoom `scale`. */
export function buildEditPointsView(
	frame: EditFrame,
	geometry: EditGeometry,
	selected: EditNodeRef | null,
	scale: number,
	menu: Omit<EditPointsMenuView, 'inverseScale'> | null,
): EditPointsView {
	const k = 1 / (scale > 0 ? scale : 1);
	const segments: EditPointsSegmentView[] = [];
	const nodes: EditPointsNodeView[] = [];
	const handles: EditPointsHandleView[] = [];
	geometry.subpaths.forEach((sub, s) => {
		sub.segments.forEach((_seg, i) => {
			segments.push({
				target: formatEditPointsTarget({ kind: 'segment', ref: { subpath: s, segment: i } }),
				d: segmentD(frame, geometry, s, i),
			});
		});
		sub.nodes.forEach((node, n) => {
			const p = editLocalToSlide(frame, node);
			nodes.push({
				target: formatEditPointsTarget({ kind: 'node', ref: { subpath: s, node: n } }),
				x: p.x,
				y: p.y,
				size: EDIT_POINTS_STYLE.nodeSize * k,
				selected: selected?.subpath === s && selected.node === n,
				type: node.type,
			});
		});
	});
	if (selected && geometry.subpaths[selected.subpath]?.nodes[selected.node]) {
		const sub = geometry.subpaths[selected.subpath];
		const anchor = editLocalToSlide(frame, sub.nodes[selected.node]);
		const { inSeg, outSeg, inHandle, outHandle } = nodeHandles(sub, selected.node);
		const push = (segment: number, which: 'c1' | 'c2', point: EditPoint): void => {
			const p = editLocalToSlide(frame, point);
			handles.push({
				target: formatEditPointsTarget({
					kind: 'handle',
					ref: { subpath: selected.subpath, segment, which },
				}),
				x: p.x,
				y: p.y,
				anchorX: anchor.x,
				anchorY: anchor.y,
				size: EDIT_POINTS_STYLE.handleSize * k,
			});
		};
		if (inHandle && inSeg !== undefined) {
			push(inSeg, 'c2', inHandle);
		}
		if (outHandle && outSeg !== undefined && !(outSeg === inSeg && inHandle === outHandle)) {
			push(outSeg, 'c1', outHandle);
		}
	}
	return {
		outlineD: editGeometryToSlidePath(frame, geometry),
		outlineWidth: EDIT_POINTS_STYLE.outlineWidth * k,
		segments,
		nodes,
		handles,
		hitStrokeWidth: EDIT_POINTS_STYLE.hitStrokeWidth * k,
		menu: menu ? { ...menu, inverseScale: k } : null,
	};
}

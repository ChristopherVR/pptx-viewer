/**
 * `EditPointsSession`: the whole Edit Points interaction as a framework-free
 * state machine. A binding creates one when the user picks Edit Points,
 * forwards pointer / context-menu / key events to it in SLIDE coordinates with
 * the target string it read off the hit shape, draws `view()`, and applies the
 * element patches it receives through `onCommit` (each is one undo step).
 *
 * Gestures (matching PowerPoint):
 *  - drag a vertex to move it; drag a handle to reshape the curve; drag a
 *    segment to bend it (a straight segment becomes a curve);
 *  - Ctrl+click a segment to add a point, Ctrl+click a vertex to delete it;
 *  - right-click a vertex or segment for the command menu;
 *  - Delete / Backspace removes the selected vertex;
 *  - Escape (or a click away from the shape) leaves the mode.
 *
 * The session keeps its own local frame (the element box when it began) for
 * its whole life, so repeated commits that re-anchor the element never make
 * the geometry drift. If the element changes underneath it (undo, a remote
 * edit), `reconcile` reloads from the element.
 *
 * @module render/edit-points/edit-points-session
 */
import type { PptxElement } from 'pptx-viewer-core';

import { nearestCubicParam } from './edit-points-bezier';
import { runEditPointsCommand } from './edit-points-commands';
import { moveEditHandle, moveEditNode, bendEditSegment } from './edit-points-drag-ops';
import { editGeometryToElementPatch } from './edit-points-export';
import { editFrameFromElement, editSlideToLocal } from './edit-points-frame';
import { hasNode, segmentAsCubic } from './edit-points-geometry-utils';
import { editGeometryFromElement } from './edit-points-import';
import type { EditPointsCommandId, EditPointsTarget } from './edit-points-menu';
import { buildEditPointsMenu, parseEditPointsTarget } from './edit-points-menu';
import type {
	EditPointsContextMenuInput,
	EditPointsDrag,
	EditPointsPointerInput,
	EditPointsSessionOptions,
} from './edit-points-session-types';
import {
	EDIT_POINTS_DRAG_THRESHOLD_PX,
	editPointsElementSignature,
} from './edit-points-session-types';
import type { EditFrame, EditGeometry, EditNodeRef, EditPoint } from './edit-points-types';
import type { EditPointsMenuView, EditPointsView } from './edit-points-view';
import { buildEditPointsView } from './edit-points-view';

export class EditPointsSession {
	readonly elementId: string;
	private frame: EditFrame;
	private geometry: EditGeometry;
	private selected: EditNodeRef | null = null;
	private drag: EditPointsDrag | null = null;
	private menu: (Omit<EditPointsMenuView, 'inverseScale'> & { target: EditPointsTarget }) | null =
		null;
	private signature: string;
	private ended = false;
	/** Where on the right-clicked segment the menu was opened (for Add Point). */
	private menuParam = 0.5;

	constructor(
		element: PptxElement,
		private readonly options: EditPointsSessionOptions,
	) {
		this.elementId = element.id;
		this.frame = editFrameFromElement(element);
		this.geometry = editGeometryFromElement(element) ?? { subpaths: [] };
		this.signature = editPointsElementSignature(element);
	}

	/** The current geometry (local frame). Exposed for tests and previews. */
	get currentGeometry(): EditGeometry {
		return this.geometry;
	}

	/** Whether the session has ended. */
	get isEnded(): boolean {
		return this.ended;
	}

	/** The descriptor to draw at editor zoom `scale`. */
	view(scale = 1): EditPointsView {
		const menu = this.menu
			? {
					x: this.menu.x,
					y: this.menu.y,
					clientX: this.menu.clientX,
					clientY: this.menu.clientY,
					entries: this.menu.entries,
				}
			: null;
		return buildEditPointsView(this.frame, this.geometry, this.selected, scale, menu);
	}

	/** Reload from `element` when it changed other than through this session. */
	reconcile(element: PptxElement): void {
		const next = editPointsElementSignature(element);
		if (next === this.signature || this.drag) {
			return;
		}
		this.signature = next;
		this.frame = editFrameFromElement(element);
		this.geometry = editGeometryFromElement(element) ?? { subpaths: [] };
		if (this.selected && !hasNode(this.geometry, this.selected)) {
			this.selected = null;
		}
		this.menu = null;
		this.changed();
	}

	private changed(): void {
		this.options.onChange?.();
	}

	private local(input: { x: number; y: number }): EditPoint {
		return editSlideToLocal(this.frame, { x: input.x, y: input.y });
	}

	/** Returns `false` when the press ended the session (a click away). */
	pointerDown(input: EditPointsPointerInput): boolean {
		if (this.ended) {
			return false;
		}
		if (this.menu) {
			this.menu = null;
			this.changed();
			return true;
		}
		if ((input.button ?? 0) !== 0) {
			return true;
		}
		const target = parseEditPointsTarget(input.target);
		const toggle = input.ctrlKey === true || input.metaKey === true;
		const base = { origin: this.geometry, startX: input.x, startY: input.y, moved: false };
		switch (target.kind) {
			case 'node':
				if (toggle) {
					this.apply('delete-point', target);
					return true;
				}
				this.selected = target.ref;
				this.drag = { ...base, kind: 'node', ref: target.ref };
				break;
			case 'handle':
				this.drag = { ...base, kind: 'handle', ref: target.ref };
				break;
			case 'segment': {
				const sub = this.geometry.subpaths[target.ref.subpath];
				if (!sub) {
					return true;
				}
				const t = nearestCubicParam(segmentAsCubic(sub, target.ref.segment), this.local(input));
				if (toggle) {
					this.apply('add-point', target, t);
					return true;
				}
				this.drag = { ...base, kind: 'segment', ref: target.ref, t };
				break;
			}
			default:
				this.exit();
				return false;
		}
		this.changed();
		return true;
	}

	pointerMove(input: EditPointsPointerInput): void {
		const drag = this.drag;
		if (!drag || this.ended) {
			return;
		}
		if (
			!drag.moved &&
			Math.hypot(input.x - drag.startX, input.y - drag.startY) < EDIT_POINTS_DRAG_THRESHOLD_PX
		) {
			return;
		}
		const to = this.local(input);
		if (drag.kind === 'node') {
			this.geometry = moveEditNode(drag.origin, drag.ref, to);
		} else if (drag.kind === 'handle') {
			this.geometry = moveEditHandle(drag.origin, drag.ref, to);
		} else {
			this.geometry = bendEditSegment(drag.origin, drag.ref, drag.t, to);
		}
		drag.moved = true;
		this.changed();
	}

	pointerUp(input?: EditPointsPointerInput): void {
		const drag = this.drag;
		if (!drag) {
			return;
		}
		if (input && drag.moved) {
			this.pointerMove(input);
		}
		this.drag = null;
		if (drag.moved) {
			this.commit(this.geometry);
		}
		this.changed();
	}

	/** Open the menu for a right-click. Returns whether a menu opened. */
	contextMenu(input: EditPointsContextMenuInput): boolean {
		if (this.ended) {
			return false;
		}
		this.pointerUp();
		const target = parseEditPointsTarget(input.target);
		if (target.kind === 'node') {
			this.selected = target.ref;
		}
		const entries = buildEditPointsMenu(this.geometry, target, this.options.hiddenCommands);
		this.menu = entries
			? { x: input.x, y: input.y, clientX: input.clientX, clientY: input.clientY, entries, target }
			: null;
		if (this.menu && target.kind === 'segment') {
			const sub = this.geometry.subpaths[target.ref.subpath];
			this.menuParam = sub
				? nearestCubicParam(segmentAsCubic(sub, target.ref.segment), this.local(input))
				: 0.5;
		}
		this.changed();
		return this.menu !== null;
	}

	/** Close the menu without running anything. */
	closeMenu(): void {
		if (this.menu) {
			this.menu = null;
			this.changed();
		}
	}

	/** Run a menu command against the target the menu was opened on. */
	runCommand(id: EditPointsCommandId): void {
		const menu = this.menu;
		this.menu = null;
		if (!menu || menu.entries.every((e) => e.id !== id || e.disabled)) {
			this.changed();
			return;
		}
		this.apply(id, menu.target, this.menuParam);
		this.changed();
	}

	private apply(id: EditPointsCommandId, target: EditPointsTarget, t = 0.5): void {
		if (id === 'exit') {
			this.exit();
			return;
		}
		const result = runEditPointsCommand(this.geometry, id, target, t);
		if (!result) {
			return;
		}
		this.selected = result.selected ?? null;
		this.commit(result.geometry);
		this.changed();
	}

	/** Returns whether the key was consumed. */
	keyDown(key: string): boolean {
		if (this.ended) {
			return false;
		}
		if (key === 'Escape') {
			if (this.menu) {
				this.closeMenu();
			} else {
				this.exit();
			}
			return true;
		}
		if ((key === 'Delete' || key === 'Backspace') && this.selected) {
			this.apply('delete-point', { kind: 'node', ref: this.selected });
			return true;
		}
		return false;
	}

	/** End the session, committing a drag still in flight. */
	exit(): void {
		if (this.ended) {
			return;
		}
		this.pointerUp();
		this.ended = true;
		this.menu = null;
		this.options.onExit();
	}

	private commit(geometry: EditGeometry): void {
		const patch = editGeometryToElementPatch(geometry, this.frame);
		if (!patch) {
			return;
		}
		this.geometry = geometry;
		this.signature = editPointsElementSignature(patch);
		this.options.onCommit(patch);
	}
}

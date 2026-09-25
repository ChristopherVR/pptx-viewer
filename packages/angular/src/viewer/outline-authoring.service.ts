/**
 * outline-authoring.service.ts: viewer-scoped state for the two outline
 * authoring modes, Edit Points on one shape and the armed Freeform: Shape /
 * Curve drawing tool. At most one is active: arming a tool ends Edit Points
 * and starting Edit Points disarms the tool.
 *
 * Every behaviour (hit targets, drags, menus, the element patch) lives in the
 * shared `EditPointsSession` / `FreeformToolSession`; this service only holds
 * which mode is on so the context menu, the Insert tab and the canvas overlay
 * agree.
 *
 * Reference binding: packages/react/src/viewer/hooks/useEditPointsState.ts
 *
 * @module angular-viewer/outline-authoring.service
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { FreeformToolKind } from '../internal/shared';
import { canEditElementPoints } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

@Injectable()
export class OutlineAuthoringService {
	private readonly editor = inject(EditorStateService, { optional: true });

	/** The shape in Edit Points mode, or null. */
	readonly editPointsElementId = signal<string | null>(null);
	/** The armed click-to-place drawing tool, or null. */
	readonly activeFreeformTool = signal<FreeformToolKind | null>(null);

	/**
	 * The canvas selection with the Edit Points shape removed, so its resize
	 * and rotate handles do not sit on top of its vertex handles.
	 */
	readonly canvasSelectedIds = computed<readonly string[]>(() => {
		const ids = this.editor?.selectedIds() ?? [];
		const editing = this.editPointsElementId();
		return editing ? ids.filter((id) => id !== editing) : ids;
	});

	/** Enter Edit Points on `element` when its outline may be edited. */
	startEditPoints(element: PptxElement | null | undefined): void {
		if (!element || !canEditElementPoints(element)) {
			return;
		}
		this.activeFreeformTool.set(null);
		this.editPointsElementId.set(element.id);
	}

	exitEditPoints(): void {
		this.editPointsElementId.set(null);
	}

	/** Arm a drawing tool (null disarms). */
	armFreeformTool(tool: FreeformToolKind | null): void {
		this.activeFreeformTool.set(tool);
		if (tool) {
			this.editPointsElementId.set(null);
		}
	}
}

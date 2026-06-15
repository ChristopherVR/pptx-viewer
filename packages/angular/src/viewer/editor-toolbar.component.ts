/**
 * editor-toolbar.component.ts — Horizontal insert/format toolbar for the
 * Angular PPTX editor.
 *
 * Selector: `pptx-editor-toolbar`
 *
 * Renders two groups separated by a visual divider:
 *  1. Insert — Text box, Rectangle, Ellipse, Line
 *  2. Arrange / Selection — Duplicate, Delete, Bring to Front, Send to Back,
 *                           Bring Forward, Send Backward
 *
 * All arrange/selection actions are disabled when no element is selected.
 * Insert actions always remain enabled.
 *
 * Usage:
 * ```html
 * <pptx-editor-toolbar [slideIndex]="activeSlideIndex()" />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { newShapeElement, newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-editor-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-toolbar" role="toolbar" aria-label="Editor toolbar">
			<!-- ── Insert group ──────────────────────────────────────────────────── -->
			<div class="pptx-ng-toolbar__group" role="group" aria-label="Insert">
				<span class="pptx-ng-toolbar__group-label">Insert</span>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Insert Text Box"
					(click)="onInsertText()"
				>
					T
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Insert Rectangle"
					(click)="onInsertShape('rect')"
				>
					▭
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Insert Ellipse"
					(click)="onInsertShape('ellipse')"
				>
					⬭
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Insert Line"
					(click)="onInsertShape('line')"
				>
					╱
				</button>
			</div>

			<!-- ── Divider ────────────────────────────────────────────────────────── -->
			<div class="pptx-ng-toolbar__divider" role="separator" aria-orientation="vertical"></div>

			<!-- ── Arrange / Selection group ─────────────────────────────────────── -->
			<div class="pptx-ng-toolbar__group" role="group" aria-label="Arrange">
				<span class="pptx-ng-toolbar__group-label">Arrange</span>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Duplicate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.duplicateSelected(slideIndex())"
				>
					⧉
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn pptx-ng-toolbar__btn--danger"
					title="Delete"
					[disabled]="!editor.hasSelection()"
					(click)="editor.deleteSelected(slideIndex())"
				>
					✕
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Bring to Front"
					[disabled]="!editor.hasSelection()"
					(click)="editor.bringSelectedToFront(slideIndex())"
				>
					⤒
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Send to Back"
					[disabled]="!editor.hasSelection()"
					(click)="editor.sendSelectedToBack(slideIndex())"
				>
					⤓
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Bring Forward"
					[disabled]="!editor.hasSelection()"
					(click)="editor.bringSelectedForward(slideIndex())"
				>
					↑
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Send Backward"
					[disabled]="!editor.hasSelection()"
					(click)="editor.sendSelectedBackward(slideIndex())"
				>
					↓
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Group"
					[disabled]="!canGroup()"
					(click)="editor.groupSelected(slideIndex())"
				>
					⊡
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Ungroup"
					[disabled]="!canUngroup()"
					(click)="editor.ungroupSelected(slideIndex())"
				>
					⊠
				</button>
			</div>

			<div class="pptx-ng-toolbar__divider" role="separator" aria-orientation="vertical"></div>

			<div class="pptx-ng-toolbar__group" role="group" aria-label="Align">
				<span class="pptx-ng-toolbar__group-label">Align</span>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Align Left"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'left')"
				>
					⊣
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Align Centre"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'centerH')"
				>
					⊟
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Align Right"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'right')"
				>
					⊢
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Align Top"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'top')"
				>
					⊤
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Align Middle"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'middle')"
				>
					⊞
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Align Bottom"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'bottom')"
				>
					⊥
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Distribute Horizontally"
					[disabled]="!canDistribute()"
					(click)="editor.distributeSelected(slideIndex(), 'horizontal')"
				>
					↔
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					title="Distribute Vertically"
					[disabled]="!canDistribute()"
					(click)="editor.distributeSelected(slideIndex(), 'vertical')"
				>
					↕
				</button>
			</div>
		</div>
	`,
	styles: `
		.pptx-ng-toolbar {
			display: flex;
			flex-direction: row;
			align-items: center;
			gap: 0;
			padding: 4px 8px;
			background: var(--pptx-toolbar-bg, #1e1e1e);
			color: var(--pptx-toolbar-fg, #e0e0e0);
			border-bottom: 1px solid var(--pptx-toolbar-border, #333);
			min-height: 36px;
			user-select: none;
		}

		.pptx-ng-toolbar__group {
			display: flex;
			flex-direction: row;
			align-items: center;
			gap: 2px;
		}

		.pptx-ng-toolbar__group-label {
			font-size: 10px;
			color: var(--pptx-toolbar-muted, #888);
			text-transform: uppercase;
			letter-spacing: 0.05em;
			padding: 0 6px 0 4px;
			flex-shrink: 0;
		}

		.pptx-ng-toolbar__divider {
			width: 1px;
			height: 20px;
			background: var(--pptx-toolbar-border, #444);
			margin: 0 6px;
			flex-shrink: 0;
		}

		.pptx-ng-toolbar__btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 26px;
			padding: 0;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 3px;
			color: inherit;
			font-size: 14px;
			cursor: pointer;
			transition:
				background 0.1s,
				border-color 0.1s;
			flex-shrink: 0;
		}

		.pptx-ng-toolbar__btn:hover:not(:disabled) {
			background: var(--pptx-toolbar-hover, #3a3a3a);
			border-color: var(--pptx-toolbar-border, #555);
		}

		.pptx-ng-toolbar__btn:active:not(:disabled) {
			background: var(--pptx-toolbar-active-bg, #2a2a2a);
		}

		.pptx-ng-toolbar__btn:disabled {
			opacity: 0.35;
			cursor: default;
		}

		.pptx-ng-toolbar__btn--danger:not(:disabled) {
			color: var(--pptx-toolbar-danger, #f47c7c);
		}

		.pptx-ng-toolbar__btn--danger:hover:not(:disabled) {
			background: var(--pptx-toolbar-danger-hover, #4a1a1a);
			border-color: var(--pptx-toolbar-danger-border, #6b2a2a);
		}
	`,
})
export class EditorToolbarComponent {
	/** Zero-based index of the slide being edited. */
	readonly slideIndex = input.required<number>();

	protected readonly editor = inject(EditorStateService);

	/** Align needs ≥2 selected elements; distribute needs ≥3. */
	protected readonly canAlign = computed(() => this.editor.selectedIds().length >= 2);
	protected readonly canDistribute = computed(() => this.editor.selectedIds().length >= 3);
	/** Group needs ≥2 selected; ungroup needs exactly one selected group. */
	protected readonly canGroup = computed(() => this.editor.selectedIds().length >= 2);
	protected readonly canUngroup = computed(() => {
		const ids = this.editor.selectedIds();
		if (ids.length !== 1) {
			return false;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		return slide?.elements.find((el) => el.id === ids[0])?.type === 'group';
	});

	protected onInsertText(): void {
		this.editor.addElement(this.slideIndex(), newTextElement());
	}

	protected onInsertShape(shapeType: 'rect' | 'ellipse' | 'line'): void {
		this.editor.addElement(this.slideIndex(), newShapeElement(shapeType));
	}
}

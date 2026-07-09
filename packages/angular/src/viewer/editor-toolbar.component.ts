/**
 * editor-toolbar.component.ts: Horizontal insert/format toolbar for the
 * Angular PPTX editor.
 *
 * Selector: `pptx-editor-toolbar`
 *
 * Renders two groups separated by a visual divider:
 *  1. Insert: Text box, Rectangle, Ellipse, Line
 *  2. Arrange / Selection: Duplicate, Delete, Bring to Front, Send to Back,
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
import {
	LucideAlignHorizontalSpaceAround,
	LucideAlignVerticalSpaceAround,
	LucideArrowDown,
	LucideArrowUp,
	LucideChevronDown,
	LucideChevronsDown,
	LucideChevronsUp,
	LucideChevronUp,
	LucideCircle,
	LucideCopy,
	LucideGroup,
	LucideSlash,
	LucideSquare,
	LucideTextAlignCenter,
	LucideTextAlignEnd,
	LucideTextAlignStart,
	LucideTrash2,
	LucideUngroup,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { newShapeElement, newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-editor-toolbar',
	standalone: true,
	imports: [
		TranslatePipe,
		LucideSquare,
		LucideCircle,
		LucideSlash,
		LucideCopy,
		LucideTrash2,
		LucideChevronsUp,
		LucideChevronsDown,
		LucideArrowUp,
		LucideArrowDown,
		LucideGroup,
		LucideUngroup,
		LucideTextAlignStart,
		LucideTextAlignCenter,
		LucideTextAlignEnd,
		LucideChevronUp,
		LucideChevronDown,
		LucideAlignHorizontalSpaceAround,
		LucideAlignVerticalSpaceAround,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			class="pptx-ng-toolbar"
			role="toolbar"
			[attr.aria-label]="'pptx.editorToolbar.ariaLabel' | translate"
		>
			<!-- ── Insert group ──────────────────────────────────────────────────── -->
			<div
				class="pptx-ng-toolbar__group"
				role="group"
				[attr.aria-label]="'pptx.editorToolbar.insert' | translate"
			>
				<span class="pptx-ng-toolbar__group-label">{{
					'pptx.editorToolbar.insert' | translate
				}}</span>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.insertTextBox' | translate"
					(click)="onInsertText()"
				>
					T
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.insertRectangle' | translate"
					(click)="onInsertShape('rect')"
				>
					<svg lucideSquare class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.insertEllipse' | translate"
					(click)="onInsertShape('ellipse')"
				>
					<svg lucideCircle class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.insertLine' | translate"
					(click)="onInsertShape('line')"
				>
					<svg lucideSlash class="h-4 w-4"></svg>
				</button>
			</div>

			<!-- ── Divider ────────────────────────────────────────────────────────── -->
			<div class="pptx-ng-toolbar__divider" role="separator" aria-orientation="vertical"></div>

			<!-- ── Arrange / Selection group ─────────────────────────────────────── -->
			<div
				class="pptx-ng-toolbar__group"
				role="group"
				[attr.aria-label]="'pptx.editorToolbar.arrange' | translate"
			>
				<span class="pptx-ng-toolbar__group-label">{{
					'pptx.editorToolbar.arrange' | translate
				}}</span>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.arrange.duplicate' | translate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.duplicateSelected(slideIndex())"
				>
					<svg lucideCopy class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn pptx-ng-toolbar__btn--danger"
					[title]="'pptx.arrange.delete' | translate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.deleteSelected(slideIndex())"
				>
					<svg lucideTrash2 class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.contextMenu.bringToFront' | translate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.bringSelectedToFront(slideIndex())"
				>
					<svg lucideChevronsUp class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.contextMenu.sendToBack' | translate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.sendSelectedToBack(slideIndex())"
				>
					<svg lucideChevronsDown class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.contextMenu.bringForward' | translate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.bringSelectedForward(slideIndex())"
				>
					<svg lucideArrowUp class="h-4 w-4"></svg>
				</button>

				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.contextMenu.sendBackward' | translate"
					[disabled]="!editor.hasSelection()"
					(click)="editor.sendSelectedBackward(slideIndex())"
				>
					<svg lucideArrowDown class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.contextMenu.group' | translate"
					[disabled]="!canGroup()"
					(click)="editor.groupSelected(slideIndex())"
				>
					<svg lucideGroup class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.contextMenu.ungroup' | translate"
					[disabled]="!canUngroup()"
					(click)="editor.ungroupSelected(slideIndex())"
				>
					<svg lucideUngroup class="h-4 w-4"></svg>
				</button>
			</div>

			<div class="pptx-ng-toolbar__divider" role="separator" aria-orientation="vertical"></div>

			<div
				class="pptx-ng-toolbar__group"
				role="group"
				[attr.aria-label]="'pptx.editorToolbar.align' | translate"
			>
				<span class="pptx-ng-toolbar__group-label">{{
					'pptx.editorToolbar.align' | translate
				}}</span>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.alignLeft' | translate"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'left')"
				>
					<svg lucideTextAlignStart class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.alignCenter' | translate"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'centerH')"
				>
					<svg lucideTextAlignCenter class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.alignRight' | translate"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'right')"
				>
					<svg lucideTextAlignEnd class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.alignTop' | translate"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'top')"
				>
					<svg lucideChevronUp class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.alignMiddle' | translate"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'middle')"
				>
					<svg lucideTextAlignCenter class="h-4 w-4 rotate-90"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.editorToolbar.alignBottom' | translate"
					[disabled]="!canAlign()"
					(click)="editor.alignSelected(slideIndex(), 'bottom')"
				>
					<svg lucideChevronDown class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.arrange.distributeHorizontal' | translate"
					[disabled]="!canDistribute()"
					(click)="editor.distributeSelected(slideIndex(), 'horizontal')"
				>
					<svg lucideAlignHorizontalSpaceAround class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-ng-toolbar__btn"
					[title]="'pptx.arrange.distributeVertical' | translate"
					[disabled]="!canDistribute()"
					(click)="editor.distributeSelected(slideIndex(), 'vertical')"
				>
					<svg lucideAlignVerticalSpaceAround class="h-4 w-4"></svg>
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
			gap: 4px;
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
			margin: 0 4px;
			flex-shrink: 0;
		}

		.pptx-ng-toolbar__btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 28px;
			height: 28px;
			padding: 2px 8px;
			background: transparent;
			border: 1px solid transparent;
			border-radius: 4px;
			color: inherit;
			font-size: 14px;
			cursor: pointer;
			transition: background 0.1s;
			flex-shrink: 0;
		}

		.pptx-ng-toolbar__btn:hover:not(:disabled) {
			background: var(--pptx-toolbar-hover, #3a3a3a);
		}

		.pptx-ng-toolbar__btn:active:not(:disabled) {
			background: var(--pptx-toolbar-active-bg, #2a2a2a);
			transform: scale(0.95);
			opacity: 0.8;
		}

		.pptx-ng-toolbar__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-ng-toolbar__btn--danger:not(:disabled) {
			color: var(--pptx-toolbar-danger, #f47c7c);
		}

		.pptx-ng-toolbar__btn--danger:hover:not(:disabled) {
			background: var(--pptx-toolbar-danger-hover, #4a1a1a);
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

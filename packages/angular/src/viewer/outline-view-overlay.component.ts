/**
 * outline-view-overlay.component.ts: PowerPoint's Outline view, Angular binding.
 *
 * The deck as an editable indented text document: one row per slide title at
 * the left margin, that slide's body lines stepped in beneath it. Typing edits
 * the slide, Tab and Shift+Tab change a line's outline level, and Enter on a
 * title starts a new slide.
 *
 * Every rule (what a row is, what Tab does, which edit produces a new slide)
 * comes from `render/outline-view` and `render/outline-view-edit` in
 * `pptx-viewer-shared`, so the five bindings cannot drift apart. Nothing in
 * this file decides what an outline gesture means.
 *
 * The deck it edits is the EDITABLE one, never the merged display deck: Angular
 * partitions each slide's inherited master/layout elements into a separate
 * store, and committing a merged deck back would bake that whole template layer
 * into every slide's own elements.
 *
 * Reference binding: packages/react/src/viewer/components/OutlineViewOverlay.tsx
 */
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	input,
	output,
	viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import {
	OUTLINE_LEVEL_ATTR,
	OUTLINE_ROW_ATTR,
	OUTLINE_SLIDE_ATTR,
	OUTLINE_VIEW_ATTR,
	applyOutlineEdit,
	buildOutline,
	mapOutlineKey,
} from '../internal/shared';
import type { CanvasSize, OutlineEdit, OutlineRow } from '../internal/shared';
import { OUTLINE_VIEW_OVERLAY_STYLES } from './outline-view-overlay.styles';

/** Indent per outline level, in pixels. Level 0 (a title) sits flush left. */
const INDENT_PX = 22;

/** The deck after an outline edit, plus the slide the editor should land on. */
export interface OutlineCommit {
	slides: PptxSlide[];
	activeSlideIndex: number;
}

@Component({
	selector: 'pptx-outline-view-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideX],
	styles: OUTLINE_VIEW_OVERLAY_STYLES,
	template: `
		<div
			class="pptx-ng-outline-root"
			[attr.data-pptx-outline-view]="'true'"
			role="region"
			[attr.aria-label]="'pptx.view.outlineView' | translate"
		>
			<div class="pptx-ng-outline-bar">
				<span class="pptx-ng-outline-title">{{ 'pptx.view.outlineView' | translate }}</span>
				<span class="pptx-ng-outline-hint">{{ 'pptx.outline.hint' | translate }}</span>
				<button
					type="button"
					class="pptx-ng-outline-btn"
					[attr.aria-label]="'pptx.statusBar.normalView' | translate"
					[title]="'pptx.statusBar.normalView' | translate"
					(click)="closed.emit()"
				>
					<svg lucideX class="h-4 w-4"></svg>
				</button>
			</div>

			<div #rowsHost class="pptx-ng-outline-rows">
				@for (row of rows(); track row.key) {
					<div class="pptx-ng-outline-row" [style.padding-left.px]="row.level * INDENT_PX">
						<!--
							The slide number is drawn only on a slide's first row, which is
							always its title row, so the outline reads as a list of slides
							rather than as one undifferentiated wall of lines.
						-->
						<span class="pptx-ng-outline-number">{{
							row.kind === 'title' ? row.slideIndex + 1 : ''
						}}</span>
						<input
							type="text"
							class="pptx-ng-outline-input"
							[class.is-title]="row.kind === 'title'"
							[value]="row.text"
							[readOnly]="!canEdit()"
							[attr.data-pptx-outline-row]="row.key"
							[attr.data-pptx-outline-slide]="row.slideIndex + 1"
							[attr.data-pptx-outline-level]="row.level"
							[attr.aria-label]="
								(row.kind === 'title' ? 'pptx.outline.titleLine' : 'pptx.outline.bodyLine')
									| translate
							"
							(input)="onInput($event, row.key)"
							(keydown)="onRowKeyDown($event, row.key)"
						/>
					</div>
				}
			</div>
		</div>
	`,
})
export class OutlineViewOverlayComponent {
	/** The editable (template-free) deck. See the class docstring for why. */
	readonly slides = input<readonly PptxSlide[]>([]);
	readonly canvasSize = input.required<CanvasSize>();
	readonly canEdit = input<boolean>(false);

	/** Emits the deck after an edit, so the host records ONE undo entry. */
	readonly commit = output<OutlineCommit>();
	readonly closed = output<void>();

	protected readonly INDENT_PX = INDENT_PX;

	protected readonly rows = computed<OutlineRow[]>(() => buildOutline(this.slides()));

	private readonly rowsHost = viewChild<ElementRef<HTMLElement>>('rowsHost');

	protected onInput(event: Event, key: string): void {
		const target = event.target as HTMLInputElement | null;
		this.run({ type: 'setText', key, text: target?.value ?? '' });
	}

	protected onRowKeyDown(event: KeyboardEvent, key: string): void {
		const { edit, preventDefault } = mapOutlineKey(event, key);
		if (preventDefault) {
			// Tab would otherwise walk out of the outline entirely, and Enter would
			// submit a surrounding form on a host page that has one.
			event.preventDefault();
		}
		if (edit) {
			this.run(edit);
		}
	}

	private run(edit: OutlineEdit): void {
		if (!this.canEdit()) {
			return;
		}
		const result = applyOutlineEdit(this.slides(), edit, { canvas: this.canvasSize() });
		if (!result.changed) {
			return;
		}
		this.commit.emit({ slides: result.slides, activeSlideIndex: result.activeSlideIndex });
		this.focusRow(result.focusKey);
	}

	/**
	 * Restore the caret after the host has re-fed the new deck.
	 *
	 * Deferred to a microtask because the row that should take focus may not
	 * exist yet: a new slide's title row only enters the DOM once change
	 * detection has run over the committed deck.
	 */
	private focusRow(key: string | null): void {
		if (!key) {
			return;
		}
		queueMicrotask(() => {
			const selector = `[${OUTLINE_ROW_ATTR}="${CSS.escape(key)}"]`;
			const target = this.rowsHost()?.nativeElement.querySelector<HTMLInputElement>(selector);
			if (target && document.activeElement !== target) {
				target.focus();
				target.setSelectionRange(target.value.length, target.value.length);
			}
		});
	}
}

/**
 * Re-exported so a consumer importing this component also gets the neutral DOM
 * contract constants without reaching into the vendored shared source.
 */
export { OUTLINE_LEVEL_ATTR, OUTLINE_ROW_ATTR, OUTLINE_SLIDE_ATTR, OUTLINE_VIEW_ATTR };

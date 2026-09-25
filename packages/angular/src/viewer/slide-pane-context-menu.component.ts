/**
 * slide-pane-context-menu.component.ts: the slides pane's thumbnail
 * right-click menu (New Slide, Duplicate, Delete, Layout, Hide, Add Section).
 *
 * Selector: `pptx-slide-pane-context-menu`
 *
 * Sibling of `SlideCanvasContextMenuComponent` (the empty-canvas menu). The
 * item list comes from `buildSlidePaneContextMenuEntries` in
 * `pptx-viewer-shared`, this component's job is only to render it and route a
 * chosen command.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { SlidePaneContextMenuCommandId, SlidePaneContextMenuEntry } from '../internal/shared';
import { buildSlidePaneContextMenuEntries } from '../internal/shared';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';
import type { SlidePaneContextMenuActions } from './slide-pane-context-menu-dispatch';
import { runSlidePaneContextMenuCommand } from './slide-pane-context-menu-dispatch';

@Component({
	selector: 'pptx-slide-pane-context-menu',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<ul
			class="pptx-ctx__menu"
			data-pptx-context-menu="true"
			data-pptx-slide-pane-context-menu="true"
			role="menu"
			[attr.aria-label]="'pptx.slidesPane.contextMenu.newSlide' | translate"
		>
			@for (entry of entries(); track entry.id) {
				@if (entry.separatorBefore) {
					<li role="separator" class="pptx-ctx__divider"></li>
				}
				<li role="none">
					<button
						type="button"
						class="pptx-ctx__item"
						[class.pptx-ctx__item--danger]="entry.id === 'delete'"
						role="menuitem"
						[disabled]="!!entry.disabled"
						(click)="run(entry.id)"
					>
						{{
							entry.countLabelKey
								? (entry.labelKey | translate: { count: selectedIndexes().length })
								: (entry.labelKey | translate)
						}}
					</button>
				</li>
			}
		</ul>
	`,
	styles: [EDITOR_CONTEXT_MENU_STYLES],
	host: {
		'[style.--pptx-ctx-x]': 'x() + "px"',
		'[style.--pptx-ctx-y]': 'y() + "px"',
	},
})
export class SlidePaneContextMenuComponent {
	readonly x = input.required<number>();
	readonly y = input.required<number>();
	readonly slideIndex = input.required<number>();
	readonly selectedIndexes = input.required<number[]>();
	readonly slides = input.required<readonly PptxSlide[]>();

	readonly closed = output<void>();
	readonly addSlideAfter = output<number>();
	readonly duplicateSlides = output<number[]>();
	readonly deleteSlides = output<number[]>();
	/** Makes the right-clicked slide active, then opens the Layout gallery at (x, y). */
	readonly openLayoutForSlide = output<{ index: number; x: number; y: number }>();
	readonly toggleHideSlides = output<number[]>();
	readonly addSectionAt = output<number>();

	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

	protected readonly entries = computed<SlidePaneContextMenuEntry[]>(() => {
		const selected = this.selectedIndexes()
			.map((i) => this.slides()[i])
			.filter((s): s is PptxSlide => Boolean(s));
		return buildSlidePaneContextMenuEntries({
			selectedCount: selected.length,
			hasHiddenInSelection: selected.some((s) => s.hidden),
			hasVisibleInSelection: selected.some((s) => !s.hidden),
			wouldDeleteAllSlides: selected.length >= this.slides().length,
		});
	});

	private readonly actions: SlidePaneContextMenuActions = {
		addSlideAfter: (index) => this.addSlideAfter.emit(index),
		duplicateSlides: (indexes) => this.duplicateSlides.emit(indexes),
		deleteSlides: (indexes) => this.deleteSlides.emit(indexes),
		openLayoutForSlide: (index, x, y) => this.openLayoutForSlide.emit({ index, x, y }),
		toggleHideSlides: (indexes) => this.toggleHideSlides.emit(indexes),
		addSectionAt: (index) => this.addSectionAt.emit(index),
	};

	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.closed.emit();
	}

	@HostListener('document:pointerdown', ['$event'])
	onDocumentPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (!this.host.nativeElement.contains(target)) {
			this.closed.emit();
		}
	}

	/** Run the chosen command, then close: every item closes the menu. */
	protected run(id: SlidePaneContextMenuCommandId): void {
		runSlidePaneContextMenuCommand(
			id,
			this.slideIndex(),
			this.selectedIndexes(),
			{ x: this.x(), y: this.y() },
			this.actions,
		);
		this.closed.emit();
	}
}

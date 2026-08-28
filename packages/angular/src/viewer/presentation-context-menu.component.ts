/**
 * presentation-context-menu.component.ts: right-click menu shown while
 * presenting.
 *
 * Selector: `pptx-presentation-context-menu`
 *
 * Item order/grouping/i18n keys come from the shared
 * `getPresentationContextMenuSections` (`pptx-viewer-shared`), the same
 * source React's `PresentationContextMenu` and Vue's `PresentationMode`
 * render from, so this menu cannot drift from theirs. This component only
 * describes what capabilities are available (always all of them here: the
 * overlay already has next/prev, See All Slides, presenter view, pointer
 * tools, and the black/white blank screen) and routes a chosen action id
 * back to the overlay via a single output.
 *
 * Closes on Escape and on an outside pointerdown, matching
 * `EditorContextMenuComponent`.
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

import type {
	PresentationContextMenuActionId,
	PresentationContextMenuSection,
} from '../internal/shared';
import { getPresentationContextMenuSections } from '../internal/shared';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';

@Component({
	selector: 'pptx-presentation-context-menu',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<ul
			class="pptx-ctx__menu"
			data-pptx-presentation-menu="true"
			role="menu"
			(contextmenu)="$event.preventDefault()"
		>
			@for (section of sections(); track section.id; let sectionIndex = $index) {
				@if (sectionIndex > 0) {
					<li role="separator" class="pptx-ctx__divider"></li>
				}
				@for (item of section.items; track item.id) {
					<li role="none">
						<button type="button" class="pptx-ctx__item" role="menuitem" (click)="run(item.id)">
							{{ item.labelKey | translate }}
						</button>
					</li>
				}
			}
		</ul>
	`,
	styles: EDITOR_CONTEXT_MENU_STYLES,
	host: {
		'[style.--pptx-ctx-x]': 'x() + "px"',
		'[style.--pptx-ctx-y]': 'y() + "px"',
	},
})
export class PresentationContextMenuComponent {
	/** Horizontal viewport coordinate (px) of the top-left corner of the menu. */
	readonly x = input.required<number>();
	/** Vertical viewport coordinate (px) of the top-left corner of the menu. */
	readonly y = input.required<number>();

	/** Emitted when the menu should close (Escape, outside click, or after an action). */
	readonly closed = output<void>();
	/** The chosen action id; the overlay maps it onto its own navigator/annotations/etc. */
	readonly action = output<PresentationContextMenuActionId>();

	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

	protected readonly sections = computed<PresentationContextMenuSection[]>(() =>
		getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		}),
	);

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

	protected run(id: PresentationContextMenuActionId): void {
		this.action.emit(id);
		this.closed.emit();
	}
}

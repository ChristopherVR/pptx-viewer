/**
 * section-context-menu.component.ts: the slides pane's section-header
 * right-click menu (Rename, Delete, Move Up, Move Down, Add Section After).
 *
 * Selector: `pptx-section-context-menu`
 *
 * Sibling of `SlidePaneContextMenuComponent` (the thumbnail menu). The item
 * list, order, separators and end-of-list gating come from
 * `buildSectionContextMenuEntries` in `pptx-viewer-shared`; this component's
 * job is only to render it and route a chosen command back to the panel.
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

import { buildSectionContextMenuEntries } from '../internal/shared';
import type { SectionContextMenuCommandId, SectionContextMenuEntry } from '../internal/shared';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';

@Component({
	selector: 'pptx-section-context-menu',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<ul
			class="pptx-ctx__menu"
			data-pptx-context-menu="true"
			data-pptx-section-context-menu="true"
			role="menu"
			[attr.aria-label]="'pptx.sections.sectionButtonLabel' | translate"
		>
			@for (entry of entries(); track entry.id) {
				@if (entry.separatorBefore) {
					<li role="separator" class="pptx-ctx__divider"></li>
				}
				<li role="none">
					<button
						type="button"
						class="pptx-ctx__item"
						role="menuitem"
						[disabled]="!!entry.disabled"
						(click)="run(entry.id)"
					>
						{{ entry.labelKey | translate }}
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
export class SectionContextMenuComponent {
	readonly x = input.required<number>();
	readonly y = input.required<number>();
	/** Position of the section among the declared sections. */
	readonly sectionIndex = input.required<number>();
	readonly totalSections = input.required<number>();

	readonly closed = output<void>();
	readonly command = output<SectionContextMenuCommandId>();

	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

	protected readonly entries = computed<SectionContextMenuEntry[]>(() =>
		buildSectionContextMenuEntries({
			sectionIndex: this.sectionIndex(),
			totalSections: this.totalSections(),
		}),
	);

	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.closed.emit();
	}

	@HostListener('document:pointerdown', ['$event'])
	onDocumentPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (target instanceof Node && !this.host.nativeElement.contains(target)) {
			this.closed.emit();
		}
	}

	/** Run the chosen command, then close: every item closes the menu. */
	protected run(id: SectionContextMenuCommandId): void {
		this.command.emit(id);
		this.closed.emit();
	}
}

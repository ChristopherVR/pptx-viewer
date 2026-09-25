/**
 * ribbon-merge-shapes.component.ts: the Home > Arrange group's "Merge Shapes"
 * dropdown (Union / Combine / Fragment / Intersect / Subtract).
 *
 * The menu is the shared `MERGE_SHAPES_MENU_ITEMS` list, so all five bindings
 * offer the same operations in the same order under the same names; the
 * button is enabled by the shared `canMergeShapes` (two or more mergeable
 * shapes) and the merge itself runs through {@link runMergeShapes}.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	input,
	signal,
} from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
	MERGE_SHAPES_HINT_KEY,
	MERGE_SHAPES_LABEL_KEY,
	MERGE_SHAPES_MENU_ITEMS,
} from '../internal/shared';
import type { MergeShapesMenuItem } from '../internal/shared';
import { AnchoredPopupDirective } from './anchored-popup.directive';
import { EditorStateService } from './editor-state.service';
import { canMergeSelection, runMergeShapes } from './merge-shapes-action';

@Component({
	selector: 'pptx-ribbon-merge-shapes',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'pptx-rb-grp relative' },
	imports: [TranslatePipe, LucideChevronDown, AnchoredPopupDirective],
	template: `
		<button
			#trigger
			type="button"
			class="pptx-rb-gl gap-1 whitespace-nowrap"
			data-pptx-ribbon-control="merge-shapes"
			aria-haspopup="menu"
			[attr.aria-expanded]="open()"
			[attr.aria-label]="labelKey | translate"
			[disabled]="!enabled()"
			[title]="(enabled() ? labelKey : hintKey) | translate"
			(click)="open.set(!open())"
		>
			{{ labelKey | translate }} <svg lucideChevronDown class="h-3 w-3"></svg>
		</button>
		@if (open() && enabled()) {
			<div
				role="menu"
				class="z-50 mt-0.5 flex flex-col rounded border border-border bg-popover p-1 shadow-md"
				[attr.aria-label]="labelKey | translate"
				[pptxAnchoredPopup]="trigger"
			>
				@for (item of items; track item.operation) {
					<button
						type="button"
						role="menuitem"
						class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
						[attr.data-pptx-merge-op]="item.operation"
						(click)="choose(item)"
					>
						{{ item.labelKey | translate }}
					</button>
				}
			</div>
		}
	`,
})
export class RibbonMergeShapesComponent {
	private readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(false);

	protected readonly labelKey = MERGE_SHAPES_LABEL_KEY;
	protected readonly hintKey = MERGE_SHAPES_HINT_KEY;
	protected readonly items = MERGE_SHAPES_MENU_ITEMS;
	protected readonly open = signal(false);

	/** Editable deck and two or more mergeable shapes selected. */
	protected readonly enabled = computed(
		() => this.canEdit() && canMergeSelection(this.editor, this.slideIndex()),
	);

	/** Run the chosen operation as one undoable update, then close the menu. */
	protected choose(item: MergeShapesMenuItem): void {
		this.open.set(false);
		runMergeShapes(
			this.editor,
			this.slideIndex(),
			item.operation,
			this.translate.instant(this.labelKey) as string,
		);
	}

	/** A press anywhere outside the button and its menu closes the menu. */
	@HostListener('document:pointerdown', ['$event'])
	protected onDocumentPointerDown(event: PointerEvent): void {
		if (this.open() && !this.host.nativeElement.contains(event.target as Node | null)) {
			this.open.set(false);
		}
	}
}

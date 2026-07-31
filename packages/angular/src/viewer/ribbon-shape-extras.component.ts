/**
 * ribbon-shape-extras.component.ts: the Arrange group's shape-level extras
 * (Group, Ungroup, and the outline-width spinner).
 *
 * Kept out of {@link RibbonArrangeSectionComponent} so neither file drifts past
 * this repo's 300-LOC budget, and grouped together because all three are gated
 * on the same thing: a selection that is actually a shape (or, for Group, two
 * elements of any kind). Svelte shipped them first and React has since caught
 * up, which left Angular the only binding whose Home tab could not group,
 * ungroup, or set an outline width without opening the inspector.
 *
 * The names are the context menu's (`pptx.contextMenu.group` / `.ungroup`)
 * rather than the Arrange tab's older `pptx.ribbon.group`, because the ribbon
 * inventory spec diffs controls by accessible name and every other binding
 * settled on the context-menu wording.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideGroup, LucideUngroup } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';

/** Outline thickness the renderer assumes when the shape declares none. */
const DEFAULT_STROKE_WIDTH = 1;

/** Grouping needs an editable deck and at least two selected elements. */
export function canGroupSelection(canEdit: boolean, selectedCount: number): boolean {
	return canEdit && selectedCount >= 2;
}

/** Ungrouping needs an editable deck and a selection that IS a group. */
export function canUngroupSelection(canEdit: boolean, element: PptxElement | null): boolean {
	return canEdit && element?.type === 'group';
}

/** An outline width only exists on an element that carries shape properties. */
export function canSetStrokeWidth(canEdit: boolean, element: PptxElement | null): boolean {
	return canEdit && element !== null && hasShapeProperties(element);
}

/** The stroke width to show for a selection, defaulted for a shape without one. */
export function strokeWidthOf(element: PptxElement | null): number {
	if (element === null || !hasShapeProperties(element)) {
		return DEFAULT_STROKE_WIDTH;
	}
	return element.shapeStyle?.strokeWidth ?? DEFAULT_STROKE_WIDTH;
}

@Component({
	selector: 'pptx-ribbon-shape-extras',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, LucideGroup, LucideUngroup],
	template: `
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!canGroup()"
				[title]="'pptx.contextMenu.group' | translate"
				[attr.aria-label]="'pptx.contextMenu.group' | translate"
				(click)="editor.groupSelected(slideIndex())"
			>
				<svg lucideGroup class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!canUngroup()"
				[title]="'pptx.contextMenu.ungroup' | translate"
				[attr.aria-label]="'pptx.contextMenu.ungroup' | translate"
				(click)="editor.ungroupSelected(slideIndex())"
			>
				<svg lucideUngroup class="h-4 w-4"></svg>
			</button>
		</div>
		<!--
			Named explicitly: the spinner has no visible caption in the ribbon, so
			without aria-label it announces itself as an anonymous number box.
		-->
		<input
			type="number"
			min="0"
			max="120"
			step="0.5"
			class="pptx-rb-select h-[26px] w-[52px] cursor-text px-1 text-center text-[11px]"
			[disabled]="!canSetStroke()"
			[title]="'pptx.ribbon.strokeWidth' | translate"
			[attr.aria-label]="'pptx.ribbon.strokeWidth' | translate"
			[value]="strokeWidth()"
			(change)="onStrokeWidth($event)"
		/>
	`,
})
export class RibbonShapeExtrasComponent {
	protected readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);

	/** Grouping needs two elements; the multi-select is the source of truth. */
	protected readonly canGroup = computed(() =>
		canGroupSelection(this.canEdit(), this.editor.selectedIds().length),
	);
	protected readonly canUngroup = computed(() =>
		canUngroupSelection(this.canEdit(), this.selectedElement()),
	);
	protected readonly canSetStroke = computed(() =>
		canSetStrokeWidth(this.canEdit(), this.selectedElement()),
	);
	protected readonly strokeWidth = computed(() => strokeWidthOf(this.selectedElement()));

	/** Write the typed outline width through the history-integrated patch path. */
	protected onStrokeWidth(event: Event): void {
		const element = this.selectedElement();
		if (!this.canSetStroke() || element === null || !hasShapeProperties(element)) {
			return;
		}
		const next = Number((event.target as HTMLInputElement).value);
		if (!Number.isFinite(next)) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), element.id, {
			shapeStyle: { ...element.shapeStyle, strokeWidth: Math.max(0, next) },
		} as Partial<PptxElement>);
	}
}

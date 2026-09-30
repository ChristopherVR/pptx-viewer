/**
 * ribbon-gallery.component.ts: `<pptx-ribbon-gallery>`, the Angular view of a
 * `pptx-viewer-shared` ribbon style gallery (Shape Styles, Shape Effects,
 * WordArt / Picture / Table / Chart / SmartArt Styles, Bullets, Numbering,
 * theme Colors / Fonts).
 *
 * Pure presentation: `buildRibbonGallery` decides every tile and
 * `applyRibbonGalleryItem` decides what a pick writes; this component maps
 * the descriptor onto markup and hands the result to
 * {@link dispatchGalleryResult}. Two modes (from the shared placement):
 * `dropdown` (one trigger button) and `inline` (a strip of the first tiles
 * plus a "more" button). The shared control owns positioning, keyboard focus,
 * outside-pointer dismissal and listener cleanup.
 *
 * DOM contract (identical in all five bindings; see `gallery-view.ts`): the
 * root wrapper carries `data-ribbon-control` when `control` is set, the trigger /
 * "more" button `data-ribbon-gallery`, the popup `data-ribbon-gallery-popup`,
 * every tile `data-gallery-item` + `aria-pressed`.
 */
import {
	ChangeDetectionStrategy,
	CUSTOM_ELEMENTS_SCHEMA,
	Component,
	computed,
	ElementRef,
	inject,
	Input,
	signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { applyRibbonGalleryItem, buildRibbonGallery, galleryHasItems } from '../internal/shared';
import type {
	RibbonGalleryDescriptor,
	RibbonGalleryId,
	RibbonGalleryItem,
	RibbonGalleryPickEvent,
	PptxUiRibbonGalleryElement,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { dispatchGalleryResult, galleryContextFor } from './ribbon-gallery-helpers';
import { ViewerThemeGalleryService } from './viewer-theme-gallery.service';

interface GalleryInputs {
	gallery: RibbonGalleryId;
	mode: 'inline' | 'dropdown';
	control: string | undefined;
	element: PptxElement | null;
	slideIndex: number;
	canEdit: boolean;
	chevronOnly: boolean;
}

const DEFAULT_INPUTS: GalleryInputs = {
	gallery: 'shapeStyles',
	mode: 'dropdown',
	control: undefined,
	element: null,
	slideIndex: 0,
	canEdit: true,
	chevronOnly: false,
};

type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

@Component({
	selector: 'pptx-ribbon-gallery',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-gallery
		[attr.data-ribbon-control]="control"
		[attr.mode]="mode"
		[attr.chevron-only]="chevronOnly ? '' : null"
		[descriptor]="descriptor()"
		[translateLabel]="translate"
		[disabled]="isDisabled()"
		(gallery-pick)="pickId($event)"
	/>`,
})
export class RibbonGalleryComponent {
	private readonly editor = inject(EditorStateService);
	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly themes = inject(ViewerThemeGalleryService, { optional: true });
	private readonly translateService = inject(TranslateService, { optional: true });
	protected readonly hostEl: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;

	/**
	 * Inputs are classic `@Input` accessors backed by ONE signal (not `input()`),
	 * so the gallery also binds when a parent is JIT-compiled (this package's
	 * TestBed suite has no signal-input transform) while every computed below
	 * still tracks them.
	 */
	private readonly inputs = signal<GalleryInputs>(DEFAULT_INPUTS);

	@Input({ required: true })
	get gallery(): RibbonGalleryId {
		return this.inputs().gallery;
	}
	set gallery(gallery: RibbonGalleryId) {
		this.inputs.update((s) => ({ ...s, gallery }));
	}
	@Input()
	get mode(): 'inline' | 'dropdown' {
		return this.inputs().mode;
	}
	set mode(mode: 'inline' | 'dropdown') {
		this.inputs.update((s) => ({ ...s, mode }));
	}
	/** Catalogue control id tagged on the root; omit when a wrapper carries it. */
	@Input()
	get control(): string | undefined {
		return this.inputs().control;
	}
	set control(control: string | undefined) {
		this.inputs.update((s) => ({ ...s, control }));
	}
	@Input()
	get element(): PptxElement | null {
		return this.inputs().element;
	}
	set element(element: PptxElement | null) {
		this.inputs.update((s) => ({ ...s, element }));
	}
	@Input()
	get slideIndex(): number {
		return this.inputs().slideIndex;
	}
	set slideIndex(slideIndex: number) {
		this.inputs.update((s) => ({ ...s, slideIndex }));
	}
	@Input()
	get canEdit(): boolean {
		return this.inputs().canEdit;
	}
	set canEdit(canEdit: boolean) {
		this.inputs.update((s) => ({ ...s, canEdit }));
	}
	/** Dropdown trigger shows only its chevron (the Bullets / Numbering split). */
	@Input()
	get chevronOnly(): boolean {
		return this.inputs().chevronOnly;
	}
	set chevronOnly(chevronOnly: boolean) {
		this.inputs.update((s) => ({ ...s, chevronOnly }));
	}

	readonly descriptor = computed<RibbonGalleryDescriptor>(() =>
		buildRibbonGallery(this.gallery, galleryContextFor(this.element, this.loader)),
	);
	readonly isDisabled = computed(
		() => !this.canEdit || this.descriptor().disabled || !galleryHasItems(this.descriptor()),
	);
	readonly translate: Translate = (key, params) =>
		this.translateService ? (this.translateService.instant(key, params) as string) : key;

	protected pickId(event: Event): void {
		const id = (event as RibbonGalleryPickEvent).detail.itemId;
		const item = this.descriptor()
			.sections.flatMap((section) => section.items)
			.find((entry) => entry.id === id);
		if (item) {
			this.pick(item);
		}
	}

	/** Apply `item` to the selection (or theme) and close the popup. */
	pick(item: RibbonGalleryItem): void {
		this.hostEl.querySelector<PptxUiRibbonGalleryElement>('pptx-ui-ribbon-gallery')?.close();
		if (this.isDisabled()) {
			return;
		}
		const ctx = galleryContextFor(this.element, this.loader);
		dispatchGalleryResult(applyRibbonGalleryItem(this.gallery, item.id, ctx), {
			editor: this.editor,
			slideIndex: this.slideIndex,
			themes: this.themes,
		});
	}
}

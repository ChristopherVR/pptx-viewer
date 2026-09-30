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
 * plus a "more" button). Both open the same popup, pinned with the ribbon's
 * `[pptxAnchoredPopup]`, closed by a pick, an outside pointerdown or Escape.
 *
 * DOM contract (identical in all five bindings; see `gallery-view.ts`): the
 * root wrapper carries `data-ribbon-control` when `control` is set, the trigger /
 * "more" button `data-ribbon-gallery`, the popup `data-ribbon-gallery-popup`,
 * every tile `data-gallery-item` + `aria-pressed`.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	ElementRef,
	inject,
	Input,
	signal,
} from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	applyRibbonGalleryItem,
	buildRibbonGallery,
	galleryHasItems,
	galleryItemLabel,
	inlineGalleryItems,
} from '../internal/shared';
import type {
	RibbonGalleryDescriptor,
	RibbonGalleryId,
	RibbonGalleryItem,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { dispatchGalleryResult, galleryContextFor } from './ribbon-gallery-helpers';
import { RibbonGalleryPopupComponent } from './ribbon-gallery-popup.component';
import { RibbonGallerySvgPipe } from './ribbon-gallery-svg.pipe';
import { RibbonIconDirective } from './ribbon-icon.directive';
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
	imports: [
		RibbonIconDirective,
		TranslatePipe,
		LucideChevronDown,
		RibbonGalleryPopupComponent,
		RibbonGallerySvgPipe,
	],
	templateUrl: './ribbon-gallery.component.html',
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

	private readonly openState = signal(false);
	/** Whether the popup is dropped down (read-only; see {@link setOpen}). */
	readonly open = this.openState.asReadonly();

	readonly descriptor = computed<RibbonGalleryDescriptor>(() =>
		buildRibbonGallery(this.gallery, galleryContextFor(this.element, this.loader)),
	);
	protected readonly stripItems = computed(() => inlineGalleryItems(this.descriptor()));
	readonly isDisabled = computed(
		() => !this.canEdit || this.descriptor().disabled || !galleryHasItems(this.descriptor()),
	);
	protected readonly title = computed(() =>
		this.translated(this.descriptor().labelKey, this.descriptor().label),
	);

	private readonly t: Translate = (key, params) =>
		this.translateService ? (this.translateService.instant(key, params) as string) : key;

	protected label(item: RibbonGalleryItem): string {
		return galleryItemLabel(item, this.t);
	}

	constructor() {
		inject(DestroyRef, { optional: true })?.onDestroy(() => this.setOpen(false));
	}

	toggle(): void {
		this.setOpen(!this.open() && !this.isDisabled());
	}

	/**
	 * Open or close the popup. While open, a pointerdown outside this gallery
	 * or Escape closes it (listeners are attached only while open, rather than
	 * through `host` metadata, which some Angular linkers drop).
	 */
	setOpen(next: boolean): void {
		if (next === this.openState()) {
			return;
		}
		this.openState.set(next);
		if (typeof document === 'undefined') {
			return;
		}
		if (next) {
			document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
			document.addEventListener('keydown', this.onDocumentKeyDown, true);
		} else {
			document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
			document.removeEventListener('keydown', this.onDocumentKeyDown, true);
		}
	}

	/** Apply `item` to the selection (or theme) and close the popup. */
	pick(item: RibbonGalleryItem): void {
		this.setOpen(false);
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

	private readonly onDocumentPointerDown = (event: Event): void => {
		if (!this.hostEl.contains(event.target as Node | null)) {
			this.setOpen(false);
		}
	};

	private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			this.setOpen(false);
		}
	};

	private translated(key: string, fallback: string): string {
		const out = this.t(key);
		return out && out !== key ? out : fallback;
	}
}

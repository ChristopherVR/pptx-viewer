/**
 * ribbon-home-section.component.ts: the Home ribbon tab (Clipboard, Slides, Font,
 * Paragraph and Editing groups). Slides is the shared
 * `pptx-ui-ribbon-home-slides` element (buttons and layout galleries); Font,
 * Paragraph and Editing are thin adapters around their shared elements.
 */
import {
	ApplicationRef,
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	EnvironmentInjector,
	inject,
	Injector,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxLayoutPreview } from 'pptx-viewer-core';

import type { RibbonHomePopupEvent, RibbonHomeRequestEvent } from '../internal/shared';
import { resetSlideLayoutPath, slidesHomeControls } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { RibbonClipboardGroupComponent } from './ribbon-clipboard-group.component';
import { RibbonEditingSectionComponent } from './ribbon-editing-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { homeLanguage, homeTranslator } from './ribbon-home-lang';
import { createLayoutArtwork } from './ribbon-layout-artwork';
import { layoutOptionsFrom } from './ribbon-layout-options';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';

/**
 * Home > Reset: re-apply the active slide's own layout, restoring inherited
 * placeholder geometry and formatting (React/Vue parity via the shared
 * `resetSlideLayoutPath` decision function). A no-op when the slide records
 * no layout. Exported as a pure dispatch function (rather than inlined in the
 * component) so it is directly testable without constructing the component,
 * whose constructor runs an `effect()` that needs a full Angular
 * `ChangeDetectionScheduler` this package's TestBed-free unit tests don't
 * provide (see `action-settings-panel.component.test.ts`).
 */
export function performResetSlide(
	editor: Pick<EditorStateService, 'slides' | 'applyLayout'>,
	slideIndex: number,
): void {
	const path = resetSlideLayoutPath(editor.slides()[slideIndex]);
	if (path) {
		void editor.applyLayout(slideIndex, path);
	}
}

@Component({
	selector: 'pptx-ribbon-home-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [
		TranslatePipe,
		RibbonFontControlsComponent,
		RibbonParagraphControlsComponent,
		RibbonEditingSectionComponent,
		RibbonClipboardGroupComponent,
	],
	templateUrl: './ribbon-home-section.component.html',
})
export class RibbonHomeSectionComponent {
	protected readonly editor = inject(EditorStateService);
	private readonly loader = inject(LoadContentService);

	/** Layouts offered by the New Slide split button and the Layout menu. */
	protected readonly layoutOptions = computed(() => layoutOptionsFrom(this.loader.slideMasters()));

	/** `layoutPath` of the active slide, marking the current gallery tile. */
	protected readonly currentLayoutPath = computed(
		() => this.editor.slides()[this.slideIndex()]?.layoutPath,
	);

	/**
	 * Layout artwork for the gallery thumbnails, keyed by layout path.
	 *
	 * Parsing every layout part is only worth doing once a gallery is opened,
	 * so this stays empty until the shared element reports a popup opening.
	 * Core memoises the parse, so reopening a menu costs nothing.
	 */
	protected readonly layoutPreviews = signal<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
	private readonly translation = inject(TranslateService, { optional: true });
	private readonly language = homeLanguage(this.translation);
	/** Draws each layout's artwork into the shared gallery's tiles. */
	protected readonly artwork = createLayoutArtwork(
		inject(ApplicationRef),
		inject(EnvironmentInjector),
		inject(Injector),
	);

	/**
	 * Shared Slides state. New Slide stays available without layouts (it adds a
	 * blank slide) and Reset/Section stay available on an empty deck, as before.
	 */
	protected slidesView() {
		return {
			controls: slidesHomeControls({
				editable: this.canEdit(),
				hasLayouts: this.layoutOptions().length > 0,
				hasSlides: this.editor.slides().length > 0,
				showTemplates: true,
				newSlideNeedsLayout: false,
				resetNeedsSlide: false,
				layouts: {
					layouts: this.layoutOptions(),
					current: this.currentLayoutPath(),
					previews: this.layoutPreviews(),
				},
			}),
			translate: homeTranslator(this.translation, this.language, ['slides']),
		};
	}

	protected onSlidesRequest(event: Event): void {
		const { id, value } = (event as RibbonHomeRequestEvent).detail;
		switch (id) {
			case 'home.slides.newSlide':
				this.editor.addSlide(this.slideIndex(), value === undefined ? undefined : String(value));
				break;
			case 'home.slides.layout':
				this.onApplyLayout(String(value));
				break;
			case 'home.slides.slideTemplates':
				this.openTemplateGallery.emit();
				break;
			case 'home.slides.reset':
				this.onResetSlide();
				break;
			case 'home.slides.section':
				this.editor.addSection(this.slideIndex());
		}
	}

	/** Load the layout artwork the first time a gallery opens. */
	protected onSlidesPopup(event: Event): void {
		const { open } = (event as RibbonHomePopupEvent).detail;
		const handler = this.loader.getHandler();
		if (!open || !handler || this.layoutPreviews().size > 0) {
			return;
		}
		void handler
			.getLayoutPreviews()
			.then((previews) => {
				this.layoutPreviews.set(new Map(previews.map((preview) => [preview.path, preview])));
				return undefined;
			})
			// A layout that will not parse costs the user a name-only tile,
			// not a broken menu.
			.catch(() => undefined);
	}

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);

	readonly toggleFormatPainter = output<void>();
	readonly findReplace = output<void>();
	/** "Slide Templates" in the Slides group; the host opens the gallery dialog. */
	readonly openTemplateGallery = output<void>();
	/** Emitted with the layout the user picked, after it has been applied. */
	readonly applyLayout = output<string>();
	/** Emitted after Home > Reset has re-applied the slide's layout. */
	readonly resetSlide = output<void>();

	/**
	 * Re-map the active slide onto `layoutPath`. The operation is self-contained,
	 * so the output is a notification rather than the thing that performs it.
	 */
	protected onApplyLayout(layoutPath: string): void {
		void this.editor.applyLayout(this.slideIndex(), layoutPath);
		this.applyLayout.emit(layoutPath);
	}

	/**
	 * The button used to `resetSlide.emit()` to nobody, so clicking it did
	 * nothing; {@link performResetSlide} now actually performs the reset.
	 */
	protected onResetSlide(): void {
		performResetSlide(this.editor, this.slideIndex());
		this.resetSlide.emit();
	}

	protected onSelectAll(): void {
		this.editor.selectAll(this.slideIndex());
	}
}

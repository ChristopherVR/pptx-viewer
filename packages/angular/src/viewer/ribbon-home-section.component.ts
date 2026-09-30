/**
 * ribbon-home-section.component.ts: the Home ribbon tab (Clipboard, Slides, Font
 * and Paragraph groups). Split out of {@link RibbonComponent}; behaviour and
 * markup are unchanged. Font/Paragraph controls are the shared
 * {@link RibbonFontControlsComponent} / {@link RibbonParagraphControlsComponent}.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import {
	LucideChevronDown,
	LucideFolderPlus,
	LucideLayoutGrid,
	LucideLayoutTemplate,
	LucidePlus,
	LucideRotateCcw,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxLayoutPreview } from 'pptx-viewer-core';

import { resetSlideLayoutPath } from '../internal/shared';
import { AnchoredPopupDirective } from './anchored-popup.directive';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { RibbonClipboardGroupComponent } from './ribbon-clipboard-group.component';
import { RibbonEditingSectionComponent } from './ribbon-editing-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { RibbonLayoutGalleryComponent } from './ribbon-layout-gallery.component';
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
	imports: [
		TranslatePipe,
		RibbonLayoutGalleryComponent,
		LucidePlus,
		LucideChevronDown,
		LucideFolderPlus,
		LucideLayoutGrid,
		LucideLayoutTemplate,
		LucideRotateCcw,
		RibbonFontControlsComponent,
		RibbonParagraphControlsComponent,
		RibbonEditingSectionComponent,
		RibbonClipboardGroupComponent,
		AnchoredPopupDirective,
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
	 * so this stays empty until {@link loadLayoutPreviews} runs. Core memoises
	 * the parse, so reopening a menu costs nothing.
	 */
	protected readonly layoutPreviews = signal<ReadonlyMap<string, PptxLayoutPreview>>(new Map());

	constructor() {
		// The menus open on hover with no event to hang a lazy load off, so the
		// fetch is kicked off once a deck is present. It is still deferred out of
		// the load pipeline, which is what the cost actually mattered for.
		effect(() => {
			const handler = this.loader.getHandler();
			if (!handler || this.layoutPreviews().size > 0) {
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
		});
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

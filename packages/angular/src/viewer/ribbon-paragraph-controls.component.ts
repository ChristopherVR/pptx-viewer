import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	input,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	elementBulletKind,
	getInlineEditorSelectionResult,
	homeGalleryApply,
	homeGalleryControls,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	selectionBulletKind,
	withHomeGalleries,
} from '../internal/shared';
import type { RibbonHomeRequestEvent } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
/**
 * ribbon-paragraph-controls.component.ts: the ribbon's reusable Paragraph
 * control group (bullets and numbering with their libraries, indent, alignment,
 * line spacing, text direction and columns), shared by the Home and Text tabs.
 * A thin adapter around `pptx-ui-ribbon-home-paragraph`: it reflects the
 * selection into the element and runs each typed intent through the editor.
 */
import { dispatchGalleryResult, galleryContextFor } from './ribbon-gallery-helpers';
import { homeLanguage, homeTranslator } from './ribbon-home-lang';
import { isTextElement, patchTextStyle, textStyleOf } from './ribbon-text-helpers';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerThemeGalleryService } from './viewer-theme-gallery.service';

@Component({
	selector: 'pptx-ribbon-paragraph-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-home-paragraph
		[state]="paragraphView()"
		(home-request)="paragraphRequest($event)"
	/>`,
})
export class RibbonParagraphControlsComponent {
	private readonly editor = inject(EditorStateService);
	private readonly inlineEditing = inject(ViewerCanvasEditingService, { optional: true });
	private readonly translation = inject(TranslateService, { optional: true });
	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly themes = inject(ViewerThemeGalleryService, { optional: true });
	private readonly language = homeLanguage(this.translation);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);

	protected isText(): boolean {
		return isTextElement(this.selectedElement());
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => textStyleOf(this.selectedElement()));
	protected readonly listKind = computed(() => {
		const element = this.selectedElement();
		return element ? elementBulletKind(element) : 'none';
	});

	/** Toggle the paragraph list style (bullet / numbered) off when already set. */
	protected toggleList(kind: 'bullet' | 'numbered'): void {
		if (!this.canEdit()) {
			return;
		}
		const element = this.selectedElement();
		if (!element || !hasTextProperties(element)) {
			return;
		}
		const result = getInlineEditorSelectionResult(element.textSegments, { preserveCaret: true });
		if (
			result.kind !== 'supported' ||
			(result.snapshot && result.snapshot.elementId !== element.id)
		) {
			return;
		}
		const current = selectionBulletKind(element, result.selection, result.snapshot?.textSegments);
		this.patch({ listType: current === kind ? 'none' : kind });
	}
	/** State for the shared Paragraph strip: lists, indent, alignment, spacing, direction, columns. */
	protected paragraphView() {
		const style = this.curStyle();
		const enabled = this.canEdit() && this.isText();
		const controls = paragraphHomeControls({
			enabled,
			align: paragraphHomeAlign(style?.align),
			list: this.listKind() as 'bullet' | 'numbered' | 'none',
			lineSpacing: style?.lineSpacing,
			columns: style?.columnCount,
			textDirection: style?.textDirection,
		});
		return {
			controls: withHomeGalleries(
				controls,
				homeGalleryControls('paragraph', this.galleryContext(), enabled),
				enabled,
			),
			translate: homeTranslator(this.translation, this.language, ['paragraph']),
		};
	}
	private galleryContext() {
		return galleryContextFor(this.selectedElement(), this.loader);
	}
	protected paragraphRequest(event: Event): void {
		const { id, value } = (event as RibbonHomeRequestEvent).detail;
		if (id === 'home.paragraph.bullets' || id === 'home.paragraph.numbering') {
			if (value === undefined) {
				this.toggleList(id === 'home.paragraph.bullets' ? 'bullet' : 'numbered');
			} else {
				dispatchGalleryResult(
					homeGalleryApply('paragraph', id, String(value), this.galleryContext()) ?? null,
					{ editor: this.editor, slideIndex: this.slideIndex(), themes: this.themes },
				);
			}
			return;
		}
		if (id === 'home.paragraph.lineSpacing') {
			this.patch({ lineSpacing: Number(value) });
			return;
		}
		if (id === 'home.paragraph.textDirection') {
			this.patch({ textDirection: String(value) as 'horizontal' });
			return;
		}
		if (id === 'home.paragraph.columns') {
			this.patch({ columnCount: Number(value) });
			return;
		}
		const action = paragraphHomeAction(id);
		if (action?.kind === 'indent') {
			this.changeIndent(action.delta);
		} else if (action?.kind === 'align') {
			this.setAlign(action.align);
		}
	}
	/** Step the paragraph left-indent by `deltaPx` (clamped at 0). */
	protected changeIndent(deltaPx: number): void {
		const current = this.curStyle()?.paragraphMarginLeft ?? 0;
		this.patch({ paragraphMarginLeft: Math.max(0, current + deltaPx) });
	}
	protected setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
		this.patch({ align });
	}
	private patch(patch: Parameters<typeof patchTextStyle>[3]): void {
		patchTextStyle(
			this.editor,
			this.slideIndex(),
			this.selectedElement(),
			patch,
			this.inlineEditing?.readInlineSnapshot(),
			(next) => this.inlineEditing?.formatInlineSnapshot(next) ?? false,
		);
	}
}

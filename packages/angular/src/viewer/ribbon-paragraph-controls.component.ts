import { NgClass } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	elementBulletKind,
	getInlineEditorSelectionResult,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	selectionBulletKind,
} from '../internal/shared';
import type { RibbonHomeRequestEvent } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { RibbonGalleryComponent } from './ribbon-gallery.component';
/**
 * ribbon-paragraph-controls.component.ts: the ribbon's reusable Paragraph control
 * group (bullet/numbered lists, indent/outdent, and alignment). Split out of
 * {@link RibbonComponent}'s `paragraphControls` ng-template so the Home and Text
 * tabs share one implementation. Behaviour and markup are unchanged.
 */
import { RibbonIconDirective } from './ribbon-icon.directive';
import { isTextElement, patchTextStyle, textStyleOf } from './ribbon-text-helpers';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';

/** Line spacing multiplier presets. */
const LINE_SPACING_OPTIONS = [1.0, 1.15, 1.5, 2.0, 2.5, 3.0];

/** Text direction presets (mirrors React/Vue). */
const TEXT_DIRECTION_OPTIONS = [
	{ labelKey: 'pptx.slideInspector.horizontal', value: 'horizontal' },
	{ labelKey: 'pptx.ribbon.textDirectionRotate90', value: 'vertical' },
	{ labelKey: 'pptx.ribbon.textDirectionRotate270', value: 'vertical270' },
	{ labelKey: 'pptx.ribbon.textDirectionStacked', value: 'wordArtVert' },
] as const;

/** Column count presets. */
const COLUMN_OPTIONS = [1, 2, 3];

@Component({
	selector: 'pptx-ribbon-paragraph-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [RibbonIconDirective, NgClass, TranslatePipe, RibbonGalleryComponent],
	templateUrl: './ribbon-paragraph-controls.component.html',
})
export class RibbonParagraphControlsComponent {
	private readonly editor = inject(EditorStateService);
	private readonly inlineEditing = inject(ViewerCanvasEditingService, { optional: true });
	private readonly translation = inject(TranslateService, { optional: true });

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);

	protected readonly lineSpacingOptions = LINE_SPACING_OPTIONS;
	protected readonly textDirectionOptions = TEXT_DIRECTION_OPTIONS;
	protected readonly columnOptions = COLUMN_OPTIONS;

	protected isText(): boolean {
		return isTextElement(this.selectedElement());
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => textStyleOf(this.selectedElement()));
	protected readonly listKind = computed(() => {
		const element = this.selectedElement();
		return element ? elementBulletKind(element) : 'none';
	});

	/** Current line spacing multiplier. */
	protected curLineSpacing(): number {
		return this.curStyle()?.lineSpacing ?? 1.0;
	}
	/** Current text direction. */
	protected curTextDirection(): string {
		return this.curStyle()?.textDirection ?? 'horizontal';
	}
	/** Current column count. */
	protected curColumns(): number {
		return this.curStyle()?.columnCount ?? 1;
	}

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
	/** State for the shared indent and alignment strip. */
	protected paragraphView() {
		return {
			controls: paragraphHomeControls({
				enabled: this.canEdit() && this.isText(),
				align: paragraphHomeAlign(this.curStyle()?.align),
			}),
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}
	protected paragraphRequest(event: Event): void {
		const action = paragraphHomeAction((event as RibbonHomeRequestEvent).detail.id);
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
	protected setLineSpacing(event: Event): void {
		this.patch({ lineSpacing: Number((event.target as HTMLSelectElement).value) });
	}
	protected setTextDirection(event: Event): void {
		this.patch({ textDirection: (event.target as HTMLSelectElement).value as 'horizontal' });
	}
	protected setColumns(event: Event): void {
		this.patch({ columnCount: Number((event.target as HTMLSelectElement).value) });
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

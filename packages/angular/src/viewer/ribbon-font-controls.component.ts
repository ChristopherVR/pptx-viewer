import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxThemeColorRef } from 'pptx-viewer-core';

import type { RibbonHomeRequestEvent } from '../internal/shared';
import {
	COMMON_FONT_SIZES,
	fontHomeControls,
	fontPickerHomeControls,
	stepFontSizePt,
	textFontSizePatch,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from '../internal/shared';
import { resolveDefaultFontFamily } from '../internal/shared-src/render/font-catalog';
import type { ChangeCaseMode } from '../internal/shared-src/render/text-case-transform';
import { CustomFontsService } from './custom-fonts.service';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { RecentColorsService } from './recent-colors.service';
import { fontHomeAction } from './ribbon-font-home';
import { homeLanguage, homeTranslator } from './ribbon-home-lang';
/**
 * ribbon-font-controls.component.ts: the ribbon's reusable Font control group,
 * shared by the Home and Text tabs. A thin adapter: the family/size fields are
 * `pptx-ui-ribbon-home-font-picker`, and the character strip, spacing, case,
 * font colour and highlight are `pptx-ui-ribbon-home-font`. This component
 * reflects the selection into them and runs each typed intent through the
 * editor's undoable patch path.
 */
import {
	isTextElement,
	patchTextStyle,
	textStyleOf,
	transformSelectedTextCase,
} from './ribbon-text-helpers';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';

/**
 * The Home/Text tab's size dropdown + grow/shrink ladder. Sourced from shared
 * so it cannot drift from the other bindings' Font control group.
 */
export const FONT_SIZES = COMMON_FONT_SIZES;

/**
 * Next PowerPoint point-size preset in the requested direction.
 *
 * Thin wrapper over shared's `stepFontSizePt`, which now owns the ladder-step
 * logic (Ctrl+Shift+>/< and Ctrl+]/[ need the identical behaviour in every
 * binding); kept under this name/signature so the ribbon's existing callers
 * are unaffected.
 */
export function steppedFontSizePt(current: number, direction: 1 | -1): number {
	return stepFontSizePt(current, direction === 1 ? 'increase' : 'decrease');
}
@Component({
	selector: 'pptx-ribbon-font-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [TranslatePipe],
	templateUrl: './ribbon-font-controls.component.html',
})
export class RibbonFontControlsComponent {
	private readonly editor = inject(EditorStateService);
	private readonly inlineEditing = inject(ViewerCanvasEditingService, { optional: true });
	private readonly translation = inject(TranslateService, { optional: true });

	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly selectedElement = input<PptxElement | null>(null);

	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly customFonts = inject(CustomFontsService, { optional: true });
	private readonly recentColors = inject(RecentColorsService, { optional: true });
	private readonly language = homeLanguage(this.translation);

	/**
	 * Theme major/minor latin faces. Read from DI rather than taken as inputs
	 * because this component renders in two different ribbon hosts, and both
	 * would otherwise have to thread the same three values down.
	 */
	protected readonly themeFonts = computed(() => ({
		heading: this.loader?.theme()?.fontScheme?.majorFont?.latin,
		body: this.loader?.theme()?.fontScheme?.minorFont?.latin,
	}));

	protected isText(): boolean {
		return isTextElement(this.selectedElement());
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => textStyleOf(this.selectedElement()));

	protected curFontFamily(): string {
		return (
			this.curStyle()?.fontFamily ??
			resolveDefaultFontFamily(
				(this.selectedElement() as { placeholderType?: string } | null)?.placeholderType,
				this.themeFonts(),
			)
		);
	}
	protected curFontSize(): number {
		// Mirror React's HomeSection default (24) shown when nothing is selected.
		const fontSize = this.curStyle()?.fontSize;
		return fontSize === undefined ? 24 : textFontSizePxToPt(fontSize);
	}
	/** Current font colour of the selection (for the swatch + active-state ring). */
	protected curColor(): string {
		return this.curStyle()?.color ?? '#000000';
	}
	/** Current font colour's theme ref, if any (highlights the matching theme swatch). */
	protected curColorRef(): PptxThemeColorRef | undefined {
		return this.curStyle()?.colorRef;
	}
	/** Current highlight colour of the selection (for the swatch + active-state ring). */
	protected curHighlight(): string {
		return this.curStyle()?.highlightColor ?? '#ffff00';
	}
	/** Current character spacing of the selection (for dropdown state). */
	protected curCharSpacing(): number {
		return this.curStyle()?.characterSpacing ?? 0;
	}

	/** State for the shared character strip, spacing, case and colour controls. */
	protected fontView() {
		const style = this.curStyle();
		const translate = homeTranslator(this.translation, this.language, ['font']);
		return {
			controls: fontHomeControls({
				enabled: this.enabled(),
				bold: Boolean(style?.bold),
				italic: Boolean(style?.italic),
				underline: Boolean(style?.underline),
				strikethrough: Boolean(style?.strikethrough),
				shadow: Boolean(style?.textShadowColor),
				characterSpacing: this.curCharSpacing(),
				fontColor: {
					value: this.curColor(),
					ref: this.curColorRef(),
					themeColors: this.loader?.themeColorMap(),
					recent: this.recentColors?.recent(),
				},
				highlight: { value: this.curHighlight(), recent: this.recentColors?.recent() },
			}),
			translate,
		};
	}

	/** Font family and size fields. */
	protected pickerView() {
		const translate = homeTranslator(this.translation, this.language, ['font-picker']);
		return {
			controls: fontPickerHomeControls(
				{
					enabled: this.enabled(),
					fontFamily: this.curFontFamily(),
					fontSize: this.curFontSize(),
					themeFonts: this.themeFonts(),
					embeddedFonts: (this.loader?.embeddedFonts() ?? []).map((font) => font.name),
					customFonts: this.customFonts?.registeredFamilies() ?? [],
				},
				translate,
			),
			translate,
		};
	}

	private enabled(): boolean {
		return this.canEdit() && this.isText();
	}

	protected pickerRequest(event: Event): void {
		const { id, value } = (event as RibbonHomeRequestEvent).detail;
		if (id === 'home.font.fontFamily') {
			this.patch({ fontFamily: String(value) });
		} else if (id === 'home.font.fontSize') {
			this.patchFontSize(textFontSizePtToPx(Number(value)));
		}
	}

	protected fontRequest(event: Event): void {
		const { id, value, ref } = (event as RibbonHomeRequestEvent).detail;
		const action = fontHomeAction(id);
		if (action?.kind === 'toggle') {
			this.toggleStyle(action.flag);
		} else if (action?.kind === 'shadow') {
			this.toggleShadow();
		} else if (action?.kind === 'step') {
			this.stepFontSize(action.direction);
		} else if (action?.kind === 'clear') {
			this.clearFormatting();
		} else if (id === 'home.font.characterSpacing') {
			this.patch({ characterSpacing: Number(value) });
		} else if (id === 'home.font.changeCase') {
			this.changeCase(value as ChangeCaseMode);
		} else if (id === 'home.font.fontColor') {
			this.patch({ color: String(value), colorRef: ref });
			this.recentColors?.push(String(value));
		} else if (id === 'home.font.highlightColor') {
			this.patch({ highlightColor: String(value) });
			this.recentColors?.push(String(value));
		}
	}

	protected toggleShadow(): void {
		const has = Boolean(this.curStyle()?.textShadowColor);
		this.patch(
			has
				? {
						textShadowColor: undefined,
						textShadowBlur: undefined,
						textShadowOffsetX: undefined,
						textShadowOffsetY: undefined,
					}
				: {
						textShadowColor: '#000000',
						textShadowBlur: 4,
						textShadowOffsetX: 1,
						textShadowOffsetY: 1,
						textShadowOpacity: 0.5,
					},
		);
	}
	private changeCase(mode: ChangeCaseMode): void {
		transformSelectedTextCase(
			this.editor,
			this.slideIndex(),
			this.selectedElement(),
			mode,
			this.inlineEditing?.readInlineSnapshot(),
			() => this.inlineEditing?.endInlineListSession(),
		);
	}

	protected toggleStyle(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
		this.patch({ [key]: !this.curStyle()?.[key] });
	}
	/** Step the selection's font size up or down through the FONT_SIZES ladder. */
	protected stepFontSize(direction: 1 | -1): void {
		this.patchFontSize(textFontSizePtToPx(steppedFontSizePt(this.curFontSize(), direction)));
	}
	private patchFontSize(fontSize: number): void {
		const element = this.selectedElement();
		if (!element || !isTextElement(element)) {
			return;
		}
		const snapshot = this.inlineEditing?.readInlineSnapshot();
		if (snapshot?.elementId === element.id && snapshot.textSegments) {
			this.patch({ fontSize });
			return;
		}
		this.editor.updateElement(this.slideIndex(), element.id, textFontSizePatch(element, fontSize));
	}
	/** Clear character formatting (bold/italic/underline/strikethrough) on the selection. */
	protected clearFormatting(): void {
		this.patch({ bold: false, italic: false, underline: false, strikethrough: false });
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

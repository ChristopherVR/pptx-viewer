/**
 * ribbon-font-controls.component.ts: the ribbon's reusable Font control group
 * (family/size dropdowns, grow/shrink, clear-formatting, bold/italic/underline/
 * strikethrough and the font-colour + highlight popovers). Split out of
 * {@link RibbonComponent}'s `fontControls` ng-template so the Home and Text tabs
 * share one implementation. Behaviour and markup are unchanged.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
	LucideAArrowDown,
	LucideAArrowUp,
	LucideHighlighter,
	LucideRemoveFormatting,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxThemeColorRef } from 'pptx-viewer-core';

import type { ThemeColorPickerCommit } from '../internal/shared';
import {
	COMMON_FONT_SIZES,
	OFFICE_COLOR_SWATCH_HEXES,
	textFontSizePatch,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from '../internal/shared';
import {
	buildFontCatalog,
	resolveDefaultFontFamily,
} from '../internal/shared-src/render/font-catalog';
import type { ChangeCaseMode } from '../internal/shared-src/render/text-case-transform';
import { CustomFontsService } from './custom-fonts.service';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { RibbonColorPopoverComponent } from './ribbon-color-popover.component';
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

/** Next PowerPoint point-size preset in the requested direction. */
export function steppedFontSizePt(current: number, direction: 1 | -1): number {
	const next =
		direction === 1
			? FONT_SIZES.find((size) => size > current)
			: [...FONT_SIZES].reverse().find((size) => size < current);
	return next ?? (direction === 1 ? FONT_SIZES[FONT_SIZES.length - 1] : FONT_SIZES[0]) ?? current;
}
/** Font-colour swatches in the Home/Text colour popover (mirrors React/Vue). */
const FONT_COLOR_PRESETS = OFFICE_COLOR_SWATCH_HEXES;

/** Text-highlight swatches in the Home/Text highlight popover (mirrors React/Vue). */
const HIGHLIGHT_COLOR_PRESETS = [
	'#ffff00',
	'#00ff00',
	'#00ffff',
	'#ff00ff',
	'#0000ff',
	'#ff0000',
	'#000080',
	'#008080',
	'#008000',
	'#800080',
];

/** Character spacing presets (hundredths of a point, per OOXML `a:rPr/@spc`). */
const CHAR_SPACING_OPTIONS = [
	{ labelKey: 'pptx.text.characterSpacingVeryTight', value: -300 },
	{ labelKey: 'pptx.text.characterSpacingTight', value: -150 },
	{ labelKey: 'pptx.text.characterSpacingNormal', value: 0 },
	{ labelKey: 'pptx.text.characterSpacingLoose', value: 300 },
	{ labelKey: 'pptx.text.characterSpacingVeryLoose', value: 600 },
];

/** Change Case options matching PowerPoint's Aa dropdown. */
const CHANGE_CASE_OPTIONS = [
	{ labelKey: 'pptx.text.changeCaseSentence', value: 'sentence' },
	{ labelKey: 'pptx.text.changeCaseLower', value: 'lower' },
	{ labelKey: 'pptx.text.changeCaseUpper', value: 'upper' },
	{ labelKey: 'pptx.text.changeCaseCapitalize', value: 'capitalize' },
	{ labelKey: 'pptx.text.changeCaseToggle', value: 'toggle' },
];

@Component({
	selector: 'pptx-ribbon-font-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		NgClass,
		TranslatePipe,
		RibbonColorPopoverComponent,
		LucideAArrowUp,
		LucideAArrowDown,
		LucideRemoveFormatting,
		LucideHighlighter,
	],
	templateUrl: './ribbon-font-controls.component.html',
})
export class RibbonFontControlsComponent {
	private readonly editor = inject(EditorStateService);
	private readonly inlineEditing = inject(ViewerCanvasEditingService, { optional: true });

	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly selectedElement = input<PptxElement | null>(null);

	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly customFonts = inject(CustomFontsService, { optional: true });

	/**
	 * Theme major/minor latin faces. Read from DI rather than taken as inputs
	 * because this component renders in two different ribbon hosts, and both
	 * would otherwise have to thread the same three values down.
	 */
	protected readonly themeFonts = computed(() => ({
		heading: this.loader?.theme()?.fontScheme?.majorFont?.latin,
		body: this.loader?.theme()?.fontScheme?.minorFont?.latin,
	}));

	/**
	 * The dropdown's contents, grouped the way PowerPoint groups them.
	 *
	 * This component used to carry its own eight-entry family list, so Angular
	 * offered a different set of fonts from the other four bindings. The
	 * grouping and de-duplication now come from `pptx-viewer-shared`.
	 */
	protected readonly fontGroups = computed(() =>
		buildFontCatalog({
			themeFonts: this.themeFonts(),
			embeddedFonts: (this.loader?.embeddedFonts() ?? []).map((font) => font.name),
			customFonts: this.customFonts?.registeredFamilies() ?? [],
		}),
	);
	protected readonly fontSizes = FONT_SIZES;
	protected readonly fontColorPresets = FONT_COLOR_PRESETS;
	protected readonly highlightColorPresets = HIGHLIGHT_COLOR_PRESETS;
	protected readonly charSpacingOptions = CHAR_SPACING_OPTIONS;
	protected readonly changeCaseOptions = CHANGE_CASE_OPTIONS;

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
	protected setCharSpacing(event: Event): void {
		this.patch({ characterSpacing: Number((event.target as HTMLSelectElement).value) });
	}

	protected setChangeCase(event: Event): void {
		const value = (event.target as HTMLSelectElement).value as ChangeCaseMode;
		transformSelectedTextCase(
			this.editor,
			this.slideIndex(),
			this.selectedElement(),
			value,
			this.inlineEditing?.readInlineSnapshot(),
			() => this.inlineEditing?.endInlineListSession(),
		);
		(event.target as HTMLSelectElement).selectedIndex = 0;
	}

	protected toggleStyle(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
		this.patch({ [key]: !this.curStyle()?.[key] });
	}
	/** Preset/recent/custom pick: always clears any previously-stored theme ref. */
	protected setColor(color: string): void {
		this.patch({ color, colorRef: undefined });
	}
	/** Theme-swatch pick: commits BOTH the resolved hex and the ref. */
	protected setColorRef(commit: ThemeColorPickerCommit): void {
		this.patch({ color: commit.hex, colorRef: commit.ref });
	}
	protected setHighlight(highlightColor: string): void {
		this.patch({ highlightColor });
	}
	protected setFontFamily(event: Event): void {
		this.patch({ fontFamily: (event.target as HTMLSelectElement).value });
	}
	protected setFontSize(event: Event): void {
		this.patchFontSize(textFontSizePtToPx(Number((event.target as HTMLSelectElement).value)));
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

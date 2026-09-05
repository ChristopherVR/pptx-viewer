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
	template: `
		<div class="flex items-center gap-1">
			<select
				class="pptx-rb-select w-28"
				[attr.aria-label]="'pptx.ribbon.fontFamily' | translate"
				(change)="setFontFamily($event)"
			>
				@for (group of fontGroups(); track group.id) {
					<optgroup [label]="group.labelKey | translate">
						@for (entry of group.entries; track entry.family) {
							<option
								[value]="entry.family"
								[selected]="entry.family === curFontFamily()"
								[style.font-family]="entry.family"
							>
								{{ entry.family
								}}{{
									entry.themeRole
										? ' (' + ('pptx.font.role.' + entry.themeRole | translate) + ')'
										: ''
								}}
							</option>
						}
					</optgroup>
				}
			</select>
			<select
				class="pptx-rb-select w-14"
				[attr.aria-label]="'pptx.ribbon.fontSize' | translate"
				(change)="setFontSize($event)"
			>
				@if (!fontSizes.includes(curFontSize())) {
					<option [value]="curFontSize()" selected>{{ curFontSize() }}</option>
				}
				@for (s of fontSizes; track s) {
					<option [value]="s" [selected]="s === curFontSize()">{{ s }}</option>
				}
			</select>
		</div>
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[title]="'pptx.text.increaseFontSize' | translate"
				[attr.aria-label]="'pptx.text.increaseFontSize' | translate"
				(click)="stepFontSize(1)"
			>
				<svg lucideAArrowUp class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[title]="'pptx.text.decreaseFontSize' | translate"
				[attr.aria-label]="'pptx.text.decreaseFontSize' | translate"
				(click)="stepFontSize(-1)"
			>
				<svg lucideAArrowDown class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!isText()"
				[title]="'pptx.ribbon.clearFormatting' | translate"
				(click)="clearFormatting()"
			>
				<svg lucideRemoveFormatting class="h-4 w-4"></svg>
			</button>
		</div>
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb font-bold"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.bold ? 'bg-accent' : ''"
				[title]="'pptx.notes.bold' | translate"
				[attr.aria-label]="'pptx.notes.bold' | translate"
				(click)="toggleStyle('bold')"
			>
				B
			</button>
			<button
				type="button"
				class="pptx-rb-gb italic"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.italic ? 'bg-accent' : ''"
				[title]="'pptx.notes.italic' | translate"
				[attr.aria-label]="'pptx.notes.italic' | translate"
				(click)="toggleStyle('italic')"
			>
				I
			</button>
			<button
				type="button"
				class="pptx-rb-gb underline"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.underline ? 'bg-accent' : ''"
				[title]="'pptx.notes.underline' | translate"
				[attr.aria-label]="'pptx.notes.underline' | translate"
				(click)="toggleStyle('underline')"
			>
				U
			</button>
			<button
				type="button"
				class="pptx-rb-gl line-through"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.strikethrough ? 'bg-accent' : ''"
				[title]="'pptx.notes.strikethrough' | translate"
				[attr.aria-label]="'pptx.notes.strikethrough' | translate"
				(click)="toggleStyle('strikethrough')"
			>
				S
			</button>
		</div>
		<!-- Text Shadow toggle (icon-only "S" shadow glyph, React TextSection parity). -->
		<button
			type="button"
			class="pptx-rb-gb"
			[disabled]="!isText()"
			[ngClass]="curStyle()?.textShadowColor ? 'bg-accent' : ''"
			[title]="'pptx.textEffects.shadow' | translate"
			[attr.aria-label]="'pptx.textEffects.shadow' | translate"
			(click)="toggleShadow()"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<text x="6" y="17" font-size="16" font-weight="bold" fill="currentColor" stroke="none">
					S
				</text>
				<text
					x="7.5"
					y="18.5"
					font-size="16"
					font-weight="bold"
					fill="none"
					stroke="currentColor"
					stroke-width="0.5"
					opacity="0.4"
				>
					S
				</text>
			</svg>
		</button>
		<!-- Character Spacing -->
		<select
			class="pptx-rb-select w-20"
			[attr.aria-label]="'pptx.text.characterSpacing' | translate"
			[disabled]="!isText()"
			(change)="setCharSpacing($event)"
		>
			@for (opt of charSpacingOptions; track opt.value) {
				<option [value]="opt.value" [selected]="opt.value === curCharSpacing()">
					{{ opt.labelKey | translate }}
				</option>
			}
		</select>
		<!-- Change Case -->
		<select
			class="pptx-rb-select w-24"
			[attr.aria-label]="'pptx.text.changeCase' | translate"
			[disabled]="!isText()"
			(change)="setChangeCase($event)"
		>
			<option value="" selected disabled>Aa</option>
			@for (opt of changeCaseOptions; track opt.value) {
				<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
			}
		</select>
		<!-- Font colour popover -->
		<pptx-ribbon-color-popover
			[current]="curColor()"
			[currentRef]="curColorRef()"
			[showThemeColors]="true"
			[presets]="fontColorPresets"
			[disabled]="!isText()"
			titleKey="pptx.text.fontColor"
			swatchAriaKey="pptx.ribbon.fontColourValue"
			(pick)="setColor($event)"
			(pickThemeColor)="setColorRef($event)"
		>
			<svg
				class="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M6 20h12M9.5 4h5L18 16H6L9.5 4z" />
			</svg>
		</pptx-ribbon-color-popover>
		<!-- Text highlight popover -->
		<pptx-ribbon-color-popover
			[current]="curHighlight()"
			[presets]="highlightColorPresets"
			[disabled]="!isText()"
			titleKey="pptx.text.highlightColor"
			swatchAriaKey="pptx.ribbon.highlightColourValue"
			(pick)="setHighlight($event)"
		>
			<svg lucideHighlighter class="h-3.5 w-3.5"></svg>
		</pptx-ribbon-color-popover>
	`,
})
export class RibbonFontControlsComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
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
		transformSelectedTextCase(this.editor, this.slideIndex(), this.selectedElement(), value);
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
		this.editor.updateElement(this.slideIndex(), element.id, textFontSizePatch(element, fontSize));
	}
	/** Clear character formatting (bold/italic/underline/strikethrough) on the selection. */
	protected clearFormatting(): void {
		this.patch({ bold: false, italic: false, underline: false, strikethrough: false });
	}

	private patch(patch: Parameters<typeof patchTextStyle>[3]): void {
		patchTextStyle(this.editor, this.slideIndex(), this.selectedElement(), patch);
	}
}

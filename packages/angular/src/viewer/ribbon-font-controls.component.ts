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
import type { PptxElement } from 'pptx-viewer-core';

import type { ChangeCaseMode } from '../internal/shared-src/render/text-case-transform';
import { EditorStateService } from './editor-state.service';
import { RibbonColorPopoverComponent } from './ribbon-color-popover.component';
import {
	isTextElement,
	patchTextStyle,
	textStyleOf,
	transformSelectedTextCase,
} from './ribbon-text-helpers';

/** Font families offered in the Home tab (mirrors React). */
const FONT_FAMILIES = [
	'Segoe UI',
	'Arial',
	'Calibri',
	'Times New Roman',
	'Georgia',
	'Courier New',
	'Verdana',
	'Tahoma',
];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 66, 80, 96];
/** Font-colour swatches in the Home/Text colour popover (mirrors React/Vue). */
const FONT_COLOR_PRESETS = [
	'#000000',
	'#ffffff',
	'#ff0000',
	'#00aa00',
	'#0000ff',
	'#ff8800',
	'#8800cc',
	'#00cccc',
	'#ff69b4',
	'#808080',
];

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
				[disabled]="!isText()"
				(change)="setFontFamily($event)"
			>
				@for (f of fontFamilies; track f) {
					<option [value]="f" [selected]="f === curFontFamily()">{{ f }}</option>
				}
			</select>
			<select
				class="pptx-rb-select w-14"
				[attr.aria-label]="'pptx.ribbon.fontSize' | translate"
				[disabled]="!isText()"
				(change)="setFontSize($event)"
			>
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
				[title]="'pptx.ribbon.growFont' | translate"
				(click)="stepFontSize(1)"
			>
				<svg lucideAArrowUp class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[title]="'pptx.ribbon.shrinkFont' | translate"
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
				(click)="toggleStyle('strikethrough')"
			>
				S
			</button>
		</div>
		<!-- Text Shadow toggle -->
		<button
			type="button"
			class="pptx-rb-gb whitespace-nowrap"
			[disabled]="!isText()"
			[ngClass]="curStyle()?.textShadowColor ? 'bg-accent' : ''"
			[title]="'pptx.textEffects.shadow' | translate"
			(click)="toggleShadow()"
		>
			{{ 'pptx.textEffects.shadow' | translate }}
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
			[presets]="fontColorPresets"
			[disabled]="!isText()"
			titleKey="pptx.ribbon.fontColour"
			swatchAriaKey="pptx.ribbon.fontColourValue"
			(pick)="setColor($event)"
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
			titleKey="pptx.ribbon.textHighlightColour"
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

	protected readonly fontFamilies = FONT_FAMILIES;
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
		return this.curStyle()?.fontFamily ?? 'Segoe UI';
	}
	protected curFontSize(): number {
		return Math.round(this.curStyle()?.fontSize ?? 18);
	}
	/** Current font colour of the selection (for the swatch + active-state ring). */
	protected curColor(): string {
		return this.curStyle()?.color ?? '#000000';
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
	protected setColor(color: string): void {
		this.patch({ color });
	}
	protected setHighlight(highlightColor: string): void {
		this.patch({ highlightColor });
	}
	protected setFontFamily(event: Event): void {
		this.patch({ fontFamily: (event.target as HTMLSelectElement).value });
	}
	protected setFontSize(event: Event): void {
		this.patch({ fontSize: Number((event.target as HTMLSelectElement).value) });
	}
	/** Step the selection's font size up or down through the FONT_SIZES ladder. */
	protected stepFontSize(direction: 1 | -1): void {
		const current = this.curFontSize();
		const sizes = FONT_SIZES;
		let idx = sizes.findIndex((s) => s >= current);
		if (idx < 0) {
			idx = sizes.length - 1;
		}
		const next = sizes[Math.min(sizes.length - 1, Math.max(0, idx + direction))];
		if (next !== undefined) {
			this.patch({ fontSize: next });
		}
	}
	/** Clear character formatting (bold/italic/underline/strikethrough) on the selection. */
	protected clearFormatting(): void {
		this.patch({ bold: false, italic: false, underline: false, strikethrough: false });
	}

	private patch(patch: Parameters<typeof patchTextStyle>[3]): void {
		patchTextStyle(this.editor, this.slideIndex(), this.selectedElement(), patch);
	}
}

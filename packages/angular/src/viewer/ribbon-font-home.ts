/**
 * ribbon-font-home.ts: the Font group's shared character-format strip
 * (`pptx-ui-ribbon-home-font`). Pure helpers: the state reflected into the
 * element and the decoding of its one intent into the edit this binding runs.
 */
import type { RibbonControlId } from '../internal/shared';
import { fontHomeControls } from '../internal/shared';

type FontStyleFlags = {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	textShadowColor?: string;
} | null;

export type FontHomeAction =
	| { kind: 'toggle'; flag: 'bold' | 'italic' | 'underline' | 'strikethrough' }
	| { kind: 'shadow' }
	| { kind: 'step'; direction: 1 | -1 }
	| { kind: 'clear' };

export function fontHomeState(
	style: FontStyleFlags,
	enabled: boolean,
	translate: (key: string) => string,
) {
	return {
		controls: fontHomeControls({
			enabled,
			bold: Boolean(style?.bold),
			italic: Boolean(style?.italic),
			underline: Boolean(style?.underline),
			strikethrough: Boolean(style?.strikethrough),
			shadow: Boolean(style?.textShadowColor),
		}),
		translate,
	};
}

export function fontHomeAction(id: RibbonControlId): FontHomeAction | undefined {
	switch (id) {
		case 'home.font.bold':
			return { kind: 'toggle', flag: 'bold' };
		case 'home.font.italic':
			return { kind: 'toggle', flag: 'italic' };
		case 'home.font.underline':
			return { kind: 'toggle', flag: 'underline' };
		case 'home.font.strikethrough':
			return { kind: 'toggle', flag: 'strikethrough' };
		case 'home.font.shadow':
			return { kind: 'shadow' };
		case 'home.font.increaseFontSize':
			return { kind: 'step', direction: 1 };
		case 'home.font.decreaseFontSize':
			return { kind: 'step', direction: -1 };
		case 'home.font.clearFormatting':
			return { kind: 'clear' };
		default:
			return undefined;
	}
}

/**
 * The ribbon's accessible names are a cross-binding contract, so pin them.
 *
 * Every product spec in `e2e/` addresses ribbon controls by accessible name,
 * and `e2e/ribbon-control-inventory.spec.ts` diffs the whole set against the
 * reference binding. That check needs five demo servers and a browser, which
 * makes it a slow way to learn that someone swapped a translation key and
 * turned "Increase Font Size" back into "Grow font".
 *
 * This suite is the cheap half of the same guard. It asserts the English text
 * each ribbon control resolves to, through the exact fallback chain the
 * Angular host uses: an entry in the shared dictionary if there is one, and
 * `keyToLabel` (the demo's `MissingTranslationHandler`) if there is not. It
 * cannot see the templates (this package's suite is deliberately TestBed-free,
 * so DOM wiring stays e2e's job), so it guards the labels the templates name,
 * not the markup around them.
 */
import { describe, expect, it } from 'vitest';

import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from '../internal/shared-src/render/animation-authoring';
import { ANIMATION_PRESET_CATEGORIES } from './ribbon-animation-gallery.component';

/** The label a ribbon control renders, resolved the way the Angular host does. */
function label(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

/**
 * Control label key -> the English wording it must produce.
 *
 * Taken from the reference binding tab by tab. A key whose wording drifts from
 * the value here is a control a user (or a spec) can no longer find by name.
 */
const RIBBON_LABELS: ReadonlyArray<readonly [key: string, english: string]> = [
	// Home: font formatting. These used to render as bare glyphs ("B", "I") or
	// abbreviations ("Grow font"), which no assistive technology can resolve.
	['pptx.notes.bold', 'Bold'],
	['pptx.notes.italic', 'Italic'],
	['pptx.notes.underline', 'Underline'],
	['pptx.notes.strikethrough', 'Strikethrough'],
	['pptx.text.increaseFontSize', 'Increase Font Size'],
	['pptx.text.decreaseFontSize', 'Decrease Font Size'],
	['pptx.text.fontColor', 'Font Color'],
	['pptx.text.highlightColor', 'Text Highlight Color'],
	// Home: arrange + editing.
	['pptx.arrange.format', 'Format'],
	['pptx.arrange.bringForward', 'Bring forward'],
	['pptx.arrange.sendBackward', 'Send backward'],
	['pptx.arrange.distributeHorizontal', 'Distribute horizontal'],
	['pptx.arrange.distributeVertical', 'Distribute vertical'],
	['pptx.ribbon.tool.select', 'Select'],
	// Home: the Arrange group's shape extras.
	['pptx.contextMenu.group', 'Group'],
	['pptx.contextMenu.ungroup', 'Ungroup'],
	['pptx.ribbon.strokeWidth', 'Stroke width'],
	// Insert.
	['pptx.insert.shapeType', 'Shape type'],
	['pptx.insert.shape', 'Shape'],
	['pptx.hyperlinkDialog.title', 'Hyperlink'],
	['pptx.headerFooter.title', 'Header & Footer'],
	// Animations.
	['pptx.animations.exitEffects', 'Exit Effects'],
	['pptx.animations.pathAnimation', 'Path Animation'],
	['pptx.animations.effectOptions', 'Effect Options'],
	['pptx.animations.trigger', 'Trigger'],
	['pptx.animations.painter', 'Animation Painter'],
	['pptx.animations.remove', 'Remove'],
	['pptx.animations.start', 'Start'],
	// Slide Show.
	['pptx.slideShow.customShow', 'Custom show'],
	['pptx.slideShow.setUp', 'Set Up Slide Show'],
	['pptx.slideShow.rehearseCoach', 'Rehearse with Coach'],
	['pptx.slideShow.hideSlide', 'Hide Slide'],
	['pptx.slideShow.keepUpdated', 'Keep Slides Updated'],
	['pptx.slideShow.useTimings', 'Using timings, if present'],
	['pptx.slideShow.playNarrations', 'Play Narrations'],
	['pptx.slideShow.mediaControls', 'Show Media Controls'],
	['pptx.slideShow.subtitleSettings', 'Subtitle Settings'],
	// Record.
	['pptx.record.cameo', 'Cameo'],
	['pptx.record.clear', 'Clear'],
	['pptx.record.resetToCameo', 'Reset to Cameo'],
	['pptx.record.learnMore', 'Learn More'],
	// Review.
	['pptx.review.thesaurus', 'Thesaurus'],
	['pptx.review.translate', 'Translate'],
	['pptx.review.markAllRead', 'Mark All as Read'],
	['pptx.review.showComments', 'Show Comments'],
	['pptx.review.readOnly', 'Always Open Read-Only'],
	['pptx.review.restrictPermission', 'Restrict Permission'],
	['pptx.review.hideInk', 'Hide Ink'],
	['pptx.common.delete', 'Delete'],
	['pptx.common.previous', 'Previous'],
	['pptx.common.next', 'Next'],
	// View.
	['pptx.view.normal', 'Normal'],
	['pptx.view.readingView', 'Reading View'],
	['pptx.master.handoutMasterTitle', 'Handout Master'],
	['pptx.master.notesMasterTitle', 'Notes Master'],
	['pptx.view.selection', 'Selection'],
	['pptx.view.hGuide', 'H Guide'],
	['pptx.view.vGuide', 'V Guide'],
	['pptx.slideSorter.zoom', 'Zoom'],
	['pptx.grid.snapToShape', 'Snap to Shape'],
	['pptx.view.macros', 'Macros'],
	// Help.
	['pptx.ribbon.accessibilityCheck', 'Accessibility Check'],
];

describe('ribbon control labels', () => {
	it.each(RIBBON_LABELS)('resolves %s to "%s"', (key, english) => {
		expect(label(key)).toBe(english);
	});
});

describe('animation preset gallery', () => {
	const entries = ANIMATION_PRESET_CATEGORIES.flatMap((category) =>
		category.presets.map((preset) => ({ ...preset, group: category.group })),
	);

	it('offers the whole shared catalogue, not a six-effect sample', () => {
		expect(entries.map((entry) => entry.value)).toStrictEqual([
			...ENTRANCE_PRESET_VALUES,
			...EMPHASIS_PRESET_VALUES,
			...EXIT_PRESET_VALUES,
		]);
	});

	it('files each preset under the group that authors it', () => {
		for (const category of ANIMATION_PRESET_CATEGORIES) {
			const source =
				category.group === 'entrance'
					? ENTRANCE_PRESET_VALUES
					: category.group === 'emphasis'
						? EMPHASIS_PRESET_VALUES
						: EXIT_PRESET_VALUES;
			expect(category.presets.map((preset) => preset.value)).toStrictEqual([...source]);
		}
	});

	it('names every preset from the dictionary rather than a keyToLabel guess', () => {
		for (const entry of entries) {
			expect(entry.labelKey).toBe(`pptx.animation.preset.${entry.value}`);
			expect(translationsEn).toHaveProperty(entry.labelKey);
		}
	});

	/**
	 * The inventory spec counts controls per accessible name, so two buttons
	 * that resolve to one label read as a duplicate the reference does not have.
	 */
	it('renders each label exactly once across the three columns', () => {
		const labels = entries.map((entry) => label(entry.labelKey));
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('captions the columns with the three bucket names', () => {
		expect(ANIMATION_PRESET_CATEGORIES.map((category) => label(category.labelKey))).toStrictEqual([
			'Entrance',
			'Emphasis',
			'Exit',
		]);
	});
});

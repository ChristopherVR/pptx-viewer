import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	BACKSTAGE_CARD_IDS,
	BACKSTAGE_PAGE_IDS,
	CANVAS_CONTEXT_MENU_COMMAND_IDS,
	EDITOR_SHORTCUT_ACTION_IDS,
	ELEMENT_CONTEXT_MENU_COMMAND_IDS,
	OPTIONS_PAGE_IDS,
	OPTIONS_SECTION_IDS,
	OPTIONS_SETTING_IDS,
	RIBBON_TAB_IDS,
	TOOLBAR_BUTTON_IDS,
	VIEWER_DIALOG_IDS,
	VIEWER_EXPORT_FORMAT_IDS,
	VIEWER_FEATURE_IDS,
	VIEWER_PANEL_IDS,
} from './customization-catalog';
import {
	normalizeReferenceMarkdown,
	replaceCustomizationReference,
} from './customization-reference';

const DOC_PATH = resolve(__dirname, '../../../../../docs/guide/customization.md');

describe('docs/guide/customization.md', () => {
	const doc = readFileSync(DOC_PATH, 'utf8');

	it('carries the generated reference (run `bun run docs:customization`)', () => {
		expect(normalizeReferenceMarkdown(replaceCustomizationReference(doc))).toBe(
			normalizeReferenceMarkdown(doc),
		);
	});

	it('documents every customisation id', () => {
		const ids = [
			...RIBBON_TAB_IDS,
			...TOOLBAR_BUTTON_IDS,
			...OPTIONS_PAGE_IDS,
			...OPTIONS_SECTION_IDS,
			...OPTIONS_SETTING_IDS,
			...BACKSTAGE_PAGE_IDS,
			...BACKSTAGE_CARD_IDS,
			...ELEMENT_CONTEXT_MENU_COMMAND_IDS,
			...CANVAS_CONTEXT_MENU_COMMAND_IDS,
			...EDITOR_SHORTCUT_ACTION_IDS,
			...VIEWER_PANEL_IDS,
			...VIEWER_FEATURE_IDS,
			...VIEWER_DIALOG_IDS,
			...VIEWER_EXPORT_FORMAT_IDS,
		];
		const missing = ids.filter((id) => !doc.includes(`\`${id}\``));
		expect(missing).toStrictEqual([]);
	});
});

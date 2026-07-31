import { describe, expect, it } from 'vitest';

import { DEFAULT_QUICK_ACCESS_COMMAND_IDS, extraQuickAccessCommands } from './quick-access';
import { DEFAULT_VIEWER_OPTIONS } from './viewer-options';

/**
 * The quick-access strip is the one piece of chrome whose CONTENTS are
 * options-driven, and four of the five bindings used to hardcode three buttons
 * and ignore the options entirely. These tests pin the contract they now all
 * render from.
 */
describe('extraQuickAccessCommands', () => {
	it('returns the default strip minus the dedicated Save/Undo/Redo buttons', () => {
		expect(
			extraQuickAccessCommands(DEFAULT_QUICK_ACCESS_COMMAND_IDS).map((c) => c.id),
		).toStrictEqual(['presentFromStart']);
	});

	it('matches the shipped default options', () => {
		expect(DEFAULT_VIEWER_OPTIONS.quickAccess.commandIds).toStrictEqual([
			...DEFAULT_QUICK_ACCESS_COMMAND_IDS,
		]);
	});

	it('keeps the configured order', () => {
		expect(
			extraQuickAccessCommands(['zoomOut', 'save', 'print', 'undo']).map((c) => c.id),
		).toStrictEqual(['zoomOut', 'print']);
	});

	it('drops unknown ids and duplicates', () => {
		expect(extraQuickAccessCommands(['print', 'nope', 'print']).map((c) => c.id)).toStrictEqual([
			'print',
		]);
	});

	it('carries the label key and icon each binding renders from', () => {
		expect(extraQuickAccessCommands(['presentFromStart'])[0]).toStrictEqual({
			id: 'presentFromStart',
			labelKey: 'pptx.options.quickAccess.command.presentFromStart',
			icon: 'play',
		});
	});
});

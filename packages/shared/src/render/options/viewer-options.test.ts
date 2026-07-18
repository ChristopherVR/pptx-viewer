// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { VIEWER_PREFS_STORAGE_KEY } from '../viewer-prefs-storage';
import { applyAutoCorrect } from './autocorrect';
import {
	addQuickAccessCommand,
	availableQuickAccessCommands,
	moveQuickAccessCommand,
	removeQuickAccessCommand,
} from './quick-access';
import {
	DEFAULT_VIEWER_OPTIONS,
	applyPreferenceToOptions,
	diffViewerOptions,
	mergeViewerOptions,
	viewerOptionsToPreferences,
} from './viewer-options';
import {
	resolveDefaultPrintSettings,
	resolveHistoryDepth,
	resolveImageResolutionScale,
	resolveScreenTip,
	resolveVisibleRibbonTabs,
} from './viewer-options-apply';
import { VIEWER_OPTIONS_TABS, getViewerOptionsTab } from './viewer-options-schema';
import { createViewerOptionsStore } from './viewer-options-store';

describe('viewer options model', () => {
	it('merges stored partials over defaults and drops unknown or mistyped keys', () => {
		const merged = mergeViewerOptions({
			advanced: { maximumUndoSteps: 40, bogus: true, printHighQuality: 'yes' } as never,
			general: { userName: 'Chris' },
		});
		expect(merged.advanced.maximumUndoSteps).toBe(40);
		expect(merged.general.userName).toBe('Chris');
		expect(merged.advanced.printHighQuality).toBeFalsy();
		expect('bogus' in merged.advanced).toBeFalsy();
	});

	it('diffs only changed values and round-trips through merge', () => {
		const options = mergeViewerOptions(undefined);
		options.save.autoRecoverIntervalMinutes = 10;
		options.ribbon.hiddenTabIds = ['review'];
		const diff = diffViewerOptions(options);
		expect(diff).toStrictEqual({
			save: { autoRecoverIntervalMinutes: 10 },
			ribbon: { hiddenTabIds: ['review'] },
		});
		expect(mergeViewerOptions(diff)).toStrictEqual(options);
	});

	it('maps to and from the legacy six-toggle preferences surface', () => {
		const prefs = viewerOptionsToPreferences(DEFAULT_VIEWER_OPTIONS);
		expect(prefs).toStrictEqual({
			autoSave: true,
			spellCheck: false,
			showGrid: false,
			showRulers: false,
			snapToGrid: false,
			reducedMotion: false,
		});
		const withSpell = applyPreferenceToOptions(DEFAULT_VIEWER_OPTIONS, 'spellCheck', true);
		expect(withSpell.proofing.checkSpellingAsYouType).toBeTruthy();
		expect(DEFAULT_VIEWER_OPTIONS.proofing.checkSpellingAsYouType).toBeFalsy();
	});
});

describe('viewer options schema', () => {
	it('exposes the ten PowerPoint categories in order', () => {
		expect(VIEWER_OPTIONS_TABS.map((tab) => tab.id)).toStrictEqual([
			'general',
			'proofing',
			'save',
			'language',
			'accessibility',
			'advanced',
			'ribbon',
			'quickAccess',
			'addIns',
			'trust',
		]);
	});

	it('references only keys that exist in the options model', () => {
		for (const tab of VIEWER_OPTIONS_TABS) {
			for (const section of tab.sections) {
				for (const control of section.controls) {
					const group = DEFAULT_VIEWER_OPTIONS[control.group] as Record<string, unknown>;
					expect(control.key in group, `${tab.id}:${control.group}.${control.key}`).toBeTruthy();
					const value = group[control.key];
					if (control.kind === 'toggle') {
						expect(value).toBeTypeOf('boolean');
					} else if (control.kind === 'number') {
						expect(value).toBeTypeOf('number');
					} else {
						expect(value).toBeTypeOf('string');
					}
				}
			}
		}
	});

	it('throws for unknown tab lookups', () => {
		expect(() => getViewerOptionsTab('nope' as never)).toThrow();
	});
});

describe('viewer options store', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('persists a sparse diff and rehydrates it', () => {
		const store = createViewerOptionsStore();
		store.setValue('advanced', 'maximumUndoSteps', 25);
		store.setValue('general', 'userInitials', 'CV');
		const raw = localStorage.getItem(VIEWER_PREFS_STORAGE_KEY);
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw ?? '{}') as { options?: unknown };
		expect(parsed.options).toStrictEqual({
			advanced: { maximumUndoSteps: 25 },
			general: { userInitials: 'CV' },
		});
		const rehydrated = createViewerOptionsStore();
		expect(rehydrated.getOptions().advanced.maximumUndoSteps).toBe(25);
		expect(rehydrated.getOptions().general.userInitials).toBe('CV');
	});

	it('rejects unknown keys and mismatched value types', () => {
		const store = createViewerOptionsStore();
		store.setValue('advanced', 'nope', true);
		store.setValue('advanced', 'maximumUndoSteps', 'many');
		expect(store.getOptions().advanced.maximumUndoSteps).toBe(100);
	});

	it('notifies subscribers and supports unsubscribe', () => {
		const store = createViewerOptionsStore();
		const seen: number[] = [];
		const unsubscribe = store.subscribe((options) => {
			seen.push(options.advanced.maximumUndoSteps);
		});
		store.setValue('advanced', 'maximumUndoSteps', 30);
		unsubscribe();
		store.setValue('advanced', 'maximumUndoSteps', 40);
		expect(seen).toStrictEqual([30]);
	});

	it('never hides the File tab and resets per group', () => {
		const store = createViewerOptionsStore();
		store.setRibbonTabHidden('file', true);
		store.setRibbonTabHidden('review', true);
		expect(store.getOptions().ribbon.hiddenTabIds).toStrictEqual(['review']);
		store.reset('ribbon');
		expect(store.getOptions().ribbon.hiddenTabIds).toStrictEqual([]);
	});
});

describe('behavior helpers', () => {
	it('clamps history depth and derives autosave/print/ribbon wiring', () => {
		const options = mergeViewerOptions({ advanced: { maximumUndoSteps: 999 } });
		expect(resolveHistoryDepth(options)).toBe(150);
		expect(
			resolveVisibleRibbonTabs(
				mergeViewerOptions({ ribbon: { hiddenTabIds: ['file', 'review'] } }),
			).some((tab) => tab.id === 'file'),
		).toBeTruthy();
		expect(resolveDefaultPrintSettings(DEFAULT_VIEWER_OPTIONS)).toBeUndefined();
		const explicit = mergeViewerOptions({
			advanced: { printUseMostRecentSettings: false, printColorMode: 'grayscale' },
		});
		expect(resolveDefaultPrintSettings(explicit)).toStrictEqual({
			printWhat: 'slides',
			colorMode: 'grayscale',
			frameSlides: false,
		});
	});

	it('resolves screen tips per style', () => {
		expect(resolveScreenTip(DEFAULT_VIEWER_OPTIONS, 'Save', 'Saves the file', 'Ctrl+S')).toBe(
			'Save: Saves the file (Ctrl+S)',
		);
		const off = mergeViewerOptions({ general: { screenTipStyle: 'off' } });
		expect(resolveScreenTip(off, 'Save', 'Saves the file')).toBeUndefined();
		const plain = mergeViewerOptions({
			general: { screenTipStyle: 'plain' },
			accessibility: { showShortcutKeysInScreenTips: false },
		});
		expect(resolveScreenTip(plain, 'Save', 'Saves the file', 'Ctrl+S')).toBe('Save');
	});

	it('scales image resolution presets against the css pixel grid', () => {
		expect(resolveImageResolutionScale(DEFAULT_VIEWER_OPTIONS)).toBe(1);
		const ppi = mergeViewerOptions({ advanced: { imageDefaultResolution: 'ppi330' } });
		expect(resolveImageResolutionScale(ppi)).toBeCloseTo(330 / 96);
	});
});

describe('quick access helpers', () => {
	it('adds, removes, and reorders commands defensively', () => {
		const base = ['save', 'undo'];
		expect(addQuickAccessCommand(base, 'print')).toStrictEqual(['save', 'undo', 'print']);
		expect(addQuickAccessCommand(base, 'save')).toStrictEqual(base);
		expect(addQuickAccessCommand(base, 'unknown')).toStrictEqual(base);
		expect(removeQuickAccessCommand(base, 'undo')).toStrictEqual(['save']);
		expect(moveQuickAccessCommand(base, 'undo', 'up')).toStrictEqual(['undo', 'save']);
		expect(moveQuickAccessCommand(base, 'save', 'up')).toStrictEqual(base);
		expect(availableQuickAccessCommands(base).some((entry) => entry.id === 'save')).toBeFalsy();
	});
});

describe('autocorrect', () => {
	const proofing = DEFAULT_VIEWER_OPTIONS.proofing;

	it('applies the PowerPoint replacement set', () => {
		expect(applyAutoCorrect('HEllo world on monday', proofing)).toBe('Hello world on Monday');
		expect(applyAutoCorrect('a 1/2 share, the 1st time', proofing)).toBe('A ½ share, the 1ˢᵗ time');
		expect(applyAutoCorrect('he said "hi" -- really', proofing)).toBe('He said “hi” – really');
	});

	it('honours disabled rules', () => {
		const off = {
			...proofing,
			autoCorrectSmartQuotes: false,
			autoCorrectCapitalizeFirstLetter: false,
			autoCorrectTwoInitialCapitals: false,
		};
		expect(applyAutoCorrect('HEllo "there"', off)).toBe('HEllo "there"');
	});

	it('leaves acronyms alone', () => {
		expect(applyAutoCorrect('NASA HQ', proofing)).toBe('NASA HQ');
	});
});

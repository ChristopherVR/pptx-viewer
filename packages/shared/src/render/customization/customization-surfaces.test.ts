import { describe, expect, it } from 'vitest';

import { BACKSTAGE_NAV } from '../backstage';
import { backstageCardsFor } from '../backstage-cards';
import { buildCanvasContextMenuEntries } from '../canvas-context-menu-commands';
import { buildContextMenuEntries } from '../context-menu-commands';
import { VIEWER_OPTIONS_TABS } from '../options/viewer-options-schema';
import {
	OPTIONS_SECTION_IDS,
	OPTIONS_SETTING_IDS,
	TOOLBAR_BUTTON_IDS,
} from './customization-catalog';
import {
	EMPTY_RESOLVED_CUSTOMIZATION,
	isDialogAvailable,
	isFeatureEnabled,
	isPanelVisible,
	resolveCustomization,
	resolveEffectiveHiddenActions,
} from './customization-resolve';
import {
	customizeBackstageCards,
	customizeBackstageNav,
	customizeCanvasContextMenuEntries,
	customizeContextMenuEntries,
	customizeOptionsTabs,
	filterMenuEntries,
} from './customization-surfaces';

describe('catalogues', () => {
	it('derives unique section and setting ids from the schema and model', () => {
		expect(new Set(OPTIONS_SECTION_IDS).size).toBe(OPTIONS_SECTION_IDS.length);
		expect(OPTIONS_SECTION_IDS).toContain('general.personalize');
		expect(OPTIONS_SETTING_IDS).toContain('general.userName');
		expect(OPTIONS_SETTING_IDS).not.toContain('ribbon.hiddenTabIds');
		expect(TOOLBAR_BUTTON_IDS).toContain('share');
	});
});

describe('resolveCustomization', () => {
	it('hides nothing for an empty customisation', () => {
		expect(resolveEffectiveHiddenActions(EMPTY_RESOLVED_CUSTOMIZATION)).toBeUndefined();
		expect(isPanelVisible(EMPTY_RESOLVED_CUSTOMIZATION, 'statusBar')).toBeTruthy();
		expect(isFeatureEnabled(EMPTY_RESOLVED_CUSTOMIZATION, 'ai')).toBeTruthy();
	});

	it('merges the legacy hiddenActions prop with ribbon customisation', () => {
		const resolved = resolveCustomization({ ribbon: { hiddenTabs: ['draw'] } });
		expect(resolveEffectiveHiddenActions(resolved, ['share'])?.sort()).toStrictEqual([
			'draw',
			'share',
		]);
		expect(resolveEffectiveHiddenActions(EMPTY_RESOLVED_CUSTOMIZATION, ['undo'])).toStrictEqual([
			'undo',
		]);
	});

	it('folds collaboration off into the share and broadcast entry points', () => {
		const resolved = resolveCustomization({ disabledFeatures: ['collaboration'] });
		expect(isDialogAvailable(resolved, 'share')).toBeFalsy();
		expect(resolved.hiddenActions.has('share')).toBeTruthy();
		expect(resolved.hiddenActions.has('broadcast')).toBeTruthy();
		expect(resolved.hiddenBackstagePages.has('share')).toBeTruthy();
		expect(resolved.hiddenBackstageCards.has('share')).toBeTruthy();
	});

	it('removes Export entirely once every format is hidden', () => {
		const resolved = resolveCustomization({
			hiddenExportFormats: ['pdf', 'png', 'video', 'gif', 'json', 'copyImage'],
		});
		expect(resolved.hiddenActions.has('export')).toBeTruthy();
		expect(resolved.hiddenBackstagePages.has('export')).toBeTruthy();
		const some = resolveCustomization({ hiddenExportFormats: ['video'] });
		expect(some.hiddenActions.has('export')).toBeFalsy();
		expect(some.hiddenBackstageCards.has('video')).toBeTruthy();
	});

	it('turns AI off in menus and Options', () => {
		const resolved = resolveCustomization({ disabledFeatures: ['ai'] });
		const entries = customizeContextMenuEntries(
			buildContextMenuEntries({ aiEnabled: true }),
			resolved,
		);
		expect(entries.map((e) => e.id)).not.toContain('ai-ask');
		expect(resolved.hiddenOptionsPages.has('ai')).toBeTruthy();
	});
});

describe('customizeOptionsTabs', () => {
	it('returns the schema itself when Options are not customised', () => {
		expect(customizeOptionsTabs(VIEWER_OPTIONS_TABS, EMPTY_RESOLVED_CUSTOMIZATION)).toBe(
			VIEWER_OPTIONS_TABS,
		);
	});

	it('hides pages, sections and settings, and marks locks read-only', () => {
		const resolved = resolveCustomization({
			options: {
				hiddenPages: ['trust'],
				hiddenSections: ['general.startup'],
				hiddenSettings: ['general.userInitials'],
				locked: { 'general.userName': 'Kiosk' },
			},
		});
		const tabs = customizeOptionsTabs(VIEWER_OPTIONS_TABS, resolved);
		expect(tabs.map((t) => t.id)).not.toContain('trust');
		const general = tabs.find((t) => t.id === 'general');
		expect(general?.sections.map((s) => s.id)).not.toContain('startup');
		const personalize = general?.sections.find((s) => s.id === 'personalize');
		expect(personalize?.controls.map((c) => c.key)).toStrictEqual(['userName']);
		expect(personalize?.controls[0]?.readOnly).toBeTruthy();
	});

	it('drops a section that lost all its controls and a page that lost all sections', () => {
		const resolved = resolveCustomization({
			options: { hiddenSettings: ['general.showStartScreen'] },
		});
		const general = customizeOptionsTabs(VIEWER_OPTIONS_TABS, resolved).find(
			(t) => t.id === 'general',
		);
		expect(general?.sections.map((s) => s.id)).not.toContain('startup');
		const trust = VIEWER_OPTIONS_TABS.find((t) => t.id === 'trust');
		const trustSections = (trust?.sections ?? []).map((s) => `trust.${s.id}` as const);
		const noTrust = customizeOptionsTabs(
			VIEWER_OPTIONS_TABS,
			resolveCustomization({ options: { hiddenSections: trustSections } }),
		);
		expect(noTrust.map((t) => t.id)).not.toContain('trust');
	});
});

describe('menus and backstage', () => {
	it('repairs separators when a group leader is hidden', () => {
		const entries = [
			{ id: 'a' },
			{ id: 'b', separatorBefore: true },
			{ id: 'c' },
			{ id: 'd', separatorBefore: true },
		];
		expect(filterMenuEntries(entries, new Set(['b']))).toStrictEqual([
			{ id: 'a' },
			{ id: 'c', separatorBefore: true },
			{ id: 'd', separatorBefore: true },
		]);
		expect(filterMenuEntries(entries, new Set(['a']))[0]).toStrictEqual({
			id: 'b',
			separatorBefore: false,
		});
	});

	it('filters both context menus and honours disable flags', () => {
		const resolved = resolveCustomization({
			contextMenu: { hiddenElementCommands: ['delete'], hiddenCanvasCommands: ['ruler'] },
		});
		expect(
			customizeContextMenuEntries(buildContextMenuEntries(), resolved).map((e) => e.id),
		).not.toContain('delete');
		expect(
			customizeCanvasContextMenuEntries(buildCanvasContextMenuEntries(), resolved).map((e) => e.id),
		).not.toContain('ruler');
		const off = resolveCustomization({ contextMenu: { disableCanvasMenu: true } });
		expect(customizeCanvasContextMenuEntries(buildCanvasContextMenuEntries(), off)).toStrictEqual(
			[],
		);
	});

	it('filters File tab navigation and cards', () => {
		const resolved = resolveCustomization({
			backstage: { hiddenPages: ['account'], hiddenCards: ['gif'] },
			hiddenDialogs: ['print'],
		});
		const nav = customizeBackstageNav(BACKSTAGE_NAV, resolved).map((n) => n.id);
		expect(nav).not.toContain('account');
		expect(nav).not.toContain('print');
		const cards = customizeBackstageCards(backstageCardsFor('export'), resolved).map((c) => c.id);
		expect(cards).toContain('pdf');
		expect(cards).not.toContain('gif');
	});
});

/**
 * title-bar.component.test.ts: the title bar's quick-access strip is
 * options-driven (File > Options > Quick Access Toolbar), and the strip's
 * contents are the one piece of chrome the five bindings disagreed on: four of
 * them hardcoded Save/Undo/Redo and ignored the options model entirely.
 *
 * No Angular TestBed in this package (see `action-settings-panel.component.test.ts`),
 * so the template's `@if (extraQat().commandIds.length > 0)` predicate is
 * factored into the pure `narrowToExtraQuickAccess` and asserted directly.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWER_OPTIONS } from '../internal/shared';
import type { TitleBarViewState, ViewerQuickAccessOptions } from '../internal/shared';
import {
	narrowToExtraQuickAccess,
	resolveBelowRibbonQuickAccess,
	TitleBarComponent,
} from './title-bar.component';

function quickAccess(over: Partial<ViewerQuickAccessOptions> = {}): ViewerQuickAccessOptions {
	return { ...DEFAULT_VIEWER_OPTIONS.quickAccess, ...over };
}

describe('narrowToExtraQuickAccess', () => {
	it('leaves the shipped default with exactly the one non-dedicated command', () => {
		// The default is [save, undo, redo, presentFromStart]; the first three are
		// rendered as dedicated buttons, so only the fourth reaches the strip.
		expect(narrowToExtraQuickAccess(quickAccess()).commandIds).toStrictEqual(['presentFromStart']);
	});

	it('keeps the configured order and drops unknown ids', () => {
		expect(
			narrowToExtraQuickAccess(quickAccess({ commandIds: ['zoomOut', 'save', 'print', 'nope'] }))
				.commandIds,
		).toStrictEqual(['zoomOut', 'print']);
	});

	it('renders nothing when the options hide the strip', () => {
		expect(narrowToExtraQuickAccess(quickAccess({ visible: false })).commandIds).toStrictEqual([]);
	});

	it('carries the rest of the options through, so labels/tooltips still apply', () => {
		const narrowed = narrowToExtraQuickAccess(quickAccess({ showCommandLabels: true }));
		expect(narrowed.showCommandLabels).toBeTruthy();
		expect(narrowed.visible).toBeTruthy();
	});
});

/**
 * Options > Quick Access Toolbar > Position "Below the Ribbon" used to be
 * stored and displayed by the pane but never actually moved anything: no
 * component read `position`, so every strip stayed in the title bar
 * regardless of what the pane showed as selected. `resolveBelowRibbonQuickAccess`
 * is the single decision both the below-ribbon row (PowerPointViewerComponent)
 * and the title bar's own inline strip key off, so they can never disagree
 * about where the configured commands render.
 */
describe('resolveBelowRibbonQuickAccess', () => {
	it('renders nothing above (the default position)', () => {
		expect(resolveBelowRibbonQuickAccess(quickAccess())).toBeNull();
	});

	it('renders the extra commands below when position is "below"', () => {
		const resolved = resolveBelowRibbonQuickAccess(
			quickAccess({ position: 'below', commandIds: ['save', 'undo', 'redo', 'zoomIn'] }),
		);
		expect(resolved?.commandIds).toStrictEqual(['zoomIn']);
	});

	it('renders nothing below when the strip is hidden entirely', () => {
		expect(
			resolveBelowRibbonQuickAccess(quickAccess({ position: 'below', visible: false })),
		).toBeNull();
	});

	it('renders nothing below when no commands are configured beyond the dedicated trio', () => {
		expect(
			resolveBelowRibbonQuickAccess(
				quickAccess({ position: 'below', commandIds: ['save', 'undo', 'redo'] }),
			),
		).toBeNull();
	});
});

/**
 * The component is a thin adapter around `pptx-ui-title-bar`: its default state
 * and event routing are checked through an injection context (no TestBed).
 */
describe('titleBarComponent adapter', () => {
	type Out = { subscribe(fn: (value: string) => void): unknown };
	function create() {
		const translate = {
			onLangChange: new Subject<unknown>(),
			onTranslationChange: new Subject<unknown>(),
			instant: (key: string) => key,
		};
		const injector = Injector.create({
			providers: [{ provide: TranslateService, useValue: translate }],
		});
		return runInInjectionContext(injector, () => new TitleBarComponent()) as unknown as {
			view(): TitleBarViewState;
			placement(): string;
			onCommandSearch(event: Event): void;
			onQuickCommand(event: Event): void;
			onEvent(id: 'save' | 'undo' | 'redo', event?: Event): void;
			commandSearch: Out;
			toggleFindReplace: Out;
			quickCommand: Out;
			save: Out;
			undo: Out;
		};
	}

	it('maps the default inputs onto a read-only, non-editing state', () => {
		const state = create().view();
		expect(state.editing).toBeFalsy();
		expect(state.searchVisible).toBeFalsy();
		expect(state.quickAccess).toStrictEqual(DEFAULT_VIEWER_OPTIONS.quickAccess);
		expect(state.autosave.statusKey).toBe('pptx.titleBar.savedToThisPc');
		expect(state.history.showUndo).toBeTruthy();
	});

	it('defaults to the title-bar placement', () => {
		expect(create().placement()).toBe('titleBar');
	});

	it('routes a catalogue command to commandSearch and content search to Find', () => {
		const bar = create();
		const commands: string[] = [];
		let finds = 0;
		bar.commandSearch.subscribe((v: string) => commands.push(v));
		bar.toggleFindReplace.subscribe(() => finds++);
		bar.onCommandSearch(
			new CustomEvent('command-search', { detail: { query: 'b', command: 'format.bold' } }),
		);
		bar.onCommandSearch(new CustomEvent('command-search', { detail: { query: 'zzz' } }));
		expect(commands).toStrictEqual(['format.bold']);
		expect(finds).toBe(1);
	});

	it('routes quick commands and dedicated buttons to their outputs', () => {
		const bar = create();
		const seen: string[] = [];
		bar.quickCommand.subscribe((v: string) => seen.push(`q:${v}`));
		bar.save.subscribe(() => seen.push('save'));
		bar.undo.subscribe(() => seen.push('undo'));
		bar.onQuickCommand(new CustomEvent('quick-command', { detail: { id: 'print' } }));
		bar.onEvent('save');
		bar.onEvent('undo');
		expect(seen).toStrictEqual(['q:print', 'save', 'undo']);
	});

	it('consumes the bubbling DOM event so a host binding does not run twice', () => {
		const bar = create();
		const event = new CustomEvent('undo', { bubbles: true });
		bar.onEvent('undo', event);
		expect(event.cancelBubble).toBeTruthy();
	});
});

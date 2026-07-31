import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import type { ViewerOptions } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
/**
 * The title bar's quick-access strip is options-driven, and this binding used
 * to hardcode Save/Undo/Redo and ignore `options.quickAccess` entirely, so it
 * rendered three commands where the shared default (and Angular) had four.
 *
 * Rendered with `renderToStaticMarkup`, matching the convention in
 * `Toolbar.test.tsx` / `TabRowActions.test.tsx`.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const { TitleBar } = await import('./TitleBar');
const { ViewerOptionsContext } = await import('../viewer-options-context');

/** Accessible names of the title bar's buttons, in DOM order. */
function quickAccessNames(markup: string): string[] {
	return [...markup.matchAll(/<button[^>]*aria-label="(?<name>[^"]*)"/gu)]
		.map((match) => match.groups?.name ?? '')
		.filter((name) => name !== translationsEn['pptx.titleBar.toggleAutoSave']);
}

function render(options: ViewerOptions = DEFAULT_VIEWER_OPTIONS, onQuickCommand = vi.fn()): string {
	return renderToStaticMarkup(
		<ViewerOptionsContext.Provider value={options}>
			<TitleBar
				mode='edit'
				canEdit
				isDirty={false}
				autosaveEnabled
				onToggleAutosave={() => {}}
				canUndo={false}
				canRedo={false}
				onUndo={() => {}}
				onRedo={() => {}}
				onSave={() => {}}
				findReplaceOpen={false}
				onToggleFindReplace={() => {}}
				onQuickCommand={onQuickCommand}
			/>
		</ViewerOptionsContext.Provider>,
	);
}

function withQuickAccess(quickAccess: Partial<ViewerOptions['quickAccess']>): ViewerOptions {
	return {
		...DEFAULT_VIEWER_OPTIONS,
		quickAccess: { ...DEFAULT_VIEWER_OPTIONS.quickAccess, ...quickAccess },
	};
}

describe('the quick-access strip follows File > Options', () => {
	it('renders the shipped default, which is four commands and not three', () => {
		expect(quickAccessNames(render())).toStrictEqual([
			translationsEn['pptx.titleBar.save'],
			translationsEn['pptx.toolbar.undo'],
			translationsEn['pptx.toolbar.redo'],
			translationsEn['pptx.options.quickAccess.command.presentFromStart'],
		]);
	});

	it('honours a reconfigured command list', () => {
		const names = quickAccessNames(render(withQuickAccess({ commandIds: ['save', 'print'] })));
		expect(names).toContain(translationsEn['pptx.options.quickAccess.command.print']);
		expect(names).not.toContain(
			translationsEn['pptx.options.quickAccess.command.presentFromStart'],
		);
	});

	it('drops the configured extras when the options hide the strip', () => {
		expect(quickAccessNames(render(withQuickAccess({ visible: false })))).toStrictEqual([
			translationsEn['pptx.titleBar.save'],
			translationsEn['pptx.toolbar.undo'],
			translationsEn['pptx.toolbar.redo'],
		]);
	});

	it('never duplicates the dedicated Save/Undo/Redo buttons as extras', () => {
		const names = quickAccessNames(
			render(withQuickAccess({ commandIds: ['save', 'undo', 'redo', 'save'] })),
		);
		expect(names).toStrictEqual([
			translationsEn['pptx.titleBar.save'],
			translationsEn['pptx.toolbar.undo'],
			translationsEn['pptx.toolbar.redo'],
		]);
	});
});

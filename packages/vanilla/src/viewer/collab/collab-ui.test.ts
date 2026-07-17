import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerChrome } from '../ui';
import { createCollabUi } from './collab-ui';
import type { CollabUiDeps } from './collab-ui';

/** A minimal fake chrome exposing only what `collab-ui.ts` touches. */
function fakeChrome(): ViewerChrome {
	const ribbonEl = document.createElement('div');
	const primaryRow = document.createElement('div');
	primaryRow.className = 'pptxv-ribbon-primary';
	ribbonEl.appendChild(primaryRow);
	const collaborationHost = document.createElement('span');
	return {
		ribbon: { el: ribbonEl } as unknown as ViewerChrome['ribbon'],
		mobileToolbar: { collaborationHost } as unknown as ViewerChrome['mobileToolbar'],
		stageWrap: document.createElement('div'),
	} as unknown as ViewerChrome;
}

function makeDeps(over: Partial<CollabUiDeps> = {}): CollabUiDeps {
	const store = createStore(createInitialViewerState());
	const chrome = fakeChrome();
	return {
		doc: document,
		store,
		getChrome: () => chrome,
		getTranslator: () => createTranslator(),
		getScale: () => 1,
		startCollaboration: vi.fn(() => Promise.resolve()),
		stopCollaboration: vi.fn(),
		getStatus: () => 'disconnected',
		getConfig: () => null,
		followUser: vi.fn(),
		...over,
	};
}

describe('createCollabUi', () => {
	it('omitting hiddenActions renders both the Share and Broadcast quick-access buttons (backward compatible default)', () => {
		const deps = makeDeps();
		createCollabUi(deps);
		const primaryRow = deps.getChrome().ribbon?.el.querySelector('.pptxv-ribbon-primary');
		expect(primaryRow?.querySelectorAll(':scope > button')).toHaveLength(2);
	});

	it("hides the Share quick-access button (desktop + mobile) on 'share'", () => {
		const deps = makeDeps({ hiddenActions: ['share'] });
		createCollabUi(deps);
		const primaryRow = deps.getChrome().ribbon?.el.querySelector('.pptxv-ribbon-primary');
		expect(primaryRow?.querySelectorAll(':scope > button')).toHaveLength(1);
		const mobileHost = deps.getChrome().mobileToolbar?.collaborationHost;
		expect(mobileHost?.querySelector('button')).toBeNull();
	});

	it("hides the Broadcast quick-access button on 'broadcast' without touching Share", () => {
		const deps = makeDeps({ hiddenActions: ['broadcast'] });
		createCollabUi(deps);
		const primaryRow = deps.getChrome().ribbon?.el.querySelector('.pptxv-ribbon-primary');
		expect(primaryRow?.querySelectorAll(':scope > button')).toHaveLength(1);
		const mobileHost = deps.getChrome().mobileToolbar?.collaborationHost;
		expect(mobileHost?.querySelector('button')).not.toBeNull();
	});
});

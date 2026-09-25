// @vitest-environment happy-dom
/**
 * The React wiring of the shared customisation controller: the options store
 * receives the host's locks and defaults, a new `customization` prop replaces
 * imperative edits, and the legacy `hiddenActions` prop is unioned in.
 */
import type { ToolbarActionId, ViewerCustomization, ViewerOptionsStore } from 'pptx-viewer-shared';
import { createViewerOptionsStore } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ViewerCustomizationResult } from './useViewerCustomization';
import { useViewerCustomization } from './useViewerCustomization';

let container: HTMLDivElement;
let root: Root;
let latest: ViewerCustomizationResult | null = null;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	latest = null;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function Probe(props: {
	customization?: ViewerCustomization;
	hiddenActions?: ToolbarActionId[];
	store: ViewerOptionsStore;
}): null {
	latest = useViewerCustomization(props.customization, props.hiddenActions, props.store);
	return null;
}

function current(): ViewerCustomizationResult {
	if (!latest) {
		throw new Error('the probe never rendered');
	}
	return latest;
}

describe('useViewerCustomization', () => {
	it('pushes a locked setting into the options store', () => {
		const store = createViewerOptionsStore({ persist: false });
		act(() => {
			root.render(
				<Probe
					store={store}
					customization={{ options: { locked: { 'general.userName': 'Host' } } }}
				/>,
			);
		});
		expect(store.getOptions().general.userName).toBe('Host');
		expect(store.isLocked('general', 'userName')).toBeTruthy();
		// A user write to the locked setting is ignored.
		store.setValue('general', 'userName', 'Someone else');
		expect(store.getOptions().general.userName).toBe('Host');
	});

	it('applies a lock added through the imperative API, and lifts it again', () => {
		const store = createViewerOptionsStore({ persist: false });
		act(() => {
			root.render(<Probe store={store} />);
		});
		expect(store.isLocked('advanced', 'showGrid')).toBeFalsy();
		act(() => current().api.lockSetting('advanced.showGrid', true));
		expect(store.isLocked('advanced', 'showGrid')).toBeTruthy();
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
		act(() => current().api.unlockSetting('advanced.showGrid'));
		expect(store.isLocked('advanced', 'showGrid')).toBeFalsy();
	});

	it('unions the legacy hiddenActions prop with the customisation', () => {
		const store = createViewerOptionsStore({ persist: false });
		act(() => {
			root.render(
				<Probe
					store={store}
					hiddenActions={['share']}
					customization={{ ribbon: { hiddenTabs: ['draw'] } }}
				/>,
			);
		});
		expect(current().hiddenActions).toStrictEqual(expect.arrayContaining(['share', 'draw']));
	});

	it('lets a new customization prop replace imperative edits', () => {
		const store = createViewerOptionsStore({ persist: false });
		const first: ViewerCustomization = {};
		act(() => {
			root.render(<Probe store={store} customization={first} />);
		});
		act(() => current().api.hideRibbonTab('insert'));
		expect(current().resolved.hiddenActions.has('insert')).toBeTruthy();
		// Same identity: the imperative edit survives a re-render.
		act(() => {
			root.render(<Probe store={store} customization={first} />);
		});
		expect(current().resolved.hiddenActions.has('insert')).toBeTruthy();
		act(() => {
			root.render(<Probe store={store} customization={{ ribbon: { hiddenTabs: ['view'] } }} />);
		});
		expect(current().resolved.hiddenActions.has('insert')).toBeFalsy();
		expect(current().resolved.hiddenActions.has('view')).toBeTruthy();
	});
});

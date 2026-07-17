import type { ToolbarActionId } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useToolbarVisibility } from './useToolbarVisibility';

/**
 * useToolbarVisibility: adapts the shared `isActionHidden` / `filterVisibleTabs`
 * (see `pptx-viewer-shared`'s `render/toolbar-actions.ts`) to Vue, so ribbon /
 * toolbar components can gate individual buttons and tabs on the host's
 * `hiddenActions` prop without reimplementing the matching logic themselves.
 */
describe('useToolbarVisibility', () => {
	it('hides nothing when hiddenActions is undefined (backward-compatible default)', () => {
		const { isHidden, visibleTabs } = useToolbarVisibility(() => undefined);
		expect(isHidden('share')).toBeFalsy();
		expect(isHidden('undo')).toBeFalsy();
		expect(visibleTabs.value).toHaveLength(12);
		expect(visibleTabs.value.map((tab) => tab.id)).toContain('insert');
	});

	it('hides nothing when hiddenActions is an empty array', () => {
		const { isHidden, visibleTabs } = useToolbarVisibility(() => []);
		expect(isHidden('broadcast')).toBeFalsy();
		expect(visibleTabs.value).toHaveLength(12);
	});

	it('reports a listed button id as hidden and leaves others visible', () => {
		const { isHidden } = useToolbarVisibility(() => ['share', 'undo']);
		expect(isHidden('share')).toBeTruthy();
		expect(isHidden('undo')).toBeTruthy();
		expect(isHidden('redo')).toBeFalsy();
		expect(isHidden('broadcast')).toBeFalsy();
	});

	it('filters a hidden ribbon tab out of visibleTabs', () => {
		const { visibleTabs } = useToolbarVisibility(() => ['insert', 'design']);
		const ids = visibleTabs.value.map((tab) => tab.id);
		expect(ids).not.toContain('insert');
		expect(ids).not.toContain('design');
		expect(ids).toContain('home');
		expect(ids).toHaveLength(10);
	});

	it('re-evaluates when the underlying reactive prop changes', () => {
		const hidden = ref<ToolbarActionId[]>([]);
		const { isHidden, visibleTabs } = useToolbarVisibility(() => hidden.value);
		expect(isHidden('view')).toBeFalsy();
		expect(visibleTabs.value.map((tab) => tab.id)).toContain('view');

		hidden.value = ['view'];
		expect(isHidden('view')).toBeTruthy();
		expect(visibleTabs.value.map((tab) => tab.id)).not.toContain('view');
	});
});

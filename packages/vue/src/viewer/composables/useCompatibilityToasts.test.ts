import type { PptxCompatibilityWarning } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useCompatibilityToasts } from './useCompatibilityToasts';

function warning(code: string, severity: 'info' | 'warning' = 'warning'): PptxCompatibilityWarning {
	return { code, severity, message: code } as PptxCompatibilityWarning;
}

describe('useCompatibilityToasts', () => {
	it('produces no toasts for an empty warning list', () => {
		const { visibleToasts, overflowCount } = useCompatibilityToasts({ warnings: ref([]) });
		expect(visibleToasts.value).toHaveLength(0);
		expect(overflowCount.value).toBe(0);
	});

	it('maps warnings through the shared decision function, deduped by code', () => {
		const { visibleToasts } = useCompatibilityToasts({
			warnings: ref([warning('SAVE_ELEMENT_SKIPPED'), warning('SAVE_ELEMENT_SKIPPED')]),
		});
		expect(visibleToasts.value).toHaveLength(1);
		expect(visibleToasts.value[0].code).toBe('SAVE_ELEMENT_SKIPPED');
	});

	it('caps the visible stack at 5 and reports the overflow count', () => {
		const warnings = Array.from({ length: 8 }, (_, i) => warning(`CODE_${i}`));
		const { visibleToasts, overflowCount } = useCompatibilityToasts({ warnings: ref(warnings) });
		expect(visibleToasts.value).toHaveLength(5);
		expect(overflowCount.value).toBe(3);
	});

	it('dismiss(id) removes only that toast', () => {
		const { visibleToasts, dismiss } = useCompatibilityToasts({
			warnings: ref([warning('A'), warning('B')]),
		});
		dismiss('A');
		expect(visibleToasts.value.map((t) => t.code)).toStrictEqual(['B']);
	});

	it('dismissAll clears the whole stack', () => {
		const { visibleToasts, dismissAll } = useCompatibilityToasts({
			warnings: ref([warning('A'), warning('B')]),
		});
		dismissAll();
		expect(visibleToasts.value).toHaveLength(0);
	});

	it('reset() restores toasts dismissed by a prior load', () => {
		const { visibleToasts, dismissAll, reset } = useCompatibilityToasts({
			warnings: ref([warning('A')]),
		});
		dismissAll();
		reset();
		expect(visibleToasts.value).toHaveLength(1);
	});
});

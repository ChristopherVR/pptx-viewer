import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createCollaborationStatus } from './collaboration-status';

describe('createCollaborationStatus', () => {
	it('exposes the exact connected runtime status contract', () => {
		const status = createCollaborationStatus(document, createTranslator(), vi.fn());

		status.update('connected', 3);

		expect(status.el.getAttribute('role')).toBe('status');
		expect(status.el.getAttribute('aria-label')).toBe('Collaboration: Connected');
		expect(status.el.textContent).toContain('3 people here');
		status.destroy();
	});

	it('keeps the Share-independent retry control in the error state', () => {
		const onRetry = vi.fn();
		const status = createCollaborationStatus(document, createTranslator(), onRetry);

		status.update('error', 0);
		const retry = status.el.querySelector<HTMLButtonElement>('button');
		expect(retry?.hidden).toBeFalsy();
		retry?.click();
		expect(onRetry).toHaveBeenCalledOnce();
		status.destroy();
	});
});

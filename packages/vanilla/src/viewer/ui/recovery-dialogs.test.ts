import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openSignatureStrippedDialog } from './signature-stripped-dialog';
import { openVersionHistoryPanel } from './version-history-panel';

afterEach(() => document.body.replaceChildren());

describe('recovery dialogs', () => {
	it('shows signature count and the continue action', () => {
		const dialog = openSignatureStrippedDialog(document, createTranslator(), 2);
		expect(dialog.textContent).toContain('2');
		expect(dialog.textContent).toContain('Edit anyway');
	});

	it('shows empty history when the recovery store has no record', async () => {
		const mount = document.createElement('div');
		document.body.appendChild(mount);
		const panel = openVersionHistoryPanel(document, mount, createTranslator(), {
			filePath: 'missing.pptx',
			onRestore: vi.fn(),
		});
		await vi.waitFor(() => expect(panel.textContent).toContain('No versions'));
	});
});

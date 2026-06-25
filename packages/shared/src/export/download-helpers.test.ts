import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, downloadDataUrl, sanitizeDownloadFilename } from './download-helpers';

interface FakeAnchor {
	href: string;
	download: string;
	click: ReturnType<typeof vi.fn>;
	remove: ReturnType<typeof vi.fn>;
}

describe('sanitizeDownloadFilename', () => {
	it('falls back to presentation.pptx for empty input', () => {
		expect(sanitizeDownloadFilename('')).toBe('presentation.pptx');
		expect(sanitizeDownloadFilename('   ')).toBe('presentation.pptx');
		expect(sanitizeDownloadFilename(null)).toBe('presentation.pptx');
		expect(sanitizeDownloadFilename(undefined)).toBe('presentation.pptx');
	});

	it('replaces control chars and reserved chars with underscore', () => {
		expect(sanitizeDownloadFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
		expect(sanitizeDownloadFilename('line\nbreak')).toBe('line_break');
	});

	it('collapses path-traversal sequences and strips leading dots', () => {
		// Each `\` -> `_`, then every `..` -> `__`.
		expect(sanitizeDownloadFilename('..\\..\\secret.pptx')).toBe('______secret.pptx');
		expect(sanitizeDownloadFilename('...hidden')).toBe('__.hidden');
		expect(sanitizeDownloadFilename('.config')).toBe('config');
	});

	it('truncates over-long names while preserving the extension', () => {
		const long = `${'a'.repeat(300)}.pptx`;
		const out = sanitizeDownloadFilename(long);
		expect(out).toHaveLength(200);
		expect(out.endsWith('.pptx')).toBeTruthy();
	});

	it('passes through a clean name unchanged', () => {
		expect(sanitizeDownloadFilename('My Deck (final).pptx')).toBe('My Deck (final).pptx');
	});
});

describe('downloadBlob / downloadDataUrl', () => {
	let anchor: FakeAnchor;
	let createObjectURL: ReturnType<typeof vi.fn>;
	let revokeObjectURL: ReturnType<typeof vi.fn>;
	let appendChild: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
		appendChild = vi.fn((node: unknown) => node);
		createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
		revokeObjectURL = vi.fn();
		// The shared package runs in a node test environment with no DOM, so we
		// stand up minimal `document` / `URL` stubs rather than rely on jsdom.
		vi.stubGlobal('document', {
			createElement: vi.fn(() => anchor),
			body: { appendChild },
		});
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('downloadBlob sets href + download and revokes after the delay', () => {
		const blob = { size: 1 } as Blob;
		downloadBlob(blob, 'deck.pptx');
		expect(createObjectURL).toHaveBeenCalledWith(blob);
		expect(anchor.href).toBe('blob:fake-url');
		expect(anchor.download).toBe('deck.pptx');
		expect(appendChild).toHaveBeenCalledOnce();
		expect(anchor.click).toHaveBeenCalledOnce();
		expect(revokeObjectURL).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(anchor.remove).toHaveBeenCalledOnce();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
	});

	it('downloadDataUrl sets href + download and clicks', () => {
		downloadDataUrl('data:image/png;base64,AAAA', 'slide-1.png');
		expect(anchor.href).toBe('data:image/png;base64,AAAA');
		expect(anchor.download).toBe('slide-1.png');
		expect(anchor.click).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(200);
		expect(anchor.remove).toHaveBeenCalledOnce();
	});
});

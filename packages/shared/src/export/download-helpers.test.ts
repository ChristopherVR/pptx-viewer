import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	dataUrlToBlob,
	downloadBlob,
	downloadDataUrl,
	openUrlInNewTab,
	resolveExportBaseName,
	sanitizeDownloadFilename,
} from './download-helpers';

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
		const long = `${'a'.repeat(300)}.pptx`,
			out = sanitizeDownloadFilename(long);
		expect(out).toHaveLength(200);
		expect(out.endsWith('.pptx')).toBeTruthy();
	});

	it('passes through a clean name unchanged', () => {
		expect(sanitizeDownloadFilename('My Deck (final).pptx')).toBe('My Deck (final).pptx');
	});
});

describe('resolveExportBaseName', () => {
	it('falls back to "presentation" when the source name is undefined', () => {
		expect(resolveExportBaseName(undefined)).toBe('presentation');
	});

	it('falls back to "presentation" when the trimmed result is empty', () => {
		expect(resolveExportBaseName('   ')).toBe('presentation');
		expect(resolveExportBaseName('.pptx')).toBe('presentation');
	});

	it('trims whitespace around the source name', () => {
		expect(resolveExportBaseName('  My Deck  ')).toBe('My Deck');
	});

	it('strips the default extension set (pptx, pdf, png, gif, webm), case-insensitively', () => {
		expect(resolveExportBaseName('Deck.pptx')).toBe('Deck');
		expect(resolveExportBaseName('Deck.PDF')).toBe('Deck');
		expect(resolveExportBaseName('Deck.png')).toBe('Deck');
		expect(resolveExportBaseName('Deck.gif')).toBe('Deck');
		expect(resolveExportBaseName('Deck.webm')).toBe('Deck');
	});

	it('leaves an unrecognised extension untouched', () => {
		expect(resolveExportBaseName('Deck.ppt')).toBe('Deck.ppt');
		expect(resolveExportBaseName('Deck.txt')).toBe('Deck.txt');
	});

	it('only strips a single trailing extension, not an embedded one', () => {
		expect(resolveExportBaseName('report.v2.pptx')).toBe('report.v2');
	});

	it('accepts a custom extension set, overriding the default', () => {
		expect(resolveExportBaseName('deck.pptx', ['png'])).toBe('deck.pptx');
		expect(resolveExportBaseName('deck.png', ['png'])).toBe('deck');
	});
});

describe('downloadBlob / downloadDataUrl', () => {
	let anchor: FakeAnchor,
		createObjectURL: ReturnType<typeof vi.fn>,
		revokeObjectURL: ReturnType<typeof vi.fn>,
		appendChild: ReturnType<typeof vi.fn>;

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

	it('downloadBlob sanitizes a hostile filename before setting download', () => {
		const blob = { size: 1 } as Blob;
		downloadBlob(blob, '../../etc/passwd\r\n.pptx');
		expect(anchor.download).toBe('______etc_passwd__.pptx');
	});

	it('downloadDataUrl sanitizes a hostile filename before setting download', () => {
		downloadDataUrl('data:image/png;base64,AAAA', 'con"*?.png');
		expect(anchor.download).toBe('con___.png');
	});
});

describe('dataUrlToBlob', () => {
	it('decodes a base64 data URL into a Blob with the right MIME + bytes', async () => {
		// "hi" -> base64 "aGk=".
		const blob = dataUrlToBlob('data:text/plain;base64,aGk=');
		expect(blob).toBeInstanceOf(Blob);
		expect(blob?.type).toBe('text/plain');
		await expect(blob?.text()).resolves.toBe('hi');
	});

	it('decodes a percent-encoded (non-base64) data URL', async () => {
		const blob = dataUrlToBlob('data:text/plain,hi%20there');
		expect(blob?.type).toBe('text/plain');
		await expect(blob?.text()).resolves.toBe('hi there');
	});

	it('defaults the MIME type when the data URL omits it', () => {
		const blob = dataUrlToBlob('data:;base64,aGk=');
		expect(blob?.type).toBe('application/octet-stream');
	});

	it('returns undefined for a non-data URL', () => {
		expect(dataUrlToBlob('https://example.com/x.pdf')).toBeUndefined();
		expect(dataUrlToBlob('not a url')).toBeUndefined();
	});
});

describe('openUrlInNewTab', () => {
	let open: ReturnType<typeof vi.fn>,
		createObjectURL: ReturnType<typeof vi.fn>,
		revokeObjectURL: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		// Returned window handle whose `opener` the helper severs.
		open = vi.fn().mockReturnValue({ opener: {} });
		createObjectURL = vi.fn().mockReturnValue('blob:opened');
		revokeObjectURL = vi.fn();
		vi.stubGlobal('window', { open });
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('opens a data URL via a Blob object URL, then revokes it', () => {
		openUrlInNewTab('data:application/pdf;base64,JVBERi0=');
		expect(createObjectURL).toHaveBeenCalledOnce();
		expect(open).toHaveBeenCalledWith('blob:opened', '_blank');
		expect(revokeObjectURL).not.toHaveBeenCalled();
		vi.advanceTimersByTime(60_000);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:opened');
	});

	it('opens a non-data URL as-is without creating an object URL', () => {
		openUrlInNewTab('https://example.com/x.pdf');
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(open).toHaveBeenCalledWith('https://example.com/x.pdf', '_blank');
	});
});

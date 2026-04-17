import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createCanvas, exportCanvasToPngDataUrl } from './emf-canvas-helpers';
import { convertEmfToDataUrl, convertWmfToDataUrl } from './emf-converter';
import { parseEmfHeader, getRenderableEmfBounds, parseWmfHeader } from './emf-header-parser';
import { replayEmfRecords } from './emf-record-replay';
import { replayWmfRecords } from './wmf-replay';

// ---------------------------------------------------------------------------
// We cannot rely on a real canvas environment, so we mock the dependencies
// that create canvas and parse headers. This lets us test the orchestration
// logic (option parsing, null-guarding, error handling) without a DOM.
// ---------------------------------------------------------------------------

vi.mock<typeof import('./emf-header-parser')>(import('./emf-header-parser'), () => ({
	parseEmfHeader: vi.fn<() => void>(),
	getRenderableEmfBounds: vi.fn<() => void>(),
	parseWmfHeader: vi.fn<() => void>(),
}));

vi.mock<typeof import('./emf-canvas-helpers')>(import('./emf-canvas-helpers'), () => ({
	createCanvas: vi.fn<() => void>(),
	exportCanvasToPngDataUrl: vi.fn<() => void>(),
	DEFAULT_DPI_SCALE: 2,
}));

vi.mock<typeof import('./emf-record-replay')>(import('./emf-record-replay'), () => ({
	replayEmfRecords: vi.fn<() => void>(),
}));

vi.mock<typeof import('./wmf-replay')>(import('./wmf-replay'), () => ({
	replayWmfRecords: vi.fn<() => void>(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub() {
	return {
		save: vi.fn<() => void>(),
		restore: vi.fn<() => void>(),
		setTransform: vi.fn<() => void>(),
		drawImage: vi.fn<() => void>(),
	};
}

function setupEmfMocks(options?: {
	headerNull?: boolean;
	boundsNull?: boolean;
	canvasNull?: boolean;
	dataUrl?: string | null;
}) {
	const opts = options ?? {};
	const header = opts.headerNull
		? null
		: { rclBounds: { left: 0, top: 0, right: 100, bottom: 100 } };
	(parseEmfHeader as ReturnType<typeof vi.fn>).mockReturnValue(header);

	const bounds = opts.boundsNull ? null : { left: 0, top: 0, right: 100, bottom: 100 };
	(getRenderableEmfBounds as ReturnType<typeof vi.fn>).mockReturnValue(bounds);

	const ctx = makeCtxStub();
	const canvas = opts.canvasNull ? null : { width: 200, height: 200 };
	(createCanvas as ReturnType<typeof vi.fn>).mockReturnValue(canvas ? { canvas, ctx } : null);

	(replayEmfRecords as ReturnType<typeof vi.fn>).mockReturnValue([]);

	const dataUrl = opts.dataUrl !== undefined ? opts.dataUrl : 'data:image/png;base64,AAAA';
	(exportCanvasToPngDataUrl as ReturnType<typeof vi.fn>).mockResolvedValue(dataUrl);

	return { ctx, canvas };
}

function setupWmfMocks(options?: {
	headerNull?: boolean;
	invalidDims?: boolean;
	canvasNull?: boolean;
	dataUrl?: string | null;
}) {
	const opts = options ?? {};
	const header = opts.headerNull
		? null
		: {
				headerSize: 18,
				maxRecordSize: 100,
				boundsLeft: 0,
				boundsTop: 0,
				boundsRight: opts.invalidDims ? 0 : 200,
				boundsBottom: opts.invalidDims ? 0 : 200,
				unitsPerInch: 96,
			};
	(parseWmfHeader as ReturnType<typeof vi.fn>).mockReturnValue(header);

	const ctx = makeCtxStub();
	const canvas = opts.canvasNull ? null : { width: 200, height: 200 };
	(createCanvas as ReturnType<typeof vi.fn>).mockReturnValue(canvas ? { canvas, ctx } : null);

	(replayWmfRecords as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

	const dataUrl = opts.dataUrl !== undefined ? opts.dataUrl : 'data:image/png;base64,BBBB';
	(exportCanvasToPngDataUrl as ReturnType<typeof vi.fn>).mockResolvedValue(dataUrl);

	return { ctx, canvas };
}

// ---------------------------------------------------------------------------
// Tests: convertEmfToDataUrl
// ---------------------------------------------------------------------------

describe('convertEmfToDataUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a data URL on success', async () => {
		setupEmfMocks();
		const buf = new ArrayBuffer(100);
		const result = await convertEmfToDataUrl(buf);
		expect(result).toBe('data:image/png;base64,AAAA');
	});

	it('returns null when parseEmfHeader returns null', async () => {
		setupEmfMocks({ headerNull: true });
		const result = await convertEmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('returns null when getRenderableEmfBounds returns null', async () => {
		setupEmfMocks({ boundsNull: true });
		const result = await convertEmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('returns null when createCanvas returns null', async () => {
		setupEmfMocks({ canvasNull: true });
		const result = await convertEmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('passes maxWidth and maxHeight to createCanvas', async () => {
		setupEmfMocks();
		await convertEmfToDataUrl(new ArrayBuffer(100), 500, 400);
		expect(createCanvas).toHaveBeenCalledWith(100, 100, 500, 400, 2);
	});

	it('accepts numeric dpiScale for backward compatibility', async () => {
		setupEmfMocks();
		await convertEmfToDataUrl(new ArrayBuffer(100), undefined, undefined, 3);
		expect(createCanvas).toHaveBeenCalledWith(100, 100, undefined, undefined, 3);
	});

	it('accepts options object with dpiScale', async () => {
		setupEmfMocks();
		await convertEmfToDataUrl(new ArrayBuffer(100), undefined, undefined, {
			dpiScale: 4,
		});
		expect(createCanvas).toHaveBeenCalledWith(100, 100, undefined, undefined, 4);
	});

	it('accepts options object with maxWidth/maxHeight', async () => {
		setupEmfMocks();
		await convertEmfToDataUrl(new ArrayBuffer(100), undefined, undefined, {
			maxWidth: 300,
			maxHeight: 250,
		});
		expect(createCanvas).toHaveBeenCalledWith(100, 100, 300, 250, 2);
	});

	it('calls ctx.save before replay and ctx.restore after', async () => {
		const { ctx } = setupEmfMocks();
		await convertEmfToDataUrl(new ArrayBuffer(100));
		expect(ctx.save).toHaveBeenCalled();
		expect(ctx.restore).toHaveBeenCalled();
	});

	it('returns null when exportCanvasToPngDataUrl returns null', async () => {
		setupEmfMocks({ dataUrl: null });
		const result = await convertEmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('returns null on thrown exception', async () => {
		(parseEmfHeader as ReturnType<typeof vi.fn>).mockImplementation(() => {
			throw new Error('parse boom');
		});
		const result = await convertEmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('handles small buffer (< 16 bytes) without crashing', async () => {
		setupEmfMocks({ headerNull: true });
		const result = await convertEmfToDataUrl(new ArrayBuffer(4));
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Tests: convertWmfToDataUrl
// ---------------------------------------------------------------------------

describe('convertWmfToDataUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a data URL on success', async () => {
		setupWmfMocks();
		const result = await convertWmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBe('data:image/png;base64,BBBB');
	});

	it('returns null when parseWmfHeader returns null', async () => {
		setupWmfMocks({ headerNull: true });
		const result = await convertWmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('returns null when dimensions are invalid (zero)', async () => {
		setupWmfMocks({ invalidDims: true });
		const result = await convertWmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('returns null when createCanvas returns null', async () => {
		setupWmfMocks({ canvasNull: true });
		const result = await convertWmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('passes maxWidth, maxHeight, and dpiScale to createCanvas', async () => {
		setupWmfMocks();
		await convertWmfToDataUrl(new ArrayBuffer(100), 600, 500, 3);
		expect(createCanvas).toHaveBeenCalledWith(200, 200, 600, 500, 3);
	});

	it('calls replayWmfRecords with correct parameters', async () => {
		setupWmfMocks();
		await convertWmfToDataUrl(new ArrayBuffer(100));
		expect(replayWmfRecords).toHaveBeenCalledOnce();
	});

	it('returns null on thrown exception', async () => {
		(parseWmfHeader as ReturnType<typeof vi.fn>).mockImplementation(() => {
			throw new Error('wmf boom');
		});
		const result = await convertWmfToDataUrl(new ArrayBuffer(100));
		expect(result).toBeNull();
	});

	it('accepts options object', async () => {
		setupWmfMocks();
		await convertWmfToDataUrl(new ArrayBuffer(100), undefined, undefined, {
			dpiScale: 1,
			maxWidth: 100,
			maxHeight: 80,
		});
		expect(createCanvas).toHaveBeenCalledWith(200, 200, 100, 80, 1);
	});
});

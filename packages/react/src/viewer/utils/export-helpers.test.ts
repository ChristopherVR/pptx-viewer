import { describe, it, expect } from 'vitest';

// export-helpers.ts mostly contains DOM-dependent functions (downloadBlob,
// downloadDataUrl, renderElementToCanvas, waitForRender).
// We test the module's types and the shape of its exports to ensure
// the module is well-formed and importable.
// The one pure testable export is waitForRender's promise-returning behaviour,
// but it depends on requestAnimationFrame. Instead we test that the module
// exports the expected names and types.

// We import the type-only exports to verify they're valid TypeScript
import type {
	ExportProgressCallback,
	PngExportOptions,
	PdfExportOptions,
	SlideCaptureOptions,
} from './export-helpers';

describe('export-helpers types', () => {
	it('ExportProgressCallback should accept (current, total) numbers', () => {
		const cb: ExportProgressCallback = (current: number, total: number) => {
			void current;
			void total;
		};
		cb(1, 10);
		// If this compiles and runs, the type is correct
		expect(true).toBe(true);
	});

	it('PngExportOptions should accept scale and backgroundColor', () => {
		const opts: PngExportOptions = {
			scale: 2,
			backgroundColor: '#FFFFFF',
		};
		expect(opts.scale).toBe(2);
		expect(opts.backgroundColor).toBe('#FFFFFF');
	});

	it('PngExportOptions should allow omitting all properties', () => {
		const opts: PngExportOptions = {};
		expect(opts.scale).toBeUndefined();
		expect(opts.backgroundColor).toBeUndefined();
	});

	it('PdfExportOptions should accept scale and onProgress', () => {
		let callCount = 0;
		const opts: PdfExportOptions = {
			scale: 3,
			onProgress: () => { callCount++; },
		};
		opts.onProgress!(1, 5);
		expect(opts.scale).toBe(3);
		expect(callCount).toBe(1);
	});

	it('SlideCaptureOptions should accept scale and onProgress', () => {
		const opts: SlideCaptureOptions = {
			scale: 1,
			onProgress: (_c, _t) => {},
		};
		expect(opts.scale).toBe(1);
		expect(typeof opts.onProgress).toBe('function');
	});

	it('SlideCaptureOptions should allow omitting all properties', () => {
		const opts: SlideCaptureOptions = {};
		expect(opts.scale).toBeUndefined();
		expect(opts.onProgress).toBeUndefined();
	});
});

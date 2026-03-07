import { describe, it, expect } from 'vitest';
import { convertEmfToDataUrl, convertWmfToDataUrl } from './index';

describe('emf-converter exports', () => {
	it('should export convertEmfToDataUrl', () => {
		expect(typeof convertEmfToDataUrl).toBe('function');
	});

	it('should export convertWmfToDataUrl', () => {
		expect(typeof convertWmfToDataUrl).toBe('function');
	});

	it('should return null for empty EMF buffer', async () => {
		const result = await convertEmfToDataUrl(new ArrayBuffer(0));
		expect(result).toBeNull();
	});

	it('should return null for empty WMF buffer', async () => {
		const result = await convertWmfToDataUrl(new ArrayBuffer(0));
		expect(result).toBeNull();
	});
});

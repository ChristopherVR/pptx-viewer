import { describe, it, expect } from 'vitest';
import { generateElementId } from './generate-id';

describe('generateElementId', () => {
	it('should return a string', () => {
		const id = generateElementId();
		expect(typeof id).toBe('string');
	});

	it('should start with "el-" prefix', () => {
		const id = generateElementId();
		expect(id.startsWith('el-')).toBe(true);
	});

	it('should contain a timestamp component', () => {
		const before = Date.now();
		const id = generateElementId();
		const after = Date.now();
		// Extract timestamp part between first and second dash
		const parts = id.split('-');
		const timestamp = Number(parts[1]);
		expect(timestamp).toBeGreaterThanOrEqual(before);
		expect(timestamp).toBeLessThanOrEqual(after);
	});

	it('should contain a random suffix', () => {
		const id = generateElementId();
		const parts = id.split('-');
		// Third part is the random suffix
		expect(parts[2]).toBeDefined();
		expect(parts[2].length).toBeGreaterThan(0);
	});

	it('should generate unique IDs on successive calls', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateElementId());
		}
		expect(ids.size).toBe(100);
	});

	it('should have the format el-<timestamp>-<random>', () => {
		const id = generateElementId();
		const match = /^el-\d+-[a-z0-9]+$/.test(id);
		expect(match).toBe(true);
	});
});

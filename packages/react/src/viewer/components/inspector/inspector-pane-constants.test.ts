import { describe, it, expect, expectTypeOf } from 'vitest';

import { INSPECTOR_TABS, HEADING, CARD, INPUT, BTN, POS_FIELDS } from './inspector-pane-constants';

describe('inspector-pane-constants', () => {
	describe('iNSPECTOR_TABS', () => {
		it('is a non-empty array', () => {
			expect(Array.isArray(INSPECTOR_TABS)).toBeTruthy();
			expect(INSPECTOR_TABS.length).toBeGreaterThan(0);
		});

		it('has no duplicate keys', () => {
			const keys = INSPECTOR_TABS.map((t) => t.key);
			expect(new Set(keys).size).toBe(keys.length);
		});

		it('contains expected tab keys', () => {
			const keys = INSPECTOR_TABS.map((t) => t.key);
			expect(keys).toContain('elements');
			expect(keys).toContain('properties');
			expect(keys).toContain('comments');
		});

		it('every entry has key, label, and icon', () => {
			for (const tab of INSPECTOR_TABS) {
				expectTypeOf(tab.key).toBeString();
				expect(tab.key.length).toBeGreaterThan(0);
				expectTypeOf(tab.label).toBeString();
				expect(tab.label.length).toBeGreaterThan(0);
				expect(tab.icon).toBeDefined();
			}
		});

		it('has no duplicate labels', () => {
			const labels = INSPECTOR_TABS.map((t) => t.label);
			expect(new Set(labels).size).toBe(labels.length);
		});
	});

	describe('cSS class tokens', () => {
		it('hEADING is a non-empty string', () => {
			expectTypeOf(HEADING).toBeString();
			expect(HEADING.length).toBeGreaterThan(0);
		});

		it('cARD is a non-empty string', () => {
			expectTypeOf(CARD).toBeString();
			expect(CARD.length).toBeGreaterThan(0);
		});

		it('iNPUT is a non-empty string', () => {
			expectTypeOf(INPUT).toBeString();
			expect(INPUT.length).toBeGreaterThan(0);
		});

		it('bTN is a non-empty string', () => {
			expectTypeOf(BTN).toBeString();
			expect(BTN.length).toBeGreaterThan(0);
		});
	});

	describe('pOS_FIELDS', () => {
		it('is a 4-element tuple', () => {
			expect(POS_FIELDS).toHaveLength(4);
		});

		it('contains expected label-key pairs', () => {
			expect(POS_FIELDS[0]).toStrictEqual(['X', 'x']);
			expect(POS_FIELDS[1]).toStrictEqual(['Y', 'y']);
			expect(POS_FIELDS[2]).toStrictEqual(['W', 'width']);
			expect(POS_FIELDS[3]).toStrictEqual(['H', 'height']);
		});

		it('has no duplicate labels', () => {
			const labels = POS_FIELDS.map((f) => f[0]);
			expect(new Set(labels).size).toBe(labels.length);
		});

		it('has no duplicate keys', () => {
			const keys = POS_FIELDS.map((f) => f[1]);
			expect(new Set(keys).size).toBe(keys.length);
		});
	});
});

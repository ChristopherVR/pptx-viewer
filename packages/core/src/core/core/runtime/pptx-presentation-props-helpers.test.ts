import { describe, it, expect } from 'vitest';
import { parseShowProperties } from './pptx-presentation-props-helpers';

describe('parseShowProperties', () => {
	it('should detect "presented" show type from p:present', () => {
		const result = parseShowProperties({ 'p:present': {} });
		expect(result.showType).toBe('presented');
	});

	it('should detect "browsed" show type from p:browse', () => {
		const result = parseShowProperties({ 'p:browse': {} });
		expect(result.showType).toBe('browsed');
	});

	it('should detect "kiosk" show type from p:kiosk', () => {
		const result = parseShowProperties({ 'p:kiosk': {} });
		expect(result.showType).toBe('kiosk');
	});

	it('should leave showType undefined when no mode element is present', () => {
		const result = parseShowProperties({});
		expect(result.showType).toBeUndefined();
	});

	it('should parse loopContinuously when @_loop is "1"', () => {
		const result = parseShowProperties({ '@_loop': '1' });
		expect(result.loopContinuously).toBe(true);
	});

	it('should parse loopContinuously when @_loop is boolean true', () => {
		const result = parseShowProperties({ '@_loop': true });
		expect(result.loopContinuously).toBe(true);
	});

	it('should parse loopContinuously as false when @_loop is absent', () => {
		const result = parseShowProperties({});
		expect(result.loopContinuously).toBe(false);
	});

	it('should default showWithNarration to true when @_showNarration is absent', () => {
		const result = parseShowProperties({});
		expect(result.showWithNarration).toBe(true);
	});

	it('should parse showWithNarration as false when @_showNarration is "0"', () => {
		const result = parseShowProperties({ '@_showNarration': '0' });
		expect(result.showWithNarration).toBe(false);
	});

	it('should default showWithAnimation to true when @_showAnimation is absent', () => {
		const result = parseShowProperties({});
		expect(result.showWithAnimation).toBe(true);
	});

	it('should parse showWithAnimation as false when @_showAnimation is "0"', () => {
		const result = parseShowProperties({ '@_showAnimation': '0' });
		expect(result.showWithAnimation).toBe(false);
	});

	it('should parse advanceMode as "manual" when @_useTimings is "0"', () => {
		const result = parseShowProperties({ '@_useTimings': '0' });
		expect(result.advanceMode).toBe('manual');
	});

	it('should default advanceMode to "useTimings"', () => {
		const result = parseShowProperties({});
		expect(result.advanceMode).toBe('useTimings');
	});

	it('should parse pen colour from p:penClr > a:srgbClr', () => {
		const result = parseShowProperties({
			'p:penClr': {
				'a:srgbClr': { '@_val': 'FF0000' },
			},
		});
		expect(result.penColor).toBe('#FF0000');
	});

	it('should not set penColor when p:penClr is absent', () => {
		const result = parseShowProperties({});
		expect(result.penColor).toBeUndefined();
	});

	it('should not set penColor when srgbClr val is empty', () => {
		const result = parseShowProperties({
			'p:penClr': {
				'a:srgbClr': { '@_val': '' },
			},
		});
		expect(result.penColor).toBeUndefined();
	});

	it('should parse slide range from p:sldRg', () => {
		const result = parseShowProperties({
			'p:sldRg': { '@_st': '3', '@_end': '7' },
		});
		expect(result.showSlidesMode).toBe('range');
		expect(result.showSlidesFrom).toBe(3);
		expect(result.showSlidesTo).toBe(7);
	});

	it('should parse custom show from p:custShow', () => {
		const result = parseShowProperties({
			'p:custShow': { '@_id': '42' },
		});
		expect(result.showSlidesMode).toBe('customShow');
		expect(result.showSlidesCustomShowId).toBe('42');
	});

	it('should default showSlidesMode to "all" when neither range nor custom show', () => {
		const result = parseShowProperties({});
		expect(result.showSlidesMode).toBe('all');
	});

	it('should handle a fully populated show properties object', () => {
		const result = parseShowProperties({
			'p:kiosk': {},
			'@_loop': '1',
			'@_showNarration': '0',
			'@_showAnimation': '0',
			'@_useTimings': '0',
			'p:penClr': { 'a:srgbClr': { '@_val': '00FF00' } },
			'p:sldRg': { '@_st': '1', '@_end': '10' },
		});
		expect(result.showType).toBe('kiosk');
		expect(result.loopContinuously).toBe(true);
		expect(result.showWithNarration).toBe(false);
		expect(result.showWithAnimation).toBe(false);
		expect(result.advanceMode).toBe('manual');
		expect(result.penColor).toBe('#00FF00');
		expect(result.showSlidesMode).toBe('range');
		expect(result.showSlidesFrom).toBe(1);
		expect(result.showSlidesTo).toBe(10);
	});
});

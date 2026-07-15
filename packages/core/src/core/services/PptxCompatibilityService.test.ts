import { describe, it, expect, vi } from 'vitest';

import { PptxCompatibilityService } from './PptxCompatibilityService';
import type { CompatibilityWarningInput } from './PptxCompatibilityService';

describe('pptxCompatibilityService', () => {
	describe('getXmlLocalName', () => {
		it('returns empty string for empty input', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('')).toBe('');
		});

		it('returns the key as-is when no namespace prefix', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('cTn')).toBe('cTn');
		});

		it('strips single namespace prefix', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('p:cTn')).toBe('cTn');
		});

		it('strips nested namespace prefix (uses last colon)', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('a:p:something')).toBe('something');
		});

		it('strips @_ attribute prefix before processing namespace', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('@_r:embed')).toBe('embed');
		});

		it('strips @_ attribute prefix when no namespace', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('@_id')).toBe('id');
		});

		it('handles @_ prefix alone on namespace-only key', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('@_xsi:type')).toBe('type');
		});

		it('handles complex namespace like p14', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getXmlLocalName('p14:vortex')).toBe('vortex');
		});
	});

	describe('reportWarning / getWarnings / resetWarnings', () => {
		it('initially returns empty warnings array', () => {
			const svc = new PptxCompatibilityService();
			expect(svc.getWarnings()).toStrictEqual([]);
		});

		it('adds a warning and retrieves it', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.reportWarning({
				code: 'TEST001',
				message: 'Test warning',
				scope: 'presentation',
			});
			const warnings = svc.getWarnings();
			expect(warnings).toHaveLength(1);
			expect(warnings[0].code).toBe('TEST001');
			expect(warnings[0].message).toBe('Test warning');
			expect(warnings[0].severity).toBe('warning');
			vi.restoreAllMocks();
		});

		it('deduplicates warnings with same code, scope, and slideId', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			const warning: CompatibilityWarningInput = {
				code: 'DUP001',
				message: 'Duplicate warning',
				scope: 'slide',
				slideId: 'slide1',
			};
			svc.reportWarning(warning);
			svc.reportWarning(warning);
			expect(svc.getWarnings()).toHaveLength(1);
			vi.restoreAllMocks();
		});

		it('does not deduplicate warnings with different slide IDs', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.reportWarning({
				code: 'TEST001',
				message: 'Warning A',
				scope: 'slide',
				slideId: 'slide1',
			});
			svc.reportWarning({
				code: 'TEST001',
				message: 'Warning B',
				scope: 'slide',
				slideId: 'slide2',
			});
			expect(svc.getWarnings()).toHaveLength(2);
			vi.restoreAllMocks();
		});

		it("uses 'info' severity and logs via console.info", () => {
			const svc = new PptxCompatibilityService();
			const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
			svc.reportWarning({
				code: 'INFO001',
				message: 'Info message',
				severity: 'info',
				scope: 'presentation',
			});
			expect(svc.getWarnings()[0].severity).toBe('info');
			expect(infoSpy).toHaveBeenCalledWith(
				'[PptxHandler][info] INFO001 (presentation) Info message',
			);
			vi.restoreAllMocks();
		});

		it('resetWarnings clears all accumulated warnings', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.reportWarning({
				code: 'TEST001',
				message: 'Test',
				scope: 'presentation',
			});
			expect(svc.getWarnings()).toHaveLength(1);
			svc.resetWarnings();
			expect(svc.getWarnings()).toStrictEqual([]);
			vi.restoreAllMocks();
		});

		it('after reset, same warning can be reported again', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			const warning: CompatibilityWarningInput = {
				code: 'TEST001',
				message: 'Test',
				scope: 'presentation',
			};
			svc.reportWarning(warning);
			svc.resetWarnings();
			svc.reportWarning(warning);
			expect(svc.getWarnings()).toHaveLength(1);
			vi.restoreAllMocks();
		});

		it('getWarnings returns copies of warnings (not references)', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.reportWarning({
				code: 'TEST001',
				message: 'Original',
				scope: 'presentation',
			});
			const warnings = svc.getWarnings();
			warnings[0].message = 'Modified';
			const warningsAgain = svc.getWarnings();
			expect(warningsAgain[0].message).toBe('Original');
			vi.restoreAllMocks();
		});

		it('includes optional fields like slideId, elementId, xmlPath', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.reportWarning({
				code: 'TEST001',
				message: 'Test',
				scope: 'element',
				slideId: 's1',
				elementId: 'e1',
				xmlPath: '/p:sld/p:cSld/p:spTree',
			});
			const w = svc.getWarnings()[0];
			expect(w.slideId).toBe('s1');
			expect(w.elementId).toBe('e1');
			expect(w.xmlPath).toBe('/p:sld/p:cSld/p:spTree');
			vi.restoreAllMocks();
		});
	});

	describe('compatibility inspection', () => {
		it('inspectPresentationCompatibility runs without error', () => {
			const svc = new PptxCompatibilityService();
			expect(() => svc.inspectPresentationCompatibility()).not.toThrow();
		});

		it('inspectSlideCompatibility runs without error', () => {
			const svc = new PptxCompatibilityService();
			expect(() => svc.inspectSlideCompatibility({}, 'ppt/slides/slide1.xml')).not.toThrow();
		});

		it('inspectShapeCompatibility runs without error', () => {
			const svc = new PptxCompatibilityService();
			expect(() => svc.inspectShapeCompatibility(undefined, undefined, 's1', 'e1')).not.toThrow();
		});

		it('inspectPictureCompatibility runs without error', () => {
			const svc = new PptxCompatibilityService();
			expect(() => svc.inspectPictureCompatibility(undefined, undefined, 's1', 'e1')).not.toThrow();
		});

		it('inspectGraphicFrameCompatibility runs without error', () => {
			const svc = new PptxCompatibilityService();
			expect(() => svc.inspectGraphicFrameCompatibility('table', 's1', 'e1')).not.toThrow();
		});

		it('reports unmodelled presentation, slide, and element markup', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.inspectPresentationCompatibility({ 'p:presentation': { 'p:futureList': {} } });
			svc.inspectSlideCompatibility({ 'p:sld': { 'p:futureFeature': {} } }, 's1');
			svc.inspectShapeCompatibility({ 'a:future3d': {} }, undefined, 's1', 'e1');
			expect(svc.getWarnings().map((warning) => warning.code)).toStrictEqual([
				'UNMODELLED_PRESENTATION_MARKUP',
				'UNMODELLED_SLIDE_MARKUP',
				'UNMODELLED_SHAPE_PROPERTY',
			]);
			vi.restoreAllMocks();
		});

		it('reports unsupported AlternateContent choices with fallback severity', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'info').mockImplementation(() => {});
			svc.inspectSlideCompatibility(
				{
					'p:sld': {
						'p:cSld': {
							'mc:AlternateContent': {
								'mc:Choice': { '@_Requires': 'p14', 'p14:futureFeature': {} },
								'mc:Fallback': { 'p:sp': {} },
							},
						},
					},
				},
				's1',
			);
			expect(svc.getWarnings()[0]).toMatchObject({
				code: 'UNSUPPORTED_ALTERNATE_CONTENT_CHOICE',
				severity: 'info',
			});
			vi.restoreAllMocks();
		});

		it('classifies partial graphic frames and legacy media references', () => {
			const svc = new PptxCompatibilityService();
			vi.spyOn(console, 'info').mockImplementation(() => {});
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			svc.inspectGraphicFrameCompatibility('smartArt', 's1', 'e1');
			svc.inspectGraphicFrameCompatibility('unknown', 's1', 'e2');
			svc.inspectMediaReferenceCompatibility('wavAudioFile', 's1', 'e3');
			svc.inspectMediaReferenceCompatibility('audioCd', 's1', 'e4');
			svc.inspectMediaReferenceCompatibility('quickTimeFile', 's1', 'e5');
			svc.inspectSlideSynchronizationCompatibility('s1');
			expect(svc.getWarnings().map((warning) => warning.code)).toStrictEqual([
				'PARTIAL_SMARTART_SUPPORT',
				'UNSUPPORTED_GRAPHIC_FRAME',
				'LEGACY_AUDIO_CD_REFERENCE',
				'LEGACY_QUICKTIME_REFERENCE',
				'SLIDE_SYNCHRONIZATION_METADATA',
			]);
			vi.restoreAllMocks();
		});
	});
});

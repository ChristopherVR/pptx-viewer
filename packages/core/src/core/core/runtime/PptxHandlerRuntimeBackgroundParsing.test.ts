import { describe, it, expect } from 'vitest';

import { blendColorOntoWhite } from '../../color/color-primitives';

// Since extractBackgroundColor is a protected method on a deeply chained mixin,
// we extract its pure-logic portion and test it directly.
// The method delegates to this.parseColor() / this.extractColorOpacity() for
// actual colour/opacity resolution, so we test the structural XML navigation,
// alpha-blending, and fallback logic. `blendColorOntoWhite` itself is the real
// implementation from `color-primitives.ts` (its own unit coverage lives in
// `color-primitives.test.ts`), so this file exercises the real blend maths as
// wired into the background-resolution structure.

// --- Minimal scheme-colour resolver stub used only by the schemeClr test ---
const THEME_COLORS: Record<string, string> = { accent1: '4472C4' };

// --- Minimal parseColor stub: returns hex from a:srgbClr / a:schemeClr ---
function parseColor(node: Record<string, unknown> | undefined): string | undefined {
	if (!node) {
		return undefined;
	}
	const srgb = node['a:srgbClr'] as Record<string, unknown> | undefined;
	if (srgb) {
		const val = String(srgb['@_val'] || '').trim();
		return val.length > 0 ? `#${val}` : undefined;
	}
	const scheme = node['a:schemeClr'] as Record<string, unknown> | undefined;
	if (scheme) {
		const val = String(scheme['@_val'] || '').trim();
		return THEME_COLORS[val] ? `#${THEME_COLORS[val]}` : undefined;
	}
	return undefined;
}

// --- Minimal extractColorOpacity stub: reads a:alpha/@_val (thousandths of a percent) ---
function extractColorOpacity(node: Record<string, unknown> | undefined): number | undefined {
	if (!node) {
		return undefined;
	}
	const choice =
		(node['a:srgbClr'] as Record<string, unknown> | undefined) ??
		(node['a:schemeClr'] as Record<string, unknown> | undefined);
	const alpha = choice?.['a:alpha'] as Record<string, unknown> | undefined;
	if (!alpha) {
		return undefined;
	}
	const raw = Number.parseInt(String(alpha['@_val'] ?? ''), 10);
	return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw / 100000)) : undefined;
}

// --- Extracted from extractBackgroundColor ---
function extractBackgroundColor(
	slideXml: Record<string, unknown>,
	rootElement: string = 'p:sld',
): string | undefined {
	try {
		const root = slideXml[rootElement] as Record<string, unknown> | undefined;
		const bg = (root?.['p:cSld'] as Record<string, unknown> | undefined)?.['p:bg'] as
			| Record<string, unknown>
			| undefined;
		if (!bg) {
			return undefined;
		}

		// Try solid fill from bgPr
		const bgPr = bg['p:bgPr'] as Record<string, unknown> | undefined;
		if (bgPr) {
			const solidFill = bgPr['a:solidFill'] as Record<string, unknown> | undefined;
			if (solidFill) {
				const color = parseColor(solidFill);
				return color ? blendColorOntoWhite(color, extractColorOpacity(solidFill)) : color;
			}
			// Pattern fill foreground colour as fallback
			const pattFill = bgPr['a:pattFill'] as Record<string, unknown> | undefined;
			if (pattFill) {
				const fgClrNode = pattFill['a:fgClr'] as Record<string, unknown> | undefined;
				const fgClr = parseColor(fgClrNode);
				if (fgClr) {
					return blendColorOntoWhite(fgClr, extractColorOpacity(fgClrNode));
				}
				const bgClrNode = pattFill['a:bgClr'] as Record<string, unknown> | undefined;
				const bgClr = parseColor(bgClrNode);
				if (bgClr) {
					return blendColorOntoWhite(bgClr, extractColorOpacity(bgClrNode));
				}
			}
		}

		// Try bgRef
		const bgRef = bg['p:bgRef'] as Record<string, unknown> | undefined;
		if (bgRef) {
			const solidFill = bgRef['a:solidFill'] as Record<string, unknown> | undefined;
			if (solidFill) {
				const color = parseColor(solidFill);
				return color ? blendColorOntoWhite(color, extractColorOpacity(solidFill)) : color;
			}
			const refColor = parseColor(bgRef);
			if (refColor) {
				return blendColorOntoWhite(refColor, extractColorOpacity(bgRef));
			}
			return '#FFFFFF';
		}
	} catch {
		// Ignore
	}
	return undefined;
}

// --- Extracted: check if background has a gradient fill ---
function hasBackgroundGradient(
	slideXml: Record<string, unknown>,
	rootElement: string = 'p:sld',
): boolean {
	const root = slideXml[rootElement] as Record<string, unknown> | undefined;
	const bg = (root?.['p:cSld'] as Record<string, unknown> | undefined)?.['p:bg'] as
		| Record<string, unknown>
		| undefined;
	if (!bg) {
		return false;
	}
	const bgPr = bg['p:bgPr'] as Record<string, unknown> | undefined;
	if (bgPr && bgPr['a:gradFill']) {
		return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// extractBackgroundColor
// ---------------------------------------------------------------------------
describe('extractBackgroundColor', () => {
	it('should return undefined when no background is present', () => {
		expect(
			extractBackgroundColor({
				'p:sld': { 'p:cSld': {} },
			}),
		).toBeUndefined();
	});

	it('should return undefined when slideXml has no root element', () => {
		expect(extractBackgroundColor({})).toBeUndefined();
	});

	it('should extract solid fill color from bgPr', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:solidFill': {
								'a:srgbClr': { '@_val': 'FF0000' },
							},
						},
					},
				},
			},
		});
		expect(result).toBe('#FF0000');
	});

	it('should use pattern fill foreground as fallback', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:pattFill': {
								'a:fgClr': {
									'a:srgbClr': { '@_val': '00FF00' },
								},
							},
						},
					},
				},
			},
		});
		expect(result).toBe('#00FF00');
	});

	it('should use pattern fill background colour when foreground is missing', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:pattFill': {
								'a:bgClr': {
									'a:srgbClr': { '@_val': '0000FF' },
								},
							},
						},
					},
				},
			},
		});
		expect(result).toBe('#0000FF');
	});

	it('should fall through to bgRef when bgPr has no fill', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgRef': {
							'a:solidFill': {
								'a:srgbClr': { '@_val': 'AABBCC' },
							},
						},
					},
				},
			},
		});
		expect(result).toBe('#AABBCC');
	});

	it('should default to #FFFFFF when bgRef has no resolvable color', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgRef': { '@_idx': '1001' },
					},
				},
			},
		});
		expect(result).toBe('#FFFFFF');
	});

	it('should work with p:sldLayout root element', () => {
		const result = extractBackgroundColor(
			{
				'p:sldLayout': {
					'p:cSld': {
						'p:bg': {
							'p:bgPr': {
								'a:solidFill': {
									'a:srgbClr': { '@_val': '112233' },
								},
							},
						},
					},
				},
			},
			'p:sldLayout',
		);
		expect(result).toBe('#112233');
	});

	it('should work with p:sldMaster root element', () => {
		const result = extractBackgroundColor(
			{
				'p:sldMaster': {
					'p:cSld': {
						'p:bg': {
							'p:bgPr': {
								'a:solidFill': {
									'a:srgbClr': { '@_val': '445566' },
								},
							},
						},
					},
				},
			},
			'p:sldMaster',
		);
		expect(result).toBe('#445566');
	});

	it('should return undefined when bgPr has neither solid, pattern, nor blip fill', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:gradFill': {},
						},
					},
				},
			},
		});
		expect(result).toBeUndefined();
	});

	// -------------------------------------------------------------------------
	// Issue #288: a:alpha on a background a:solidFill was ignored, rendering a
	// semi-transparent background fully opaque.
	// -------------------------------------------------------------------------

	it('blends a:alpha onto white for a solid fill background (issue #288)', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:solidFill': {
								'a:srgbClr': {
									'@_val': 'CEE0F3',
									'a:alpha': { '@_val': '43211' },
								},
							},
						},
					},
				},
			},
		});
		// PowerPoint composites the semi-transparent fill over white; COM/manual
		// verification (see the issue) puts the rendered colour at #EAF2FA.
		expect(result).toBe('#EAF2FA');
	});

	it('leaves the colour unchanged when the solid fill has no a:alpha', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:solidFill': {
								'a:srgbClr': { '@_val': 'CEE0F3' },
							},
						},
					},
				},
			},
		});
		expect(result).toBe('#CEE0F3');
	});

	it('leaves the colour unchanged when a:alpha is 100000 (fully opaque)', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:solidFill': {
								'a:srgbClr': {
									'@_val': 'CEE0F3',
									'a:alpha': { '@_val': '100000' },
								},
							},
						},
					},
				},
			},
		});
		expect(result).toBe('#CEE0F3');
	});

	it('blends a:alpha onto white for a scheme colour background', () => {
		const result = extractBackgroundColor({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:solidFill': {
								'a:schemeClr': {
									'@_val': 'accent1',
									'a:alpha': { '@_val': '50000' },
								},
							},
						},
					},
				},
			},
		});
		expect(result).toBe(blendColorOntoWhite('#4472C4', 0.5));
	});
});

// ---------------------------------------------------------------------------
// hasBackgroundGradient
// ---------------------------------------------------------------------------
describe('hasBackgroundGradient', () => {
	it('should return false when no background is present', () => {
		expect(hasBackgroundGradient({ 'p:sld': { 'p:cSld': {} } })).toBeFalsy();
	});

	it('should return true when bgPr contains gradFill', () => {
		expect(
			hasBackgroundGradient({
				'p:sld': {
					'p:cSld': {
						'p:bg': {
							'p:bgPr': {
								'a:gradFill': {
									'a:gsLst': {},
								},
							},
						},
					},
				},
			}),
		).toBeTruthy();
	});

	it('should return false when bgPr contains solidFill instead', () => {
		expect(
			hasBackgroundGradient({
				'p:sld': {
					'p:cSld': {
						'p:bg': {
							'p:bgPr': {
								'a:solidFill': {},
							},
						},
					},
				},
			}),
		).toBeFalsy();
	});
});

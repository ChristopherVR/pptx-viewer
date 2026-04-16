import { describe, it, expect } from 'vitest';

import type { PptxElementWithShapeStyle } from '../types';
import { getConnectorAdjustment, getConnectorPathGeometry } from './connector-geometry';

// Helper to create a minimal connector element.
function makeConnector(
	overrides: Partial<{
		width: number;
		height: number;
		shapeType: string;
		shapeAdjustments: Record<string, number>;
	}> = {},
): PptxElementWithShapeStyle {
	return {
		id: 'conn-1',
		type: 'connector',
		x: 0,
		y: 0,
		width: overrides.width ?? 200,
		height: overrides.height ?? 100,
		shapeType: overrides.shapeType ?? 'straightConnector1',
		shapeAdjustments: overrides.shapeAdjustments,
	} as unknown as PptxElementWithShapeStyle;
}

// ---------------------------------------------------------------------------
// getConnectorAdjustment
// ---------------------------------------------------------------------------

describe('getConnectorAdjustment', () => {
	it('returns the fallback when no adjustments exist', () => {
		const el = makeConnector({});
		expect(getConnectorAdjustment(el, 'adj1', 0.5)).toBe(0.5);
	});

	it('reads a named adjustment and normalizes to [0, 1]', () => {
		const el = makeConnector({ shapeAdjustments: { adj1: 50000 } });
		expect(getConnectorAdjustment(el, 'adj1', 0)).toBe(0.5);
	});

	it("falls back to the generic 'adj' key when named key is missing", () => {
		const el = makeConnector({ shapeAdjustments: { adj: 75000 } });
		expect(getConnectorAdjustment(el, 'adj1', 0)).toBe(0.75);
	});

	it('clamps the normalized value to [0, 1]', () => {
		const el = makeConnector({ shapeAdjustments: { adj1: 200000 } });
		expect(getConnectorAdjustment(el, 'adj1', 0.5)).toBe(1);

		const el2 = makeConnector({ shapeAdjustments: { adj1: -50000 } });
		expect(getConnectorAdjustment(el2, 'adj1', 0.5)).toBe(0);
	});

	it('returns the named key over the generic adj key', () => {
		const el = makeConnector({
			shapeAdjustments: { adj1: 25000, adj: 75000 },
		});
		expect(getConnectorAdjustment(el, 'adj1', 0.5)).toBe(0.25);
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — straight connector
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — straightConnector1', () => {
	it('produces a straight-line path from (0,0) to (width,height)', () => {
		const el = makeConnector({
			shapeType: 'straightConnector1',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.startX).toBe(0);
		expect(result.startY).toBe(0);
		expect(result.endX).toBe(200);
		expect(result.endY).toBe(100);
		expect(result.pathData).toBe('M 0 0 L 200 100');
	});

	it('defaults to straight connector for unknown types', () => {
		const el = makeConnector({ shapeType: 'unknownType', width: 50, height: 50 });
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 L 50 50');
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector2
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — bentConnector2', () => {
	it('produces an L-shaped path', () => {
		const el = makeConnector({
			shapeType: 'bentConnector2',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 L 200 0 L 200 100');
		expect(result.startX).toBe(0);
		expect(result.endX).toBe(200);
		expect(result.endY).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector3
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — bentConnector3', () => {
	it('produces a Z-shaped path with default adjustment', () => {
		const el = makeConnector({
			shapeType: 'bentConnector3',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// Default adj1=0.5, midX = 200*0.5 = 100
		expect(result.pathData).toBe('M 0 0 L 100 0 L 100 100 L 200 100');
	});

	it('respects a custom adj1 adjustment', () => {
		const el = makeConnector({
			shapeType: 'bentConnector3',
			width: 200,
			height: 100,
			shapeAdjustments: { adj1: 25000 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.25, midX = 200*0.25 = 50
		expect(result.pathData).toBe('M 0 0 L 50 0 L 50 100 L 200 100');
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector4
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — bentConnector4', () => {
	it('produces a 3-segment elbow path with default adjustments', () => {
		const el = makeConnector({
			shapeType: 'bentConnector4',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// Default adj1=0.5, adj2=0.5, midX=100, midY=50
		expect(result.pathData).toBe('M 0 0 L 100 0 L 100 50 L 200 50 L 200 100');
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — bentConnector5
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — bentConnector5', () => {
	it('produces a 4-segment elbow path with default adjustments', () => {
		const el = makeConnector({
			shapeType: 'bentConnector5',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// Default all adj = 0.5: x1=100, yMid=50, x2=100
		expect(result.pathData).toBe('M 0 0 L 100 0 L 100 50 L 100 50 L 100 100 L 200 100');
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — curvedConnector2
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — curvedConnector2', () => {
	it('produces a quadratic Bezier L-curve', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector2',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 Q 200 0 200 100');
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — curvedConnector3
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — curvedConnector3', () => {
	it('produces a 2-segment cubic Bezier', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector3',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.5 → midX=100, midY=50
		expect(result.pathData).toBe('M 0 0 C 100 0 100 0 100 50 C 100 100 100 100 200 100');
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — curvedConnector4
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — curvedConnector4', () => {
	it('produces a 3-segment cubic Bezier with default adjustments', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector4',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.5 → midX=100, adj2=0.5 → midY=50
		expect(result.pathData).toBe(
			'M 0 0 C 100 0 100 0 100 25 C 100 50 100 50 150 50 C 200 50 200 50 200 100',
		);
		expect(result.startX).toBe(0);
		expect(result.startY).toBe(0);
		expect(result.endX).toBe(200);
		expect(result.endY).toBe(100);
	});

	it('respects custom adj1 and adj2 adjustments', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector4',
			width: 400,
			height: 200,
			shapeAdjustments: { adj1: 25000, adj2: 75000 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.25 → midX=100, adj2=0.75 → midY=150
		expect(result.pathData).toBe(
			'M 0 0 C 100 0 100 0 100 75 C 100 150 100 150 250 150 C 400 150 400 150 400 200',
		);
	});
});

// ---------------------------------------------------------------------------
// getConnectorPathGeometry — curvedConnector5
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — curvedConnector5', () => {
	it('produces a 4-segment cubic Bezier with default adjustments', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector5',
			width: 200,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// adj1=adj2=adj3=0.5, x1=100, yMid=50, x2=100
		expect(result.pathData).toBe(
			'M 0 0 C 100 0 100 0 100 25 C 100 50 100 50 100 50 C 100 50 100 50 100 75 C 100 100 100 100 200 100',
		);
		expect(result.startX).toBe(0);
		expect(result.startY).toBe(0);
		expect(result.endX).toBe(200);
		expect(result.endY).toBe(100);
	});

	it('respects custom adj1, adj2, and adj3 adjustments', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector5',
			width: 300,
			height: 200,
			shapeAdjustments: { adj1: 30000, adj2: 40000, adj3: 70000 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.3 → x1=90, adj2=0.4 → yMid=80, adj3=0.7 → x2=210
		const x1 = 90;
		const yMid = 80;
		const x2 = 210;
		const midXBetween = Math.round((x1 + x2) / 2); // 150
		const midYBetween = Math.round((yMid + 200) / 2); // 140
		expect(result.pathData).toBe(
			`M 0 0 C ${x1} 0 ${x1} 0 ${x1} ${Math.round(yMid * 0.5)} C ${x1} ${yMid} ${x1} ${yMid} ${midXBetween} ${yMid} C ${x2} ${yMid} ${x2} ${yMid} ${x2} ${midYBetween} C ${x2} 200 ${x2} 200 300 200`,
		);
	});
});

// ---------------------------------------------------------------------------
// Minimum dimension clamping
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — dimension clamping', () => {
	it('enforces minimum 1px dimensions', () => {
		const el = makeConnector({
			shapeType: 'straightConnector1',
			width: 0,
			height: 0,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.endX).toBe(1);
		expect(result.endY).toBe(1);
		expect(result.pathData).toBe('M 0 0 L 1 1');
	});

	it('enforces minimum 1px for bent connectors too', () => {
		const el = makeConnector({
			shapeType: 'bentConnector3',
			width: 0,
			height: 0,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.endX).toBe(1);
		expect(result.endY).toBe(1);
		// midX = 1 * 0.5 = 0.5, rounded to 1
		expect(result.pathData).toMatch(/^M 0 0/);
	});

	it('enforces minimum 1px for curved connectors', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector3',
			width: 0,
			height: 0,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.endX).toBe(1);
		expect(result.endY).toBe(1);
		expect(result.pathData).toMatch(/^M 0 0 C/);
	});
});

// ---------------------------------------------------------------------------
// Custom adjustments for bentConnector4 and bentConnector5
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — bent connector custom adjustments', () => {
	it('bentConnector4 with custom adj1 and adj2', () => {
		const el = makeConnector({
			shapeType: 'bentConnector4',
			width: 400,
			height: 200,
			shapeAdjustments: { adj1: 75000, adj2: 25000 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.75 → midX=300, adj2=0.25 → midY=50
		expect(result.pathData).toBe('M 0 0 L 300 0 L 300 50 L 400 50 L 400 200');
	});

	it('bentConnector5 with custom adj1, adj2, adj3', () => {
		const el = makeConnector({
			shapeType: 'bentConnector5',
			width: 300,
			height: 150,
			shapeAdjustments: { adj1: 30000, adj2: 60000, adj3: 80000 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0.3 → x1=90, adj2=0.6 → yMid=90, adj3=0.8 → x2=240
		expect(result.pathData).toBe('M 0 0 L 90 0 L 90 90 L 240 90 L 240 150 L 300 150');
	});
});

// ---------------------------------------------------------------------------
// Flipped orientations (small dimensions simulating flipped connectors)
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — various dimensions (orientation)', () => {
	it('straight connector with tall narrow dimensions', () => {
		const el = makeConnector({
			shapeType: 'straightConnector1',
			width: 10,
			height: 500,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 L 10 500');
		expect(result.endX).toBe(10);
		expect(result.endY).toBe(500);
	});

	it('bentConnector2 with wide short dimensions', () => {
		const el = makeConnector({
			shapeType: 'bentConnector2',
			width: 500,
			height: 10,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 L 500 0 L 500 10');
	});

	it('bentConnector3 with square dimensions', () => {
		const el = makeConnector({
			shapeType: 'bentConnector3',
			width: 100,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 L 50 0 L 50 100 L 100 100');
	});

	it('curvedConnector2 with tall narrow dimensions', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector2',
			width: 5,
			height: 300,
		});
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 Q 5 0 5 300');
	});

	it('curvedConnector3 with square dimensions', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector3',
			width: 100,
			height: 100,
		});
		const result = getConnectorPathGeometry(el);
		// midX = 50, midY = 50
		expect(result.pathData).toBe('M 0 0 C 50 0 50 0 50 50 C 50 100 50 100 100 100');
	});
});

// ---------------------------------------------------------------------------
// SVG path data validation
// ---------------------------------------------------------------------------

/**
 * Validate that a path string starts with M command and only contains
 * valid SVG path commands (M, L, C, Q) with numeric coordinates.
 */
function isValidSvgPath(pathData: string): boolean {
	if (!pathData.startsWith('M ')) {
		return false;
	}
	// All tokens should be valid SVG commands or numbers
	const tokens = pathData.split(' ');
	const validCommands = new Set(['M', 'L', 'C', 'Q']);
	for (const token of tokens) {
		if (validCommands.has(token)) {
			continue;
		}
		if (/^-?\d+(\.\d+)?$/.test(token)) {
			continue;
		}
		return false;
	}
	return true;
}

describe('getConnectorPathGeometry — SVG path validation', () => {
	const connectorTypes = [
		'straightConnector1',
		'bentConnector2',
		'bentConnector3',
		'bentConnector4',
		'bentConnector5',
		'curvedConnector2',
		'curvedConnector3',
		'curvedConnector4',
		'curvedConnector5',
	];

	for (const shapeType of connectorTypes) {
		it(`${shapeType} produces valid SVG path data`, () => {
			const el = makeConnector({ shapeType, width: 200, height: 100 });
			const result = getConnectorPathGeometry(el);
			expect(isValidSvgPath(result.pathData)).toBeTruthy();
		});
	}

	it('all bent connectors use only M and L commands', () => {
		const bentTypes = ['bentConnector2', 'bentConnector3', 'bentConnector4', 'bentConnector5'];
		for (const shapeType of bentTypes) {
			const el = makeConnector({ shapeType, width: 200, height: 100 });
			const result = getConnectorPathGeometry(el);
			const commands = result.pathData.split(' ').filter((t) => /^[A-Z]$/.test(t));
			expect(commands.every((c) => c === 'M' || c === 'L')).toBeTruthy();
		}
	});

	it('all curved connectors use C or Q commands (not just L)', () => {
		const curvedTypes = [
			'curvedConnector2',
			'curvedConnector3',
			'curvedConnector4',
			'curvedConnector5',
		];
		for (const shapeType of curvedTypes) {
			const el = makeConnector({ shapeType, width: 200, height: 100 });
			const result = getConnectorPathGeometry(el);
			const commands = result.pathData.split(' ').filter((t) => /^[A-Z]$/.test(t));
			expect(commands.some((c) => c === 'C' || c === 'Q')).toBeTruthy();
		}
	});
});

// ---------------------------------------------------------------------------
// Segment count verification
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — segment counts', () => {
	it('bentConnector2 has exactly 1 segment (2 L commands)', () => {
		const el = makeConnector({ shapeType: 'bentConnector2', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const lCount = result.pathData.split(' ').filter((t) => t === 'L').length;
		expect(lCount).toBe(2); // L to corner, L to end
	});

	it('bentConnector3 has exactly 2 segments (3 L commands)', () => {
		const el = makeConnector({ shapeType: 'bentConnector3', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const lCount = result.pathData.split(' ').filter((t) => t === 'L').length;
		expect(lCount).toBe(3);
	});

	it('bentConnector4 has exactly 3 segments (4 L commands)', () => {
		const el = makeConnector({ shapeType: 'bentConnector4', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const lCount = result.pathData.split(' ').filter((t) => t === 'L').length;
		expect(lCount).toBe(4);
	});

	it('bentConnector5 has exactly 4 segments (5 L commands)', () => {
		const el = makeConnector({ shapeType: 'bentConnector5', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const lCount = result.pathData.split(' ').filter((t) => t === 'L').length;
		expect(lCount).toBe(5);
	});

	it('curvedConnector2 has exactly 1 Q command', () => {
		const el = makeConnector({ shapeType: 'curvedConnector2', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const qCount = result.pathData.split(' ').filter((t) => t === 'Q').length;
		expect(qCount).toBe(1);
	});

	it('curvedConnector3 has exactly 2 C commands', () => {
		const el = makeConnector({ shapeType: 'curvedConnector3', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const cCount = result.pathData.split(' ').filter((t) => t === 'C').length;
		expect(cCount).toBe(2);
	});

	it('curvedConnector4 has exactly 3 C commands', () => {
		const el = makeConnector({ shapeType: 'curvedConnector4', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const cCount = result.pathData.split(' ').filter((t) => t === 'C').length;
		expect(cCount).toBe(3);
	});

	it('curvedConnector5 has exactly 4 C commands', () => {
		const el = makeConnector({ shapeType: 'curvedConnector5', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		const cCount = result.pathData.split(' ').filter((t) => t === 'C').length;
		expect(cCount).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Start/end point consistency
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — start/end point consistency', () => {
	const connectorTypes = [
		'straightConnector1',
		'bentConnector2',
		'bentConnector3',
		'bentConnector4',
		'bentConnector5',
		'curvedConnector2',
		'curvedConnector3',
		'curvedConnector4',
		'curvedConnector5',
	];

	for (const shapeType of connectorTypes) {
		it(`${shapeType} starts at (0,0) and ends at (width,height)`, () => {
			const el = makeConnector({ shapeType, width: 300, height: 150 });
			const result = getConnectorPathGeometry(el);
			expect(result.startX).toBe(0);
			expect(result.startY).toBe(0);
			expect(result.endX).toBe(300);
			expect(result.endY).toBe(150);
			// Path should start with M 0 0
			expect(result.pathData).toMatch(/^M 0 0/);
			// Path should end with the end coordinates
			expect(result.pathData).toMatch(/300 150$/);
		});
	}
});

// ---------------------------------------------------------------------------
// Case-insensitivity of shapeType
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — case insensitivity', () => {
	it('handles uppercase connector type names', () => {
		const el = makeConnector({ shapeType: 'BENTCONNECTOR3', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 L 100 0 L 100 100 L 200 100');
	});

	it('handles mixed-case connector type names', () => {
		const el = makeConnector({ shapeType: 'CurvedConnector2', width: 200, height: 100 });
		const result = getConnectorPathGeometry(el);
		expect(result.pathData).toBe('M 0 0 Q 200 0 200 100');
	});
});

// ---------------------------------------------------------------------------
// Extreme adjustment values
// ---------------------------------------------------------------------------

describe('getConnectorPathGeometry — extreme adjustments', () => {
	it('bentConnector3 with adj1=0 (midpoint at left edge)', () => {
		const el = makeConnector({
			shapeType: 'bentConnector3',
			width: 200,
			height: 100,
			shapeAdjustments: { adj1: 0 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0 → midX=0
		expect(result.pathData).toBe('M 0 0 L 0 0 L 0 100 L 200 100');
	});

	it('bentConnector3 with adj1=100000 (clamped to 1, midpoint at right edge)', () => {
		const el = makeConnector({
			shapeType: 'bentConnector3',
			width: 200,
			height: 100,
			shapeAdjustments: { adj1: 100000 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=1.0 → midX=200
		expect(result.pathData).toBe('M 0 0 L 200 0 L 200 100 L 200 100');
	});

	it('curvedConnector3 with adj1=0', () => {
		const el = makeConnector({
			shapeType: 'curvedConnector3',
			width: 200,
			height: 100,
			shapeAdjustments: { adj1: 0 },
		});
		const result = getConnectorPathGeometry(el);
		// adj1=0 → midX=0, midY=50
		expect(result.pathData).toBe('M 0 0 C 0 0 0 0 0 50 C 0 100 0 100 200 100');
	});
});

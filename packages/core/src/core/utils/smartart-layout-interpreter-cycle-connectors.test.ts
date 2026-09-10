import { describe, expect, it } from 'vitest';

import { buildCycleRingConnectors } from './smartart-layout-interpreter-cycle-connectors';
import type { CycleRingLayout } from './smartart-layout-interpreter-cycle-ring';

const ring: CycleRingLayout = {
	centers: [
		{ x: 0, y: -100 },
		{ x: 100, y: 0 },
		{ x: 0, y: 100 },
	],
	nodeWidth: 40,
	nodeHeight: 40,
	hubCenter: { x: 0, y: 0 },
	hubHalfWidth: 10,
	hubHalfHeight: 10,
};

describe('buildCycleRingConnectors', () => {
	it('builds one arc per adjacent pair, each a quadratic bezier from centre to centre', () => {
		const connectors = buildCycleRingConnectors(ring, 3, 3, ring.hubCenter, 'e');
		expect(connectors).toHaveLength(3);
		expect(connectors[0].key).toBe('e-cycle-conn-0');
		expect(connectors[0].d).toMatch(/^M0,-100 Q.+ 100,0$/);
	});

	it('builds n - 1 arcs for an open arc (connectorCount < n)', () => {
		const connectors = buildCycleRingConnectors(ring, 3, 2, ring.hubCenter, 'e');
		expect(connectors).toHaveLength(2);
	});

	it('is empty when connectorCount is 0', () => {
		expect(buildCycleRingConnectors(ring, 3, 0, ring.hubCenter, 'e')).toHaveLength(0);
	});
});

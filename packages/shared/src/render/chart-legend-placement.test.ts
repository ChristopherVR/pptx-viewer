import { describe, expect, it } from 'vitest';

import { resolveLegendPlacement } from './chart-legend-placement';

describe('resolveLegendPlacement', () => {
	it('maps b/t/l/r to themselves with no overlay', () => {
		expect(resolveLegendPlacement('b')).toStrictEqual({ side: 'b', overlaysPlot: false });
		expect(resolveLegendPlacement('t')).toStrictEqual({ side: 't', overlaysPlot: false });
		expect(resolveLegendPlacement('l')).toStrictEqual({ side: 'l', overlaysPlot: false });
		expect(resolveLegendPlacement('r')).toStrictEqual({ side: 'r', overlaysPlot: false });
	});

	it('c:legendPos="tr" maps to the right side but overlays the plot', () => {
		expect(resolveLegendPlacement('tr')).toStrictEqual({ side: 'r', overlaysPlot: true });
	});

	it('defaults an absent or unrecognised value to bottom, no overlay', () => {
		expect(resolveLegendPlacement(undefined)).toStrictEqual({ side: 'b', overlaysPlot: false });
		expect(resolveLegendPlacement('bogus')).toStrictEqual({ side: 'b', overlaysPlot: false });
	});
});

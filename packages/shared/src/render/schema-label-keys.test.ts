import { describe, expect, it } from 'vitest';

import { translationsEn } from '../i18n';
import {
	CHART_AXIS_TYPE_LABEL_KEYS,
	CHART_DATA_LABEL_POSITION_LABEL_KEYS,
	CHART_ERROR_BAR_DIRECTION_LABEL_KEYS,
	CHART_ERROR_BAR_VALTYPE_LABEL_KEYS,
	CHART_GRIDLINE_DASH_LABEL_KEYS,
	CHART_GROUPING_LABEL_KEYS,
	CHART_MARKER_SYMBOL_LABEL_KEYS,
	CHART_TRENDLINE_LABEL_KEYS,
	CHART_TYPE_LABEL_KEYS,
} from './chart-schema-label-keys';
import { FILL_PATTERN_LABEL_KEYS } from './fill-pattern-label-keys';
import {
	ARROW_SIZE_LABEL_KEYS,
	ARROWHEAD_LABEL_KEYS,
	schemaLabel,
	SMARTART_COLOR_SCHEME_LABEL_KEYS,
	SMARTART_LAYOUT_LABEL_KEYS,
	SMARTART_STYLE_LABEL_KEYS,
	THEME_COLOR_SLOT_LABEL_KEYS,
} from './schema-label-keys';
import { SLIDE_TRANSITION_LABEL_KEYS } from './slide-transition-label-keys';

const CATALOGUES: Array<[string, Readonly<Record<string, string>>]> = [
	['theme colour slots', THEME_COLOR_SLOT_LABEL_KEYS],
	['smartart colour schemes', SMARTART_COLOR_SCHEME_LABEL_KEYS],
	['smartart styles', SMARTART_STYLE_LABEL_KEYS],
	['smartart layouts', SMARTART_LAYOUT_LABEL_KEYS],
	['arrowheads', ARROWHEAD_LABEL_KEYS],
	['arrow sizes', ARROW_SIZE_LABEL_KEYS],
	['chart types', CHART_TYPE_LABEL_KEYS],
	['chart grouping', CHART_GROUPING_LABEL_KEYS],
	['chart axis types', CHART_AXIS_TYPE_LABEL_KEYS],
	['chart data-label positions', CHART_DATA_LABEL_POSITION_LABEL_KEYS],
	['chart trendlines', CHART_TRENDLINE_LABEL_KEYS],
	['chart error-bar value types', CHART_ERROR_BAR_VALTYPE_LABEL_KEYS],
	['chart error-bar directions', CHART_ERROR_BAR_DIRECTION_LABEL_KEYS],
	['chart marker symbols', CHART_MARKER_SYMBOL_LABEL_KEYS],
	['chart gridline dashes', CHART_GRIDLINE_DASH_LABEL_KEYS],
	['fill patterns', FILL_PATTERN_LABEL_KEYS],
	['slide transitions', SLIDE_TRANSITION_LABEL_KEYS],
];

describe('schema label keys', () => {
	// The whole point of these tables is that a control stops rendering the wire
	// token. A key with no dictionary entry falls back to `keyToLabel`, which
	// would put a de-camel-cased key tail on screen instead: still not the
	// PowerPoint wording, and the bug would be invisible in review.
	it.each(CATALOGUES)('resolves every %s token to a real English entry', (_name, catalogue) => {
		const missing = Object.values(catalogue).filter((key) => translationsEn[key] === undefined);
		expect(missing).toStrictEqual([]);
	});

	it.each(CATALOGUES)('never maps a %s token to itself', (_name, catalogue) => {
		const raw = Object.entries(catalogue).filter(([token, key]) => translationsEn[key] === token);
		expect(raw).toStrictEqual([]);
	});

	describe('schemaLabel', () => {
		const translate = (key: string) => `<${key}>`;

		it('translates a mapped token', () => {
			expect(schemaLabel(THEME_COLOR_SLOT_LABEL_KEYS, 'folHlink', translate)).toBe(
				'<pptx.themeColor.followedHyperlink>',
			);
		});

		it('falls back to the token itself when a deck carries an unmapped value', () => {
			expect(schemaLabel(THEME_COLOR_SLOT_LABEL_KEYS, 'accent7', translate)).toBe('accent7');
		});

		it('renders nothing for an absent value', () => {
			expect(schemaLabel(THEME_COLOR_SLOT_LABEL_KEYS, undefined, translate)).toBe('');
		});
	});
});

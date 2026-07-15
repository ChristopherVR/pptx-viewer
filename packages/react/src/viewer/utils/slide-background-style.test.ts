import { describe, expect, it } from 'vitest';

import { getReactSlideBackgroundStyle } from './slide-background-style';

describe('getReactSlideBackgroundStyle', () => {
	it('adapts shared background properties to React camel-case keys', () => {
		const style = getReactSlideBackgroundStyle({
			id: 'slide-1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [],
			backgroundColor: '#123456',
			backgroundImage: 'data:image/png;base64,abc',
		});

		expect(style).toStrictEqual({
			backgroundColor: '#123456',
			backgroundImage: 'url(data:image/png;base64,abc)',
			backgroundSize: '100% 100%',
			backgroundRepeat: 'no-repeat',
		});
	});
});

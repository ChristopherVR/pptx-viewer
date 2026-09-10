import { describe, expect, it } from 'vitest';

import {
	DEFAULT_DENSE_BUTTON_PX,
	getDensePanelTouchTargetBox,
	getDensePanelTouchTargetPx,
	MIN_TOUCH_TARGET_PX,
} from './touch-target';

describe('getDensePanelTouchTargetPx', () => {
	it('returns the 44px minimum at 360px width', () => {
		expect(getDensePanelTouchTargetPx(360)).toBe(MIN_TOUCH_TARGET_PX);
		expect(getDensePanelTouchTargetPx(360)).toBe(44);
	});

	it('returns the default (mouse-sized) button below the breakpoint boundary on desktop', () => {
		expect(getDensePanelTouchTargetPx(1280)).toBe(DEFAULT_DENSE_BUTTON_PX);
	});
});

describe('getDensePanelTouchTargetBox', () => {
	it('returns a square minWidth/minHeight box matching the pixel size', () => {
		expect(getDensePanelTouchTargetBox(360)).toStrictEqual({ minWidth: 44, minHeight: 44 });
		expect(getDensePanelTouchTargetBox(1280)).toStrictEqual({
			minWidth: DEFAULT_DENSE_BUTTON_PX,
			minHeight: DEFAULT_DENSE_BUTTON_PX,
		});
	});
});

import type { PptxActiveXControl } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ActiveXControlOverlay } from './ActiveXControlOverlay';

const canvasSize = { width: 960, height: 540 };

function render(
	controls: PptxActiveXControl[],
	resolveFallbackImage?: (relId: string) => string | undefined,
): string {
	return renderToStaticMarkup(
		<ActiveXControlOverlay
			controls={controls}
			canvasSize={canvasSize}
			resolveFallbackImage={resolveFallbackImage}
		/>,
	);
}

describe('activeXControlOverlay', () => {
	it('renders nothing when there are no controls', () => {
		expect(render([])).toBe('');
	});

	it('renders a labelled placeholder badge for a control without a fallback image', () => {
		const html = render([{ relId: 'rId5', name: 'SubmitButton' }]);
		expect(html).toContain('SubmitButton');
		expect(html).toContain('ActiveX control: SubmitButton');
	});

	it('renders the fallback picture when a resolver supplies a data URL', () => {
		const control = {
			relId: 'rId5',
			name: 'Btn',
			fallbackImageRelId: 'rId6',
		} as PptxActiveXControl;
		const html = render([control], (relId) =>
			relId === 'rId6' ? 'data:image/png;base64,AAAA' : undefined,
		);
		expect(html).toContain('<img');
		expect(html).toContain('data:image/png;base64,AAAA');
	});

	it('falls back to a generic label when the control has no name', () => {
		const html = render([{ relId: 'rId9' }]);
		expect(html).toContain('ActiveX control');
	});
});

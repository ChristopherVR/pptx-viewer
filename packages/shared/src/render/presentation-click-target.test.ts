// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { isPresentationAdvanceClick } from './presentation-setup';

function render(html: string): HTMLElement {
	document.body.innerHTML = html;
	return document.body.firstElementChild as HTMLElement;
}

describe('isPresentationAdvanceClick', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('treats inert slide content as PowerPoint click-to-advance', () => {
		const shape = render('<div data-element-id="s1-shape-0"><span>Title</span></div>');
		expect(isPresentationAdvanceClick(shape)).toBeTruthy();
		expect(isPresentationAdvanceClick(shape.firstElementChild)).toBeTruthy();
	});

	it('leaves live slide content and show chrome owning their own click', () => {
		// A hyperlink follows the link; it must not also step the show on.
		expect(isPresentationAdvanceClick(render('<a href="#x">link</a>'))).toBeFalsy();
		// An action button / action shape, keyed by the shared data attribute.
		expect(
			isPresentationAdvanceClick(render('<div data-pptx-action="click"><b>go</b></div>')),
		).toBeFalsy();
		// Show chrome and media transport.
		expect(isPresentationAdvanceClick(render('<button type="button">next</button>'))).toBeFalsy();
		expect(isPresentationAdvanceClick(render('<video controls></video>'))).toBeFalsy();
		expect(isPresentationAdvanceClick(render('<div role="dialog"><p>hi</p></div>'))).toBeFalsy();
	});

	it('treats a controls-less background video as inert slide content', () => {
		// The regression this exists for: slide 2 of `solution-explorer.pptx` is a
		// full-bleed autoplay background video with no transport. Counting it as
		// interactive swallows EVERY click on that slide, so the presenter cannot
		// advance the show from anywhere on screen.
		expect(isPresentationAdvanceClick(render('<video autoplay loop></video>'))).toBeTruthy();
		expect(isPresentationAdvanceClick(render('<audio></audio>'))).toBeTruthy();
		// An inert video inside a hyperlink still belongs to the hyperlink.
		const linked = render('<a href="#x"><video autoplay></video></a>');
		expect(isPresentationAdvanceClick(linked.querySelector('video'))).toBeFalsy();
	});

	it('matches on the nearest interactive ancestor, not just the exact target', () => {
		const link = render('<a href="#x"><span id="inner">deep</span></a>');
		expect(isPresentationAdvanceClick(link.querySelector('#inner'))).toBeFalsy();
	});

	it('ignores non-element targets', () => {
		expect(isPresentationAdvanceClick(null)).toBeFalsy();
		expect(isPresentationAdvanceClick(undefined)).toBeFalsy();
		expect(isPresentationAdvanceClick(document.createTextNode('text'))).toBeFalsy();
	});
});

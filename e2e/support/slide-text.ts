/**
 * Reading the TEXT off a rendered stage without reading the code inside it.
 *
 * `Node.textContent` is not "the text a reader sees": it concatenates every
 * descendant text node, including the ones inside `<style>` and `<script>`.
 * That is not theoretical here. The show stage carries its own stylesheets as
 * real children - `PRESENTATION_HIT_TEST_CSS` plus the generated morph
 * keyframes, which have to be inside the stage because they select on the
 * `data-element-id`s it renders - so a plain `stage.textContent` read on the
 * React show returns `"[data-pptx-presenting] [data-element-id]"`, the opening
 * selector of the hit-test sheet, on EVERY slide. A "which slide is showing"
 * probe built on that never changes, so navigating the show looks broken while
 * it is working perfectly.
 *
 * Same shape as the `commentTextVisible` trap: a scrape that looks binding
 * neutral silently reports something other than what the reader sees.
 *
 * @module e2e/support/slide-text
 */
import type { Page } from '@playwright/test';

/**
 * The running show's stage text, as a binding-neutral "which slide is showing"
 * probe.
 *
 * Slide counters differ per binding and deck text can contain "n / m" strings
 * of its own, so the slide is identified by what it says rather than by any
 * chrome. The stage is found through the shared `data-pptx-presenting` marker
 * every binding's presenting stage carries (stamped by
 * `applyRenderedElementAccessibility`, or directly where a binding renders its
 * accessibility in the view layer). Reading ONLY that marker is the contract:
 * the still-mounted editor canvas and the thumbnails mirror the active slide
 * index, so a looser probe could read those and pass without a show at all.
 *
 * @param limit - How many characters of the collapsed text to return.
 */
export async function presentingStageText(page: Page, limit = 40): Promise<string> {
	return page.evaluate((max) => {
		// Stylesheets and scripts are children of the stage, not content on the
		// slide; `<template>` and `<noscript>` hold text that is never painted.
		const CODE_TAGS = new Set(['STYLE', 'SCRIPT', 'TEMPLATE', 'NOSCRIPT']);
		const widthOf = (node: Element): number => node.getBoundingClientRect().width;
		const stage = [...document.querySelectorAll('[data-pptx-presenting]')]
			.filter((node) => widthOf(node) > 200)
			.sort((a, b) => widthOf(b) - widthOf(a))[0];
		if (!stage) {
			return '';
		}
		const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				const parent = node.parentElement;
				return parent && CODE_TAGS.has(parent.tagName)
					? NodeFilter.FILTER_REJECT
					: NodeFilter.FILTER_ACCEPT;
			},
		});
		let text = '';
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			text += node.textContent ?? '';
		}
		return text.replace(/\s+/gu, ' ').trim().slice(0, max);
	}, limit);
}

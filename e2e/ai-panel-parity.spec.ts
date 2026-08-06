/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings ship the same AI assistant, and does its whole loop work?
 *
 * The assistant had zero e2e coverage: nothing pinned that the toggle exists,
 * that the panel opens, or that a model turn renders at all, so a binding could
 * ship a dead Sparkles button and stay green. This suite drives the panel
 * against a MOCKED language model: the demos build an in-browser
 * OpenAI-compatible connection from localStorage, so `support/ai-panel` points
 * that base URL at the page's own origin and answers the chat-completions
 * endpoint with scripted SSE. That makes the full production code path real -
 * AI SDK agent loop, streaming parser, tool registry, proposal staging, change
 * animation - with only the model itself replaced.
 *
 * Covered per binding, diffed against the React reference:
 *   - the toolbar toggle opens a panel with a working composer and send control;
 *   - panel chrome parity (neutral marker, title, close, history affordance),
 *     asserted strictly across all five;
 *   - a full stubbed round trip: user message renders, assistant reply renders;
 *   - a scripted tool call stages a reviewable proposal whose Apply actually
 *     mutates the deck on the canvas;
 *   - on a phone viewport the panel opens as a bottom sheet that leaves the
 *     canvas visible above it, not a full-screen overlay.
 *
 * Run: bunx playwright test ai-panel-parity
 */
import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { AiPanelChrome } from './support/ai-panel';
import {
	aiApplyButton,
	aiPanel,
	appears,
	installMockAiModel,
	measureAiSheet,
	openAiPanel,
	PANEL_TIMEOUT_MS,
	seedMockAiProvider,
	sendAiMessage,
	snapshotAiPanelChrome,
} from './support/ai-panel';
import { fixture, loadDeckAt } from './support/deck';
import { byBinding } from './support/menu-report';
import { acrossFrameworks, splitReference } from './support/parity';

const VIEWPORT = { width: 1600, height: 950 };
test.use({ viewport: VIEWPORT });
test.describe.configure({ timeout: 150_000 });

/** One slide, two text boxes ("SOURCE" / "TARGET"): cheap and unambiguous. */
const DECK = fixture('format-painter.pptx');

/** What the scripted model says. */
const PLAIN_REPLY = 'Hello from the mock assistant.';
const TOOL_FOLLOW_UP = 'I have staged the change for your review.';
const REPLACED_TEXT = 'ROBOTS';

/** Open the deck with the mocked provider installed, then open the panel. */
async function openAssistant(page: Page, origin: string): Promise<boolean> {
	await seedMockAiProvider(page);
	await installMockAiModel(page, {
		reply: PLAIN_REPLY,
		toolTrigger: /rename/iu,
		toolCall: {
			name: 'replace_text',
			input: { query: 'SOURCE', replacement: REPLACED_TEXT },
		},
		toolFollowUp: TOOL_FOLLOW_UP,
	});
	await loadDeckAt(page, origin, DECK);
	return openAiPanel(page);
}

test.describe('cross-binding AI assistant panel', () => {
	test('the toolbar toggle opens a panel with a composer and a send control', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openAssistant(page, origin);
				return snapshotAiPanelChrome(page);
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return [`${name}: no AI panel opened within ${PANEL_TIMEOUT_MS}ms of the toggle click`];
			}
			return [
				...(value.composer ? [] : [`${name}: the panel has no "Ask about this deck" composer`]),
				...(value.send ? [] : [`${name}: the panel has no "Send" control`]),
			];
		});

		expect(problems.join('\n')).toBe('');
	});

	test('the panel chrome matches the reference in every binding', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openAssistant(page, origin);
				return snapshotAiPanelChrome(page);
			},
			{ viewport: VIEWPORT },
		);
		const { reference, candidates } = splitReference(results);

		// Guard: the comparison is only meaningful while the reference actually
		// offers the full chrome this test holds the others to.
		expect(reference.value).toMatchObject({
			present: true,
			neutralMarker: true,
			title: true,
			close: true,
			history: true,
		} satisfies Partial<AiPanelChrome>);

		const problems = byBinding(candidates).flatMap(({ name, value }) => {
			if (!value.present) {
				return [`${name}: no AI panel opened`];
			}
			return [
				...(value.neutralMarker
					? []
					: [`${name}: the panel does not carry the neutral data-pptx-ai-panel marker`]),
				...(value.title ? [] : [`${name}: the panel has no "AI Assistant" title`]),
				...(value.close ? [] : [`${name}: the panel has no "Close AI assistant" control`]),
				...(value.history ? [] : [`${name}: the panel has no chat-history ("Chats") affordance`]),
			];
		});

		expect(problems.join('\n')).toBe('');
	});

	test('a stubbed model round trip renders the user message and the reply', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				const present = await openAssistant(page, origin);
				if (!present) {
					return { present, userShown: false, replyShown: false };
				}
				await sendAiMessage(page, 'Say hello');
				const panel = aiPanel(page);
				return {
					present,
					userShown: await appears(panel.getByText('Say hello').first(), 10_000),
					replyShown: await appears(panel.getByText(PLAIN_REPLY).first(), 20_000),
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return [`${name}: no AI panel opened`];
			}
			return [
				...(value.userShown ? [] : [`${name}: the sent user message never rendered`]),
				...(value.replyShown ? [] : [`${name}: the streamed assistant reply never rendered`]),
			];
		});

		expect(problems.join('\n')).toBe('');
	});

	test('a scripted tool call stages a proposal and Apply mutates the deck', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				const present = await openAssistant(page, origin);
				if (!present) {
					return { present, followUp: false, apply: false, mutated: false };
				}
				await sendAiMessage(page, 'Please rename SOURCE');
				const panel = aiPanel(page);
				// The follow-up reply only streams after the tool executed and its
				// result went back through the agent loop, so it doubles as "the
				// registry ran replace_text against the live deck".
				const followUp = await appears(panel.getByText(TOOL_FOLLOW_UP).first(), 30_000);
				const apply = await appears(aiApplyButton(page), 10_000);
				let mutated = false;
				if (apply) {
					await aiApplyButton(page).click();
					mutated = await appears(
						page
							.locator('[data-pptx-viewport] [data-pptx-element="true"]')
							.filter({ hasText: REPLACED_TEXT })
							.first(),
						10_000,
					);
				}
				return { present, followUp, apply, mutated };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return [`${name}: no AI panel opened`];
			}
			return [
				...(value.followUp ? [] : [`${name}: the post-tool assistant reply never rendered`]),
				...(value.apply ? [] : [`${name}: no Apply control appeared for the staged proposal`]),
				...(value.mutated
					? []
					: value.apply
						? [`${name}: Apply did not change the slide text on the canvas`]
						: []),
			];
		});

		expect(problems.join('\n')).toBe('');
	});

	test('on a phone viewport the assistant opens as a bottom sheet over a visible canvas', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				const present = await openAssistant(page, origin);
				return { present, sheet: await measureAiSheet(page) };
			},
			{ device: devices['Pixel 7'] },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return [`${name}: the assistant is unreachable on a phone viewport`];
			}
			const { topFraction, heightFraction, bottomOverflowPx } = value.sheet;
			return [
				// A sheet must leave canvas interactive above it and must not be a
				// full-screen overlay (the exact regression the bottom-sheet fixed).
				...(topFraction >= 0.08
					? []
					: [
							`${name}: the mobile panel covers the whole canvas ` +
								`(top at ${(topFraction * 100).toFixed(0)}% of the viewport)`,
						]),
				...(heightFraction <= 0.9
					? []
					: [
							`${name}: the mobile panel fills ${(heightFraction * 100).toFixed(0)}% of the viewport`,
						]),
				...(bottomOverflowPx <= 8
					? []
					: [
							`${name}: the mobile sheet hangs ${bottomOverflowPx.toFixed(0)}px below ` +
								'the viewport, so its lower controls are unreachable',
						]),
			];
		});

		expect(problems.join('\n')).toBe('');
	});
});

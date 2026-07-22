import type { ChatTransport } from 'ai';
import { describe, expect, it } from 'vitest';

import type { PptxAiConfig, PptxAiUIMessage } from './config';
import { makeMockBridge } from './mock-bridge';
import { createVanillaChat } from './vanilla-chat';

/**
 * End-to-end AI flow tests, WITHOUT a live model or network. A scripted
 * `kind: 'transport'` stub replays the exact UI-message-stream chunks a real
 * model turn would emit (a tool call, then a text reply), driving the genuine
 * `createVanillaChat` controller through its client-side tool loop:
 *
 *   transport tool-call chunk -> onToolCall -> session.executeToolCall
 *     -> tool executor -> routeWrite -> ProposalStore / bridge choke point
 *     -> addToolOutput -> sendAutomaticallyWhen -> resubmit -> final text.
 *
 * This proves reads return real bridge data, staged writes are reviewable and
 * atomic, auto writes apply immediately, and `delete_slides` always demands
 * approval, all through the same controller a binding wires up.
 */

/** A single UI-message-stream chunk (SDK types these per-variant; we only need shape). */
type StreamChunk = Record<string, unknown>;

/** Chunks for one assistant step that emits a single client-executed tool call. */
function toolCallStep(toolCallId: string, toolName: string, input: unknown): StreamChunk[] {
	return [
		{ type: 'start' },
		{ type: 'start-step' },
		{ type: 'tool-input-start', toolCallId, toolName },
		{ type: 'tool-input-available', toolCallId, toolName, input },
		{ type: 'finish-step' },
		{ type: 'finish' },
	];
}

/** Chunks for one assistant step that streams a plain text reply. */
function textStep(text: string): StreamChunk[] {
	return [
		{ type: 'start' },
		{ type: 'start-step' },
		{ type: 'text-start', id: 't' },
		{ type: 'text-delta', id: 't', delta: text },
		{ type: 'text-end', id: 't' },
		{ type: 'finish-step' },
		{ type: 'finish' },
	];
}

/** A transport that replays one prescripted stream per `sendMessages` call. */
function scriptedTransport(steps: StreamChunk[][]): ChatTransport<PptxAiUIMessage> {
	let call = 0;
	return {
		async sendMessages() {
			const chunks = steps[call] ?? textStep('');
			call += 1;
			return new ReadableStream({
				start(controller) {
					for (const chunk of chunks) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});
		},
		async reconnectToStream() {
			return null;
		},
	} as unknown as ChatTransport<PptxAiUIMessage>;
}

/** Poll until `predicate` holds or the deadline passes. */
async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met before deadline');
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

function assistantText(messages: PptxAiUIMessage[]): string {
	const parts = messages.flatMap((m) => (m.role === 'assistant' ? m.parts : []));
	return parts
		.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
		.map((p) => p.text)
		.join('');
}

interface ToolPartView {
	state?: string;
	output?: unknown;
}

/** Locate the first assistant tool part for `toolName` (SDK parts are `tool-<name>`). */
function toolPart(messages: PptxAiUIMessage[], toolName: string): ToolPartView | undefined {
	for (const m of messages) {
		if (m.role !== 'assistant') {
			continue;
		}
		for (const part of m.parts as { type: string }[]) {
			if (part.type === `tool-${toolName}`) {
				return part as ToolPartView;
			}
		}
	}
	return undefined;
}

function config(connection: PptxAiConfig['connection'], writePolicy?: PptxAiConfig['writePolicy']) {
	return { connection, writePolicy } satisfies PptxAiConfig;
}

function elementText(
	bridge: ReturnType<typeof makeMockBridge>,
	slide: number,
	element: number,
): string {
	return (bridge.getSlides()[slide].elements[element] as { text: string }).text;
}

describe('ai flow (scripted transport, no model)', () => {
	it('read flow: a read tool call returns real bridge data and the turn completes', async () => {
		const bridge = makeMockBridge();
		const controller = await createVanillaChat({
			bridge,
			config: config({
				kind: 'transport',
				transport: scriptedTransport([
					toolCallStep('call-read', 'get_deck_overview', {}),
					textStep('This deck has 2 slides.'),
				]),
			}),
		});

		await controller.sendMessage('How many slides are there?');
		await waitFor(() =>
			assistantText(controller.getSnapshot().messages).includes('This deck has 2 slides.'),
		);

		const snap = controller.getSnapshot();
		expect(snap.status).toBe('ready');

		const part = toolPart(snap.messages, 'get_deck_overview');
		expect(part?.state).toBe('output-available');
		const output = part?.output as { meta?: { slideCount?: number } };
		expect(output.meta?.slideCount).toBe(2);

		// Reads never stage or mutate.
		expect(controller.proposals.list()).toHaveLength(0);
		expect(bridge.edits).toHaveLength(0);
	});

	it('staged write: the edit is staged, not applied, until accepted (one history entry)', async () => {
		const bridge = makeMockBridge();
		const controller = await createVanillaChat({
			bridge,
			config: config({
				kind: 'transport',
				transport: scriptedTransport([
					toolCallStep('call-write', 'update_element', {
						slideIndex: 0,
						elementId: 'el-1',
						text: 'Renamed Title',
					}),
					textStep('I have staged a title edit for your review.'),
				]),
			}),
		});

		await controller.sendMessage('Rename the first title to Renamed Title');
		await waitFor(() => controller.proposals.list().length > 0);

		const proposals = controller.proposals.list();
		expect(proposals).toHaveLength(1);
		expect(proposals[0].summary.length).toBeGreaterThan(0);

		// Staged only: the deck is untouched and no history entry exists yet.
		expect(bridge.edits).toHaveLength(0);
		expect(elementText(bridge, 0, 0)).toBe('Title One');

		// Accept -> applied through bridge.applySlidesUpdate as ONE history entry.
		expect(controller.proposals.apply(proposals[0].id)).toBeTruthy();
		expect(bridge.edits).toHaveLength(1);
		expect(elementText(bridge, 0, 0)).toBe('Renamed Title');
		expect(controller.proposals.list()).toHaveLength(0);
	});

	it('staged write: revert discards the proposal without mutating the deck', async () => {
		const bridge = makeMockBridge();
		const controller = await createVanillaChat({
			bridge,
			config: config({
				kind: 'transport',
				transport: scriptedTransport([
					toolCallStep('call-write', 'update_element', {
						slideIndex: 0,
						elementId: 'el-1',
						text: 'Should Not Persist',
					}),
					textStep('Staged.'),
				]),
			}),
		});

		await controller.sendMessage('Rename the first title');
		await waitFor(() => controller.proposals.list().length > 0);

		const [proposal] = controller.proposals.list();
		expect(controller.proposals.revert(proposal.id)).toBeTruthy();
		expect(controller.proposals.list()).toHaveLength(0);
		expect(bridge.edits).toHaveLength(0);
		expect(elementText(bridge, 0, 0)).toBe('Title One');
	});

	it('auto write: the edit applies immediately with no proposal', async () => {
		const bridge = makeMockBridge();
		const controller = await createVanillaChat({
			bridge,
			config: config(
				{
					kind: 'transport',
					transport: scriptedTransport([
						toolCallStep('call-auto', 'update_element', {
							slideIndex: 0,
							elementId: 'el-1',
							text: 'Auto Renamed',
						}),
						textStep('Done.'),
					]),
				},
				'auto',
			),
		});

		await controller.sendMessage('Rename it now');
		await waitFor(() => bridge.edits.length > 0);

		expect(bridge.edits).toHaveLength(1);
		expect(controller.proposals.list()).toHaveLength(0);
		expect(elementText(bridge, 0, 0)).toBe('Auto Renamed');
	});

	it('delete_slides always requires approval, even under the auto policy', async () => {
		const bridge = makeMockBridge();
		const slideCount = bridge.getSlides().length;
		const controller = await createVanillaChat({
			bridge,
			config: config(
				{
					kind: 'transport',
					transport: scriptedTransport([
						toolCallStep('call-del', 'delete_slides', { slideIndexes: [1] }),
						textStep('Please confirm before I delete slide 2.'),
					]),
				},
				'auto',
			),
		});

		await controller.sendMessage('Delete slide 2');
		await waitFor(() => controller.proposals.list().length > 0);

		// Staged for review; nothing deleted despite the auto policy.
		expect(controller.proposals.list()).toHaveLength(1);
		expect(bridge.edits).toHaveLength(0);
		expect(bridge.getSlides()).toHaveLength(slideCount);

		const part = toolPart(controller.getSnapshot().messages, 'delete_slides');
		const output = part?.output as { staged?: boolean; requiresApproval?: boolean };
		expect(output.staged).toBeTruthy();
		expect(output.requiresApproval).toBeTruthy();
	});
});

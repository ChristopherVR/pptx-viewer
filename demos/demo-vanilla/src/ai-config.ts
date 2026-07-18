/**
 * Demo-only AI wiring: this is the "host supplies the provider" example. The
 * demo collects an OpenAI-compatible base URL, API key, and model id, then
 * constructs an in-browser language model via `@ai-sdk/openai-compatible` and
 * hands it to the viewer as `ai: { connection: { kind: 'model', model } }`.
 *
 * Real apps would normally keep the key server-side and use a `kind: 'endpoint'`
 * connection instead; running the model in the browser here keeps the demo
 * self-contained. When the API key or model id is blank the viewer opens with no
 * AI assistant at all.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { PptxAiConfig } from 'pptx-vanilla-viewer';

import { t } from './demo-i18n';

const KEY_BASE_URL = 'demo.ai.baseURL';
const KEY_API_KEY = 'demo.ai.apiKey';
const KEY_MODEL = 'demo.ai.model';

interface AiSettings {
	baseURL: string;
	apiKey: string;
	model: string;
}

function read(): AiSettings {
	return {
		baseURL: localStorage.getItem(KEY_BASE_URL) ?? 'https://api.openai.com/v1',
		apiKey: localStorage.getItem(KEY_API_KEY) ?? '',
		model: localStorage.getItem(KEY_MODEL) ?? 'gpt-4o-mini',
	};
}

/**
 * Build the viewer `ai` option from the persisted demo settings, or `undefined`
 * when the key/model are blank (viewer opens with no assistant).
 */
export function buildViewerAiConfig(): PptxAiConfig | undefined {
	const settings = read();
	if (!settings.apiKey.trim() || !settings.model.trim()) {
		return undefined;
	}
	const provider = createOpenAICompatible({
		name: 'demo-openai-compatible',
		baseURL: settings.baseURL.trim(),
		apiKey: settings.apiKey.trim(),
	});
	return {
		connection: { kind: 'model', model: provider(settings.model.trim()) },
		writePolicy: 'stage',
	};
}

function field(label: string, key: string, value: string, type: 'text' | 'password'): HTMLElement {
	const wrap = document.createElement('label');
	wrap.className = 'demo-ai-field';
	const span = document.createElement('span');
	span.textContent = label;
	const input = document.createElement('input');
	input.type = type;
	input.value = value;
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.addEventListener('input', () => localStorage.setItem(key, input.value));
	wrap.append(span, input);
	return wrap;
}

/**
 * Build the landing-screen AI settings card. Values persist to `localStorage`
 * on input and take effect the next time a deck is opened.
 */
export function createAiConfigCard(): HTMLElement {
	const settings = read();
	const card = document.createElement('section');
	card.className = 'demo-ai-card';

	const title = document.createElement('h2');
	title.className = 'demo-ai-title';
	title.textContent = t('demo.ai.title');
	const note = document.createElement('p');
	note.className = 'demo-ai-note';
	note.textContent = t('demo.ai.note');

	card.append(
		title,
		note,
		field(t('demo.ai.baseUrl'), KEY_BASE_URL, settings.baseURL, 'text'),
		field(t('demo.ai.apiKey'), KEY_API_KEY, settings.apiKey, 'password'),
		field(t('demo.ai.model'), KEY_MODEL, settings.model, 'text'),
	);
	return card;
}

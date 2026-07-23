/**
 * Demo-only example of "the host provides the AI provider".
 *
 * The pptx-angular-viewer package ships NO model or API key. A host application
 * supplies a `PptxAiConfig` whose `connection` reaches a language model. Here
 * the demo reads an OpenAI-compatible base URL + API key + model id from
 * localStorage and builds an in-browser model with `@ai-sdk/openai-compatible`,
 * handed to the viewer as `[ai]="{ connection: { kind: 'model', model } }"`.
 *
 * There is deliberately NO configuration UI on the landing screen: the demo must
 * work, and be shippable, without anyone supplying a key. To try the assistant
 * locally, set the `pptx-demo-ai-config` localStorage key by hand:
 *
 *   localStorage.setItem('pptx-demo-ai-config', JSON.stringify({
 *     baseURL: 'https://api.openai.com/v1', apiKey: 'sk-...', model: 'gpt-4o-mini',
 *   }))
 *
 * This is intentionally minimal and demo-scoped: a real app would keep the key
 * server-side and use a `{ kind: 'endpoint', api }` connection instead. Mirrors
 * the React demo's `ai-config.tsx`.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { PptxAiConfig } from 'pptx-angular-viewer';

const STORAGE_KEY = 'pptx-demo-ai-config';

export interface DemoAiFields {
	baseURL: string;
	apiKey: string;
	model: string;
}

const EMPTY: DemoAiFields = { baseURL: '', apiKey: '', model: '' };

/** Read the persisted demo AI fields from localStorage (empty on any error). */
export function readStoredAiFields(): DemoAiFields {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return { ...EMPTY };
		}
		const parsed = JSON.parse(raw) as Partial<DemoAiFields>;
		return {
			baseURL: parsed.baseURL ?? '',
			apiKey: parsed.apiKey ?? '',
			model: parsed.model ?? '',
		};
	} catch {
		return { ...EMPTY };
	}
}

/**
 * Build a viewer `ai` config from the fields, or `undefined` when incomplete or
 * malformed (a bad base URL throws inside the SDK; swallow it so the demo keeps
 * working with AI simply off).
 */
export function buildDemoAiConfig(fields: DemoAiFields): PptxAiConfig | undefined {
	const baseURL = fields.baseURL.trim();
	const model = fields.model.trim();
	if (baseURL.length === 0 || model.length === 0) {
		return undefined;
	}
	try {
		const provider = createOpenAICompatible({
			name: 'demo',
			baseURL,
			apiKey: fields.apiKey.trim() || undefined,
		});
		return { connection: { kind: 'model', model: provider.chatModel(model) } };
	} catch {
		return undefined;
	}
}

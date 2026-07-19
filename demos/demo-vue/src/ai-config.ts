/**
 * Demo-only example of "the host provides the AI provider".
 *
 * The pptx-vue-viewer package ships NO model or API key. A host application
 * supplies a `PptxAiConfig` whose `connection` reaches a language model. Here
 * the demo lets the user paste an OpenAI-compatible base URL + API key + model
 * id and builds an in-browser model with `@ai-sdk/openai-compatible`, which is
 * handed to the viewer as `ai={{ connection: { kind: 'model', model } }}`.
 *
 * This is intentionally minimal and demo-scoped: a real app would keep the key
 * server-side and use a `{ kind: 'endpoint', api }` connection instead.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { PptxAiConfig } from 'pptx-vue-viewer';
import { computed, reactive } from 'vue';
import type { ComputedRef } from 'vue';

const STORAGE_KEY = 'pptx-demo-ai-config';

export interface DemoAiFields {
	baseURL: string;
	apiKey: string;
	model: string;
}

function readStored(): DemoAiFields {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return { baseURL: '', apiKey: '', model: '' };
		}
		const parsed = JSON.parse(raw) as Partial<DemoAiFields>;
		return {
			baseURL: parsed.baseURL ?? '',
			apiKey: parsed.apiKey ?? '',
			model: parsed.model ?? '',
		};
	} catch {
		return { baseURL: '', apiKey: '', model: '' };
	}
}

/** Build a viewer `ai` config from the fields, or undefined when incomplete. */
export function buildDemoAiConfig(fields: DemoAiFields): PptxAiConfig | undefined {
	const baseURL = fields.baseURL.trim();
	const model = fields.model.trim();
	if (baseURL.length === 0 || model.length === 0) {
		return undefined;
	}
	const provider = createOpenAICompatible({
		name: 'demo',
		baseURL,
		apiKey: fields.apiKey.trim() || undefined,
	});
	return { connection: { kind: 'model', model: provider.chatModel(model) } };
}

export interface UseDemoAiConfigResult {
	fields: DemoAiFields;
	config: ComputedRef<PptxAiConfig | undefined>;
	setField: (key: keyof DemoAiFields, value: string) => void;
}

/** Reactive store for the demo AI fields, persisted to localStorage. */
export function useDemoAiConfig(): UseDemoAiConfigResult {
	const fields = reactive<DemoAiFields>(readStored());

	function setField(key: keyof DemoAiFields, value: string): void {
		fields[key] = value;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...fields }));
		} catch {
			/* ignore quota / privacy-mode errors */
		}
	}

	// Rebuild the model only when the fields change. A malformed base URL throws
	// inside the SDK; swallow it so the demo keeps working with AI simply off.
	const config = computed<PptxAiConfig | undefined>(() => {
		try {
			return buildDemoAiConfig({ ...fields });
		} catch {
			return undefined;
		}
	});

	return { fields, config, setField };
}

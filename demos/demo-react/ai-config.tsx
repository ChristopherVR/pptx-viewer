/**
 * Demo-only example of "the host provides the AI provider".
 *
 * The pptx-react-viewer package ships NO model or API key. A host application
 * supplies a `PptxAiConfig` whose `connection` reaches a language model. Here
 * the demo lets the user paste an OpenAI-compatible base URL + API key + model
 * id and builds an in-browser model with `@ai-sdk/openai-compatible`, which is
 * handed to the viewer as `ai={{ connection: { kind: 'model', model } }}`.
 *
 * This is intentionally minimal and demo-scoped: a real app would keep the key
 * server-side and use a `{ kind: 'endpoint', api }` connection instead.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { useCallback, useMemo, useState } from 'react';

import type { PptxAiConfig } from '../../packages/react/src/viewer';

const STORAGE_KEY = 'pptx-demo-ai-config';

interface DemoAiFields {
	baseURL: string;
	apiKey: string;
	model: string;
}

const EMPTY: DemoAiFields = { baseURL: '', apiKey: '', model: '' };

function readStored(): DemoAiFields {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return EMPTY;
		}
		const parsed = JSON.parse(raw) as Partial<DemoAiFields>;
		return {
			baseURL: parsed.baseURL ?? '',
			apiKey: parsed.apiKey ?? '',
			model: parsed.model ?? '',
		};
	} catch {
		return EMPTY;
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
	config: PptxAiConfig | undefined;
	setField: (key: keyof DemoAiFields, value: string) => void;
}

/** Reactive store for the demo AI fields, persisted to localStorage. */
export function useDemoAiConfig(): UseDemoAiConfigResult {
	const [fields, setFields] = useState<DemoAiFields>(() => readStored());

	const setField = useCallback((key: keyof DemoAiFields, value: string) => {
		setFields((prev) => {
			const next = { ...prev, [key]: value };
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch {
				/* ignore quota / privacy-mode errors */
			}
			return next;
		});
	}, []);

	// Rebuild the model only when the fields change. A malformed base URL throws
	// inside the SDK; swallow it so the demo keeps working with AI simply off.
	const config = useMemo(() => {
		try {
			return buildDemoAiConfig(fields);
		} catch {
			return undefined;
		}
	}, [fields]);

	return { fields, config, setField };
}

export interface AiDemoConfigFormProps {
	fields: DemoAiFields;
	onChange: (key: keyof DemoAiFields, value: string) => void;
	enabled: boolean;
}

/** Landing-screen form for the demo AI provider. */
export function AiDemoConfigForm({ fields, onChange, enabled }: AiDemoConfigFormProps) {
	const input =
		'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary';
	return (
		<details className='max-w-[900px] w-full mt-4 rounded-lg border border-border bg-card/40 p-4 text-left'>
			<summary className='cursor-pointer text-sm font-medium text-foreground'>
				AI assistant (optional){' '}
				<span className={enabled ? 'text-primary' : 'text-muted-foreground'}>
					{enabled ? '- ready' : '- not configured'}
				</span>
			</summary>
			<p className='mt-2 text-xs text-muted-foreground'>
				Paste an OpenAI-compatible endpoint to enable the in-viewer assistant. The demo builds the
				model in the browser; a real app would proxy through its own backend and keep the key
				server-side.
			</p>
			<div className='mt-3 grid gap-2 sm:grid-cols-3'>
				<label className='flex flex-col gap-1 text-xs text-muted-foreground'>
					Base URL
					<input
						className={input}
						type='url'
						placeholder='https://api.openai.com/v1'
						value={fields.baseURL}
						onChange={(e) => onChange('baseURL', e.target.value)}
					/>
				</label>
				<label className='flex flex-col gap-1 text-xs text-muted-foreground'>
					API key
					<input
						className={input}
						type='password'
						placeholder='sk-...'
						value={fields.apiKey}
						onChange={(e) => onChange('apiKey', e.target.value)}
					/>
				</label>
				<label className='flex flex-col gap-1 text-xs text-muted-foreground'>
					Model id
					<input
						className={input}
						type='text'
						placeholder='gpt-4o-mini'
						value={fields.model}
						onChange={(e) => onChange('model', e.target.value)}
					/>
				</label>
			</div>
		</details>
	);
}

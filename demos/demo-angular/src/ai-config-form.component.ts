/**
 * AiConfigFormComponent: the landing-screen form for the demo AI provider.
 * Mirrors the React demo's `AiDemoConfigForm`. Lets the user paste an
 * OpenAI-compatible base URL + API key + model id; the parent app builds the
 * in-browser model and passes it to the viewer as `[ai]`.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { DemoAiFields } from './ai-config';

@Component({
	selector: 'app-ai-config-form',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [
		`
			:host {
				display: block;
				max-width: 900px;
				width: 100%;
				margin: 1rem auto 0;
			}
			details {
				border: 1px solid rgba(148, 163, 184, 0.35);
				border-radius: 0.5rem;
				background: rgba(30, 41, 59, 0.25);
				padding: 1rem;
				text-align: left;
			}
			summary {
				cursor: pointer;
				font-size: 0.875rem;
				font-weight: 500;
			}
			.status-ready {
				color: #f97316;
			}
			.status-off {
				color: #94a3b8;
			}
			p {
				margin-top: 0.5rem;
				font-size: 0.75rem;
				color: #94a3b8;
			}
			.grid {
				margin-top: 0.75rem;
				display: grid;
				gap: 0.5rem;
			}
			@media (min-width: 640px) {
				.grid {
					grid-template-columns: repeat(3, minmax(0, 1fr));
				}
			}
			label {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				font-size: 0.75rem;
				color: #94a3b8;
			}
			input {
				width: 100%;
				border-radius: 0.375rem;
				border: 1px solid rgba(148, 163, 184, 0.35);
				background: rgba(15, 23, 42, 0.6);
				padding: 0.375rem 0.625rem;
				font-size: 0.875rem;
				color: inherit;
				outline: none;
			}
			input:focus {
				border-color: #f97316;
			}
		`,
	],
	template: `
		<details>
			<summary>
				AI assistant (optional)
				<span [class]="enabled() ? 'status-ready' : 'status-off'">
					{{ enabled() ? '- ready' : '- not configured' }}
				</span>
			</summary>
			<p>
				Paste an OpenAI-compatible endpoint to enable the in-viewer assistant. The demo builds the
				model in the browser; a real app would proxy through its own backend and keep the key
				server-side.
			</p>
			<div class="grid">
				<label>
					Base URL
					<input
						type="url"
						placeholder="https://api.openai.com/v1"
						[value]="fields().baseURL"
						(input)="change.emit({ key: 'baseURL', value: $any($event.target).value })"
					/>
				</label>
				<label>
					API key
					<input
						type="password"
						placeholder="sk-..."
						[value]="fields().apiKey"
						(input)="change.emit({ key: 'apiKey', value: $any($event.target).value })"
					/>
				</label>
				<label>
					Model id
					<input
						type="text"
						placeholder="gpt-4o-mini"
						[value]="fields().model"
						(input)="change.emit({ key: 'model', value: $any($event.target).value })"
					/>
				</label>
			</div>
		</details>
	`,
})
export class AiConfigFormComponent {
	readonly fields = input.required<DemoAiFields>();
	readonly enabled = input<boolean>(false);
	readonly change = output<{ key: keyof DemoAiFields; value: string }>();
}

/**
 * presentation-subtitle-bar.component.ts: Live caption/subtitle bar for
 * presentation mode, driven by the Web Speech API when available.
 *
 * Ported from React:
 *   packages/react/src/viewer/components/PresentationSubtitleBar.tsx
 *
 * Selector: `pptx-presentation-subtitle-bar`
 *
 * Inputs:
 *   - `visible` (required): show/hide the bar and start/stop recognition.
 *
 * When `visible` is false the component renders nothing and stops the
 * recognition session. When the Web Speech API is unavailable the bar still
 * renders but shows a "not supported" message.
 *
 * All speech-API access is isolated behind `_createRecognition()` so the rest
 * of the component (and tests) can stay pure. Caption text accumulation logic
 * lives in {@link mergeCaptionResults} (pure helper, unit-tested separately).
 */

import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	OnChanges,
	SimpleChanges,
	inject,
	input,
	signal,
} from '@angular/core';
import { translate } from '@ngx-translate/core';

import {
	captionDisplayText,
	getSpeechRecognitionCtor,
	mergeCaptionResults,
} from './presentation-subtitle-helpers';
import type { SpeechRecognitionLite, SpeechSupportState } from './presentation-subtitle-helpers';

@Component({
	selector: 'pptx-presentation-subtitle-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
			position: absolute;
			bottom: 3.5rem; /* 56 px: clear the slide-counter / nav row */
			left: 50%;
			transform: translateX(-50%);
			z-index: 70;
			max-width: 80%;
			min-width: 300px;
			pointer-events: none;
		}

		.pptx-ng-subtitle-inner {
			padding: 0.75rem 1.5rem;
			border-radius: 0.5rem;
			background: rgba(0, 0, 0, 0.75);
			border: 1px solid rgba(255, 255, 255, 0.1);
			/* Very light blur, safe to omit if the browser doesn't support it. */
			backdrop-filter: blur(4px);
		}

		.pptx-ng-subtitle-text {
			display: block;
			text-align: center;
			font-size: 0.9375rem; /* 15 px */
			line-height: 1.5;
			color: rgba(255, 255, 255, 0.7);
			font-style: italic;
			font-family: system-ui, sans-serif;
			white-space: pre-wrap;
			word-break: break-word;
		}
	`,
	template: `
		@if (visible()) {
			<div class="pptx-ng-subtitle-inner">
				<span class="pptx-ng-subtitle-text">{{ displayText() }}</span>
			</div>
		}
	`,
})
export class PresentationSubtitleBarComponent implements OnChanges {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	/** Show the subtitle bar and start speech recognition when true. */
	readonly visible = input.required<boolean>();

	// ------------------------------------------------------------------
	// Internal signals
	// ------------------------------------------------------------------

	private readonly _captionText = signal<string>('');
	private readonly _supportState = signal<SpeechSupportState>('unknown');

	/** Reactive translated caption strings (used inside the recognition wiring). */
	private readonly listeningLabel = translate('pptx.subtitles.listening');
	private readonly notSupportedLabel = translate('pptx.subtitles.notSupported');

	/** The text string rendered in the caption bar. */
	protected readonly displayText = signal<string>(this.listeningLabel());

	// ------------------------------------------------------------------
	// Recognition lifecycle bookkeeping
	// ------------------------------------------------------------------

	/**
	 * Whether the recognition session should remain running.
	 * Toggled on `visible` changes; checked in `onend` to decide whether
	 * to restart.
	 */
	private _shouldRun = false;

	/** Active recognition instance, or null when stopped. */
	private _recognition: SpeechRecognitionLite | null = null;

	private readonly _destroyRef = inject(DestroyRef);

	constructor() {
		this._destroyRef.onDestroy(() => {
			this._stopRecognition();
		});
	}

	// ------------------------------------------------------------------
	// Lifecycle
	// ------------------------------------------------------------------

	ngOnChanges(changes: SimpleChanges): void {
		if (!('visible' in changes)) {
			return;
		}
		if (this.visible()) {
			this._startRecognition();
		} else {
			this._stopRecognition();
		}
	}

	// ------------------------------------------------------------------
	// Speech recognition management
	// ------------------------------------------------------------------

	private _startRecognition(): void {
		this._shouldRun = true;
		this._captionText.set('');
		this._updateDisplayText();

		const Ctor = this._getSpeechCtor();
		if (!Ctor) {
			this._supportState.set('unsupported');
			this._updateDisplayText();
			return;
		}
		this._supportState.set('supported');

		const recognition = new Ctor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

		recognition.onresult = (event) => {
			const merged = mergeCaptionResults(event.resultIndex, event.results);
			if (merged.length > 0) {
				this._captionText.set(merged);
				this._updateDisplayText();
			}
		};

		recognition.onerror = () => {
			// Keep the bar alive; `onend` will attempt restart if still visible.
		};

		recognition.onend = () => {
			if (!this._shouldRun) {
				return;
			}
			try {
				recognition.start();
			} catch {
				// Browser may throttle rapid restarts; the next visibility toggle will retry.
			}
		};

		this._recognition = recognition;
		try {
			recognition.start();
		} catch {
			this._supportState.set('unsupported');
			this._updateDisplayText();
		}
	}

	private _stopRecognition(): void {
		this._shouldRun = false;
		if (this._recognition) {
			this._recognition.stop();
			this._recognition = null;
		}
		this._captionText.set('');
		this._updateDisplayText();
	}

	/**
	 * Thin wrapper around {@link getSpeechRecognitionCtor} so tests can spy on
	 * or override this method without patching `globalThis`.
	 */
	protected _getSpeechCtor() {
		return getSpeechRecognitionCtor();
	}

	// ------------------------------------------------------------------
	// Display text derivation
	// ------------------------------------------------------------------

	private _updateDisplayText(): void {
		const text = captionDisplayText(
			this._supportState(),
			this._captionText(),
			this.notSupportedLabel(),
			this.listeningLabel(),
		);
		this.displayText.set(text);
	}
}

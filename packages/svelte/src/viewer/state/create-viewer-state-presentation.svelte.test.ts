/**
 * Options > Advanced > "Prompt to keep ink annotations when exiting": off
 * must discard the ink silently instead of always opening the keep/discard
 * dialog. Source-text guard, matching `PresentationOverlays.svelte.test.ts`:
 * this cluster wires reactive `$effect`s from Svelte 5 runes, which vitest
 * cannot mount outside a component, so the pure wiring is asserted as text.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
	resolve(process.cwd(), 'src/viewer/state/create-viewer-state-presentation.svelte.ts'),
	'utf8',
);

describe('presentation cluster: prompt to keep ink annotations', () => {
	it('gates the keep/discard dialog on the option', () => {
		expect(source).toContain('optionsState.options.advanced.slideShowPromptKeepInkAnnotations');
	});

	it('discards the ink silently instead of opening the dialog when the option is off', () => {
		const guard =
			/if \(optionsState\.options\.advanced\.slideShowPromptKeepInkAnnotations\) \{(?<onBranch>[^}]*)\} else \{(?<offBranch>[^}]*)\}/u.exec(
				source,
			);
		expect(guard?.groups?.['onBranch']).toContain('parityUi.keepAnnotationsOpen = true');
		expect(guard?.groups?.['offBranch']).toContain('parityUi.annotations.clear()');
	});
});

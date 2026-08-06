import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The running-show DOM contract on the Angular canvas.
 *
 * Every binding's PRESENTING stage carries BOTH the shared
 * `data-pptx-presenting` marker (stamped by
 * `applyRenderedElementAccessibility`) and `aria-roledescription="slide"`, so
 * the framework-neutral e2e probe (and assistive tech) find the show the same
 * way in all five bindings. Angular's show canvas renders with
 * `interactive=false` (only the editing canvas exposes the full editing
 * contract), which used to withhold the roledescription from the show stage
 * entirely; the template must therefore also grant it while `presenting()`.
 *
 * No Angular TestBed in this package (see `vitest.config.ts`), so the template
 * contract is read from the source, matching
 * `reading-view-overlay.component.test.ts`.
 */
import { describe, expect, it } from 'vitest';

const HTML = readFileSync(path.join(__dirname, 'slide-canvas.component.html'), 'utf8');
const TS = readFileSync(path.join(__dirname, 'slide-canvas.component.ts'), 'utf8');

describe('slideCanvas show contract', () => {
	it('grants aria-roledescription="slide" to the presenting stage too', () => {
		expect(HTML).toContain(
			`[attr.aria-roledescription]="interactive() || presenting() ? 'slide' : null"`,
		);
	});

	it('stamps the shared data-pptx-presenting marker through the accessibility pass', () => {
		// The shared pass owns the marker; the component must run it for a
		// presenting stage (not only the interactive editing canvas).
		expect(TS).toContain('applyRenderedElementAccessibility(stage, elements, { presenting })');
		expect(TS).toMatch(/if \(stage && \(interactive \|\| presenting\)\)/u);
	});
});

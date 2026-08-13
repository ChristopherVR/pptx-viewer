/**
 * Guards on this binding's `theme.css` token bridge.
 *
 * `theme.css` exists three times (react / vue / angular) and has drifted: only
 * the Angular copy carries the `--pptx-inspector-*` derivation, of which shared
 * `theme/css-vars.ts` derives two (`inspector-active` from `primary`,
 * `inspector-border` from `border`). Until the other thirteen move into shared,
 * these tests keep the local block in the shape that makes the move mechanical:
 * every inspector token must resolve from a BASE `--pptx-*` token, never from a
 * colour of its own, and the two shared already owns must derive from the same
 * source shared uses (otherwise a themed viewer and an unthemed one disagree).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { defaultCssVars } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(import.meta.dirname, 'theme.css'), 'utf8');

/** Every `--pptx-inspector-*: <value>;` declaration in the stylesheet. */
function inspectorDeclarations(): Array<{ name: string; value: string }> {
	const out: Array<{ name: string; value: string }> = [];
	const re = /(--pptx-inspector-[a-z-]+):\s*([^;]+);/gu;
	let match = re.exec(css);
	while (match) {
		out.push({ name: match[1], value: match[2].replace(/\s+/gu, ' ').trim() });
		match = re.exec(css);
	}
	return out;
}

describe('angular theme.css inspector tokens', () => {
	it('derives every inspector token from a base --pptx-* token', () => {
		const decls = inspectorDeclarations();
		expect(decls.length).toBeGreaterThan(0);
		const hardcoded = decls.filter((decl) => !decl.value.includes('var(--pptx-'));
		expect(hardcoded).toStrictEqual([]);
	});

	// The two shared already emits inline on this same element. If the local
	// derivation ever picked a different source, a themed viewer and an unthemed
	// one would paint different inspector chrome for the same theme.
	it('matches shared for the two tokens shared derives', () => {
		const byName = new Map(inspectorDeclarations().map((decl) => [decl.name, decl.value]));
		expect(byName.get('--pptx-inspector-active')).toContain('var(--pptx-primary');
		expect(byName.get('--pptx-inspector-border')).toContain('var(--pptx-border');
		// Shared's own defaults confirm the source pairing (primary → active,
		// border → border), so the two derivations cannot drift apart silently.
		const shared = defaultCssVars();
		expect(shared['--pptx-inspector-active']).toBe(shared['--pptx-primary']);
		expect(shared['--pptx-inspector-border']).toBe(shared['--pptx-border']);
	});

	it('scopes reduced motion and scrollbars to this binding root', () => {
		// React scopes the same rules on `[data-pptx-viewer]` and Vue on
		// `.pptx-vue-viewer`; the selector is the one part of this stylesheet
		// that is legitimately per-binding.
		expect(css).toContain(':where(.pptx-ng-viewer) ::-webkit-scrollbar');
		// Selectors only; a prose mention of React's selector is fine.
		const selectors = css.replace(/\/\*[\s\S]*?\*\//gu, '');
		expect(selectors).not.toContain('[data-pptx-viewer]');
		expect(selectors).not.toContain('.pptx-vue-viewer');
	});
});

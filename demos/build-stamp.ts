import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import type { Plugin } from 'vite';

/**
 * Vite plugin that stamps a demo with the binding's package version, the
 * commit it was built from, and the build date, rendered as a small
 * fixed-position badge injected into index.html. Keeps the "which version is
 * this hosted demo?" question answerable at a glance without touching any
 * demo source file.
 *
 * The badge shows only on the landing screen: once a presentation is created
 * or opened (i.e. a viewer root mounts), it hides so it can never clip over
 * viewer chrome like the notes panel.
 *
 * The commit comes from GITHUB_SHA in CI (set automatically for every
 * workflow step) with a local `git rev-parse` fallback for dev builds.
 */

const REPO_URL = 'https://github.com/ChristopherVR/pptx-viewer';

function commitSha(): string {
	if (process.env.GITHUB_SHA) {
		return process.env.GITHUB_SHA.slice(0, 7);
	}
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
	} catch {
		return '';
	}
}

const BADGE_STYLE = [
	'position:fixed',
	'bottom:8px',
	'right:8px',
	'z-index:2147483647',
	'padding:2px 8px',
	'border-radius:9999px',
	'background:rgba(15,23,42,0.55)',
	'color:#e2e8f0',
	'font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
	'text-decoration:none',
	'opacity:1',
	'transition:opacity 0.15s',
	'pointer-events:auto',
].join(';');

export function buildStamp(pkgJsonPath: string): Plugin {
	const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { name: string; version: string };
	const sha = commitSha();
	const date = new Date().toISOString().slice(0, 10);
	const label = [`${pkg.name} v${pkg.version}`, sha || 'local', date].join(' · ');
	const href = sha ? `${REPO_URL}/commit/${sha}` : REPO_URL;
	const badge =
		'<footer aria-label="Build information">' +
		`<a id="demo-build-stamp" href="${href}" target="_blank" rel="noreferrer" ` +
		`style="${BADGE_STYLE}" ` +
		`title="Built from ${sha || 'a local checkout'} on ${date}">${label}</a>` +
		'</footer>';
	// Root markers of the mounted viewer, one per binding (React attribute,
	// Vue root class, Angular element). Badge is visible only while none exist.
	const viewerRoots = '[data-pptx-viewer],.pptx-vue-viewer,pptx-viewer';
	const toggle =
		'<script>(()=>{' +
		'const b=document.getElementById("demo-build-stamp");if(!b)return;' +
		`const u=()=>{b.style.display=document.querySelector("${viewerRoots}")?"none":"";};` +
		'new MutationObserver(u).observe(document.body,{childList:true,subtree:true});u();' +
		'})();</scr' +
		'ipt>';
	return {
		name: 'demo-build-stamp',
		transformIndexHtml(html: string): string {
			return html.replace('</body>', `${badge}\n${toggle}\n</body>`);
		},
	};
}

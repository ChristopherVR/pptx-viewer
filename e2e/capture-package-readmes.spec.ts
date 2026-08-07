/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright capture spec */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { resetTabSession } from './support/deck';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sampleDeck = resolve(root, '.github/assets/sample-deck.pptx');
const outputDir = resolve(root, '.github/assets/packages');

if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

async function loadDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.waitForTimeout(650);
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(700);
}

async function captureBinding(page: Page, binding: string): Promise<void> {
	const elements = page.locator('[data-pptx-element="true"]');
	if (binding === 'react') {
		const element = elements.first();
		const box = await element.boundingBox();
		if (box) {
			const x = box.x + box.width / 2;
			const y = box.y + box.height / 2;
			await page.mouse.click(x, y);
			await page.waitForTimeout(500);
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x + 70, y + 32, { steps: 18 });
			await page.mouse.up();
		}
	} else if (binding === 'vue') {
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(800);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(800);
		await page.keyboard.press('ArrowLeft');
	} else if (binding === 'angular') {
		const insertTab = page.getByRole('tab', { name: /insert/iu }).first();
		if (await insertTab.isVisible()) {
			await insertTab.click();
		}
		await page.waitForTimeout(900);
		const viewTab = page.getByRole('tab', { name: /view/iu }).first();
		if (await viewTab.isVisible()) {
			await viewTab.click();
		}
	} else if (binding === 'svelte') {
		const slideShowTab = page.getByRole('tab', { name: /slide show/iu }).first();
		if (await slideShowTab.isVisible()) {
			await slideShowTab.click();
		}
		await page.waitForTimeout(700);
		const present = page.getByRole('button', { name: /present|play|start/iu }).first();
		if (await present.isVisible()) {
			await present.click();
		}
		await page.waitForTimeout(900);
		await page.keyboard.press('ArrowRight');
	} else {
		await elements.nth(1).click();
		await page.waitForTimeout(700);
		await page.keyboard.press('Delete');
		await page.waitForTimeout(700);
		await page.keyboard.press('Control+z');
	}
	await page.waitForTimeout(1100);
}

async function saveGif(
	page: Page,
	testInfo: TestInfo,
	name = testInfo.project.name,
	startAt = '1.7',
): Promise<void> {
	const video = page.video();
	if (!video) {
		return;
	}
	const webm = resolve(testInfo.outputDir, `${name}.webm`);
	const gif = resolve(outputDir, `${name}.gif`);
	await video.saveAs(webm);
	execFileSync(
		'ffmpeg',
		[
			'-y',
			'-ss',
			startAt,
			'-i',
			webm,
			'-vf',
			'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
			'-loop',
			'0',
			gif,
		],
		{ stdio: 'pipe' },
	);
}

test('capture package-specific demo', async ({ page }, testInfo) => {
	await loadDeck(page);
	await captureBinding(page, testInfo.project.name);
	await page.close();
	await saveGif(page, testInfo, `${testInfo.project.name}-demo`);
});

test('capture interactive installer', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'react', 'The CLI asset only needs one capture project.');
	await page.setContent(`
		<style>
		*{box-sizing:border-box}body{margin:0;background:#111827;color:#e5e7eb;font-family:Consolas,"Cascadia Code",monospace}.shell{width:1120px;height:620px;margin:50px auto;overflow:hidden;border:1px solid #374151;border-radius:18px;background:#0b1020;box-shadow:0 28px 80px #0009}.bar{height:48px;display:flex;align-items:center;gap:9px;padding:0 18px;background:#182033;border-bottom:1px solid #374151}.dot{width:12px;height:12px;border-radius:50%;background:#ef4444}.dot:nth-child(2){background:#f59e0b}.dot:nth-child(3){background:#22c55e}.title{margin-left:14px;color:#94a3b8;font:13px system-ui,sans-serif}.term{padding:28px 34px;font-size:19px;line-height:1.63;white-space:pre}.cyan{color:#22d3ee}.green{color:#34d399}.dim{color:#64748b}.bold{color:#fff;font-weight:700}.cursor{display:inline-block;width:10px;height:21px;background:#22d3ee;vertical-align:-4px;animation:blink .7s steps(1) infinite}@keyframes blink{50%{opacity:0}}
		</style>
		<div class="shell"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="title">PowerShell - npx @christophervr/pptx-viewer</span></div><div id="term" class="term"></div></div>
		<script>
		const term=document.querySelector('#term');const frames=[
		'<span class="dim">PS C:\\\\projects\\\\slides&gt;</span> npx @christophervr/pptx-viewer<span class="cursor"></span>',
		'<span class="cyan bold">pptx-viewer</span> <span class="dim">· interactive installer</span>\\n\\n<span class="bold">What are you building with pptx-viewer?</span>\\n<span class="dim">(↑/↓ move, space toggle, a select all, enter confirm)</span>\\n<span class="cyan">❯</span> <span class="green">◉</span> <span class="bold">React</span> <span class="dim">- viewer/editor component for React 19</span>\\n  ◯ Vue 3    <span class="dim">- viewer/editor component for Vue 3</span>\\n  ◯ Angular  <span class="dim">- viewer/editor component for Angular</span>\\n  ◯ Svelte 5 <span class="dim">- viewer/editor component for Svelte 5</span>\\n  ◯ Vanilla  <span class="dim">- zero-framework, plain DOM</span>\\n  ◯ Core     <span class="dim">- headless TypeScript engine</span>\\n  ◯ MCP      <span class="dim">- AI-agent PowerPoint tools</span>',
		'<span class="cyan bold">pptx-viewer</span> <span class="dim">· interactive installer</span>\\n\\n<span class="bold">What are you building with pptx-viewer?</span>\\n<span class="dim">(↑/↓ move, space toggle, a select all, enter confirm)</span>\\n  ◉ React    <span class="dim">- viewer/editor component for React 19</span>\\n  ◯ Vue 3    <span class="dim">- viewer/editor component for Vue 3</span>\\n  ◯ Angular  <span class="dim">- viewer/editor component for Angular</span>\\n  ◯ Svelte 5 <span class="dim">- viewer/editor component for Svelte 5</span>\\n  ◯ Vanilla  <span class="dim">- zero-framework, plain DOM</span>\\n  ◯ Core     <span class="dim">- headless TypeScript engine</span>\\n<span class="cyan">❯</span> <span class="green">◉</span> <span class="bold">MCP</span> <span class="dim">- AI-agent PowerPoint tools</span>',
		'<span class="green">✔</span> React, MCP server\\n\\n<span class="bold">Install into the current project, or scaffold a new one?</span>\\n<span class="dim">(↑/↓ move, enter confirm)</span>\\n  Install here <span class="dim">- add packages to this project</span>\\n<span class="cyan">❯</span> <span class="bold">Scaffold a new project</span> <span class="dim">- create a ready-to-run app</span>',
		'<span class="green">✔</span> Scaffold a new project\\n\\n<span class="bold">Project directory name</span> <span class="cyan">pptx-react-app</span>\\n\\n<span class="bold">About to scaffold</span> <span class="cyan">pptx-react-app</span> with create-vite, then install with npm.\\n\\n<span class="green">✔ Done!</span> Starting dev server...<span class="cursor"></span>'
		];let i=0;term.innerHTML=frames[0];const timer=setInterval(()=>{i+=1;term.innerHTML=frames[Math.min(i,frames.length-1)];if(i===frames.length-1)clearInterval(timer)},1100);
		</script>`);
	await page.waitForTimeout(5600);
	await page.close();
	await saveGif(page, testInfo, 'cli-installer', '0');
});

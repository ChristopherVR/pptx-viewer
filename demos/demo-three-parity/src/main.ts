/**
 * 3D parity harness. For every slide of a ground-truth deck, shows the
 * PowerPoint COM export next to our `<pptx-three-view>` rendering of the
 * slide's chart / SmartArt elements, on a slide stage scaled the same way the
 * viewers scale slides (so zoom-aware sizing is exercised too).
 *
 * Query params:
 *   deck=charts|smartart   which ground-truth deck (default charts)
 *   only=3,7               restrict to these 1-based slide numbers
 *   onion=1                overlay the ground truth at 50% over our render
 *   w=640                  cell width in CSS px
 *   interactive=1          enable orbit / select on the scenes
 */
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import {
	buildChart3DSpecForElement,
	buildSmartArt3DSpecForElement,
	defineThreeViewElement,
} from 'pptx-viewer-shared';
import type { PptxThreeViewElement, ThreeViewSpec } from 'pptx-viewer-shared';

const params = new URLSearchParams(location.search);
const deck = params.get('deck') === 'smartart' ? 'smartart' : 'charts';
const only = new Set(
	(params.get('only') ?? '')
		.split(',')
		.map((s) => Number(s.trim()))
		.filter((n) => n > 0),
);
const onion = params.get('onion') === '1';
const cellWidth = Number(params.get('w') ?? 640);
const interactive = params.get('interactive') === '1';

const BASE = '/three-d-parity';

function specFor(element: PptxElement): ThreeViewSpec | null {
	const chart = buildChart3DSpecForElement(element);
	if (chart) {
		return { kind: 'chart', spec: chart };
	}
	const smartArt = buildSmartArt3DSpecForElement(element);
	return smartArt ? { kind: 'smartart', spec: smartArt } : null;
}

async function loadManifest(): Promise<Map<number, string>> {
	const text = await (await fetch(`${BASE}/three-d-${deck}.tsv`)).text();
	const names = new Map<number, string>();
	for (const line of text.split(/\r?\n/u)) {
		const [n, ...rest] = line.split('\t');
		if (n && Number(n) > 0) {
			names.set(Number(n), rest.join(' / '));
		}
	}
	return names;
}

function gtUrl(slideNumber: number): string {
	return deck === 'charts'
		? `${BASE}/gt/chart-${String(slideNumber).padStart(2, '0')}.webp`
		: `${BASE}/gt/sa-${String(slideNumber).padStart(3, '0')}.webp`;
}

async function main(): Promise<void> {
	defineThreeViewElement();
	const nav = document.getElementById('nav') as HTMLElement;
	nav.innerHTML = `<a href="?deck=charts">charts</a><a href="?deck=smartart">smartart</a><a href="?deck=${deck}&onion=1">onion</a> <span id="status"></span>`;
	const status = document.getElementById('status') as HTMLElement;
	const [manifest, bytes] = await Promise.all([
		loadManifest(),
		fetch(`${BASE}/three-d-${deck}.pptx`).then((r) => r.arrayBuffer()),
	]);
	const data = await new PptxHandler().load(bytes);
	const rows = document.getElementById('rows') as HTMLElement;
	const scale = cellWidth / data.width;
	const cellHeight = Math.round(data.height * scale);
	let shown = 0;
	data.slides.forEach((slide, index) => {
		const n = index + 1;
		if (only.size > 0 && !only.has(n)) {
			return;
		}
		const gtProbe = new Image();
		gtProbe.src = gtUrl(n);
		const row = document.createElement('div');
		row.className = 'row';
		row.dataset.slide = String(n);
		const label = document.createElement('div');
		label.className = 'label';
		label.innerHTML = `<b>${n}</b> ${manifest.get(n) ?? ''}<div class="state"></div>`;
		const gt = document.createElement('div');
		gt.className = 'cell';
		gt.style.cssText = `width:${cellWidth}px;height:${cellHeight}px`;
		gt.appendChild(gtProbe);
		const ours = document.createElement('div');
		ours.className = 'cell';
		ours.style.cssText = `width:${cellWidth}px;height:${cellHeight}px`;
		const stage = document.createElement('div');
		stage.className = 'slide';
		stage.style.cssText = `width:${data.width}px;height:${data.height}px;transform:scale(${scale})`;
		ours.appendChild(stage);
		for (const element of slide.elements) {
			const spec = specFor(element);
			if (!spec) {
				continue;
			}
			const box = document.createElement('div');
			box.className = 'el';
			box.style.cssText = `left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px`;
			const view = document.createElement('pptx-three-view') as PptxThreeViewElement;
			view.spec = spec;
			view.interactive = interactive;
			view.dataset.elementId = element.id;
			view.addEventListener('pptx-three-state', (e) => {
				(label.querySelector('.state') as HTMLElement).textContent = (
					e as CustomEvent<{ state: string }>
				).detail.state;
			});
			box.appendChild(view);
			stage.appendChild(box);
		}
		if (onion) {
			const overlay = gtProbe.cloneNode() as HTMLImageElement;
			overlay.className = 'onion';
			ours.appendChild(overlay);
		}
		row.append(label, gt, ours);
		rows.appendChild(row);
		shown++;
	});
	status.textContent = `${deck}: ${shown} slides`;
}

void main();

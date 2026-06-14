/**
 * Generate a clean, non-proprietary sample `.pptx` used for documentation
 * screenshots (e.g. .github/assets/editor.png). Contains only generic,
 * fictional content — no third-party logos or branding.
 *
 *   bun run scripts/make-sample-deck.mjs [outPath]
 */
import { writeFile } from 'node:fs/promises';

import { PptxHandler } from 'pptx-viewer-core';

const OUT = process.argv[2] ?? 'sample-deck.pptx';

// Widescreen 16:9 → 1280 x 720 px canvas.
const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Project Atlas — Product Overview',
	creator: 'pptx-viewer',
	width: 12_192_000,
	height: 6_858_000,
});

const INDIGO = '#4f46e5';
const INDIGO_500 = '#6366f1';
const INDIGO_400 = '#818cf8';
const INDIGO_300 = '#a5b4fc';
const AMBER = '#f59e0b';
const SLATE = '#0f172a';
const SLATE_MUTED = '#475569';

// ── Slide 1 — Title ─────────────────────────────────────────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	// Left accent panel.
	s.addShape('rect', {
		x: 0,
		y: 0,
		width: 460,
		height: 720,
		fill: { type: 'solid', color: INDIGO },
	});
	s.addText('Project\nAtlas', {
		x: 56,
		y: 250,
		width: 360,
		height: 180,
		fontSize: 54,
		bold: true,
		color: '#ffffff',
	});
	s.addText('Product Overview', {
		x: 58,
		y: 430,
		width: 360,
		height: 36,
		fontSize: 20,
		color: '#c7d2fe',
	});
	s.addText('Q2 2026', { x: 58, y: 470, width: 360, height: 30, fontSize: 16, color: '#a5b4fc' });

	// Right: a 3×3 grid-of-rounded-squares motif.
	const fills = [
		INDIGO_300,
		INDIGO_400,
		INDIGO_500,
		INDIGO_400,
		INDIGO_500,
		AMBER,
		INDIGO_500,
		INDIGO,
		INDIGO_400,
	];
	const size = 150;
	const gap = 26;
	const startX = 610;
	const startY = 130;
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			s.addShape('roundRect', {
				x: startX + c * (size + gap),
				y: startY + r * (size + gap),
				width: size,
				height: size,
				fill: { type: 'solid', color: fills[r * 3 + c] },
			});
		}
	}
	data.slides.push(s.build());
}

// ── Slide 2 — Agenda ────────────────────────────────────────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	s.addShape('rect', {
		x: 56,
		y: 70,
		width: 64,
		height: 8,
		fill: { type: 'solid', color: INDIGO },
	});
	s.addText('Agenda', {
		x: 56,
		y: 92,
		width: 700,
		height: 60,
		fontSize: 40,
		bold: true,
		color: SLATE,
	});
	const items = [
		'1.  Where we are today',
		'2.  Product highlights',
		'3.  Quarterly growth',
		'4.  Platform architecture',
		'5.  Roadmap & next steps',
	];
	let y = 200;
	for (const item of items) {
		s.addText(item, { x: 64, y, width: 900, height: 44, fontSize: 22, color: SLATE_MUTED });
		y += 70;
	}
	data.slides.push(s.build());
}

// ── Slide 3 — Quarterly growth (shape-drawn bar chart) ──────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	s.addShape('rect', {
		x: 56,
		y: 70,
		width: 64,
		height: 8,
		fill: { type: 'solid', color: INDIGO },
	});
	s.addText('Quarterly Growth', {
		x: 56,
		y: 92,
		width: 900,
		height: 60,
		fontSize: 40,
		bold: true,
		color: SLATE,
	});
	s.addText('Active users (thousands), by quarter', {
		x: 58,
		y: 156,
		width: 900,
		height: 30,
		fontSize: 16,
		color: SLATE_MUTED,
	});
	// Hand-drawn bar chart (shapes serialize reliably; charts need a separate part).
	const values = [42, 58, 71, 96];
	const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
	const colors = [INDIGO_300, INDIGO_400, INDIGO_500, INDIGO];
	const baseline = 620;
	const maxH = 360;
	const max = Math.max(...values);
	const barW = 130;
	const gapB = 70;
	const startBX = (1280 - (values.length * barW + (values.length - 1) * gapB)) / 2;
	// baseline rule
	s.addShape('rect', {
		x: startBX - 20,
		y: baseline,
		width: values.length * (barW + gapB),
		height: 3,
		fill: { type: 'solid', color: '#e2e8f0' },
	});
	values.forEach((v, i) => {
		const h = Math.round((v / max) * maxH);
		const x = startBX + i * (barW + gapB);
		s.addShape('roundRect', {
			x,
			y: baseline - h,
			width: barW,
			height: h,
			fill: { type: 'solid', color: colors[i] },
		});
		s.addText(String(v), {
			x,
			y: baseline - h - 40,
			width: barW,
			height: 30,
			fontSize: 20,
			bold: true,
			color: SLATE,
			alignment: 'center',
		});
		s.addText(labels[i], {
			x,
			y: baseline + 14,
			width: barW,
			height: 28,
			fontSize: 16,
			color: SLATE_MUTED,
			alignment: 'center',
		});
	});
	data.slides.push(s.build());
}

// ── Slide 4 — Architecture (block diagram) ──────────────────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	s.addShape('rect', {
		x: 56,
		y: 70,
		width: 64,
		height: 8,
		fill: { type: 'solid', color: INDIGO },
	});
	s.addText('Platform Architecture', {
		x: 56,
		y: 92,
		width: 1000,
		height: 60,
		fontSize: 40,
		bold: true,
		color: SLATE,
	});
	const blocks = [
		{ label: 'Client Apps', color: INDIGO_400 },
		{ label: 'API Gateway', color: INDIGO_500 },
		{ label: 'Services', color: INDIGO },
		{ label: 'Data Layer', color: SLATE },
	];
	const bw = 250;
	const bh = 150;
	const gap = 40;
	const startX = (1280 - (blocks.length * bw + (blocks.length - 1) * gap)) / 2;
	const y = 320;
	blocks.forEach((b, i) => {
		const x = startX + i * (bw + gap);
		s.addShape('roundRect', {
			x,
			y,
			width: bw,
			height: bh,
			fill: { type: 'solid', color: b.color },
			text: b.label,
			textStyle: {
				color: '#ffffff',
				fontSize: 22,
				bold: true,
				alignment: 'center',
				verticalAlignment: 'middle',
			},
		});
		if (i < blocks.length - 1) {
			s.addShape('rightArrow', {
				x: x + bw + 2,
				y: y + bh / 2 - 16,
				width: gap - 4,
				height: 32,
				fill: { type: 'solid', color: INDIGO_300 },
			});
		}
	});
	data.slides.push(s.build());
}

// ── Slide 5 — Comparison table ──────────────────────────────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	s.addShape('rect', {
		x: 56,
		y: 70,
		width: 64,
		height: 8,
		fill: { type: 'solid', color: INDIGO },
	});
	s.addText('Plans', {
		x: 56,
		y: 92,
		width: 700,
		height: 60,
		fontSize: 40,
		bold: true,
		color: SLATE,
	});
	const head = { color: '#ffffff', bold: true };
	s.addTable(
		{
			rows: [
				{
					cells: [
						{ text: 'Feature', style: head, fill: { type: 'solid', color: INDIGO } },
						{ text: 'Starter', style: head, fill: { type: 'solid', color: INDIGO } },
						{ text: 'Team', style: head, fill: { type: 'solid', color: INDIGO } },
						{ text: 'Enterprise', style: head, fill: { type: 'solid', color: INDIGO } },
					],
				},
				{ cells: [{ text: 'Projects' }, { text: '3' }, { text: '25' }, { text: 'Unlimited' }] },
				{
					cells: [{ text: 'Collaborators' }, { text: '1' }, { text: '10' }, { text: 'Unlimited' }],
				},
				{
					cells: [
						{ text: 'Export formats' },
						{ text: 'PDF' },
						{ text: 'PDF, PNG' },
						{ text: 'All' },
					],
				},
				{
					cells: [
						{ text: 'Support' },
						{ text: 'Community' },
						{ text: 'Email' },
						{ text: '24 / 7' },
					],
				},
			],
			firstRow: true,
			bandRows: true,
		},
		{ x: 80, y: 200, width: 1120, height: 360 },
	);
	data.slides.push(s.build());
}

// ── Slide 6 — Roadmap ───────────────────────────────────────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' });
	s.addShape('rect', {
		x: 56,
		y: 70,
		width: 64,
		height: 8,
		fill: { type: 'solid', color: INDIGO },
	});
	s.addText('Roadmap', {
		x: 56,
		y: 92,
		width: 700,
		height: 60,
		fontSize: 40,
		bold: true,
		color: SLATE,
	});
	const milestones = [
		{ q: 'Now', t: 'Realtime editing', color: INDIGO },
		{ q: 'Next', t: 'Offline mode', color: INDIGO_500 },
		{ q: 'Later', t: 'AI summaries', color: INDIGO_400 },
	];
	const cw = 330;
	const gap = 60;
	const startX = (1280 - (milestones.length * cw + (milestones.length - 1) * gap)) / 2;
	milestones.forEach((m, i) => {
		const x = startX + i * (cw + gap);
		s.addShape('roundRect', {
			x,
			y: 250,
			width: cw,
			height: 240,
			fill: { type: 'solid', color: '#f1f5f9' },
		});
		s.addShape('ellipse', {
			x: x + 24,
			y: 280,
			width: 56,
			height: 56,
			fill: { type: 'solid', color: m.color },
		});
		s.addText(m.q, {
			x: x + 24,
			y: 360,
			width: cw - 48,
			height: 34,
			fontSize: 16,
			bold: true,
			color: m.color,
		});
		s.addText(m.t, {
			x: x + 24,
			y: 396,
			width: cw - 48,
			height: 60,
			fontSize: 24,
			bold: true,
			color: SLATE,
		});
	});
	data.slides.push(s.build());
}

// ── Slide 7 — Closing ───────────────────────────────────────────────────────
{
	const s = createSlide('Blank').setBackground({ type: 'solid', color: INDIGO });
	s.addText('Thank you', {
		x: 140,
		y: 280,
		width: 1000,
		height: 100,
		fontSize: 64,
		bold: true,
		color: '#ffffff',
		alignment: 'center',
	});
	s.addText('atlas.example.com', {
		x: 140,
		y: 400,
		width: 1000,
		height: 40,
		fontSize: 22,
		color: '#c7d2fe',
		alignment: 'center',
	});
	data.slides.push(s.build());
}

const bytes = await handler.save(data.slides);
await writeFile(OUT, bytes);
console.log(
	`[make-sample-deck] wrote ${OUT} (${data.slides.length} slides, ${bytes.length} bytes)`,
);

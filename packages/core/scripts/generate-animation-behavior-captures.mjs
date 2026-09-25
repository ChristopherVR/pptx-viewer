// @ts-nocheck
/**
 * Generate `src/core/services/animation-behavior-captures.json`: PowerPoint's
 * own behaviour tree for every entrance/exit preset id and presetSubtype.
 *
 * Input: two decks written by retail PowerPoint through COM with
 * `scripts/capture-animation-behaviors.ps1` (one slide per accepted
 * (MsoAnimEffect, MsoAnimDirection) pair, entrance and exit), plus the
 * `.log` file the capture script writes next to each deck
 * (`slide mso exit direction durationSeconds`, one line per slide).
 *
 *   bun packages/core/scripts/generate-animation-behavior-captures.mjs \
 *     <var-entr.pptx> <var-exit.pptx>
 *
 * Each captured effect is reduced to its `p:childTnLst` behaviour nodes with
 * every `dur`/`delay` expressed as a FRACTION of the preset's default
 * duration (so the writer can scale the choreography to any requested
 * speed). PowerPoint's 1 ms discrete toggles keep their absolute 1 ms
 * (`absDurMs`), and an exit's closing visibility toggle keeps its "1 ms before
 * the end" placement (`delayFromEndMs`). The trees are complete: the writer
 * emits them as-is, visibility toggles included (Flash Once, for one, has no
 * held visibility set at all). Identical trees are stored once and
 * referenced by subtype.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'core', 'services', 'animation-behavior-captures.json');

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '',
	preserveOrder: true,
	parseAttributeValue: false,
	parseTagValue: false,
	trimValues: true,
});

const TAGS = new Set([
	'set',
	'anim',
	'animEffect',
	'animScale',
	'animRot',
	'animMotion',
	'animClr',
]);

const tagOf = (node) => Object.keys(node).find((k) => k !== ':@');
const kids = (node) => node[tagOf(node)] ?? [];
const attrs = (node) => node[':@'] ?? {};
const child = (node, name) => kids(node).find((c) => tagOf(c) === name);
const children = (node, name) => kids(node).filter((c) => tagOf(c) === name);

function findEffectCTn(node) {
	const tag = tagOf(node);
	if (tag === 'p:cTn' && attrs(node).presetClass) {
		return node;
	}
	for (const c of kids(node)) {
		if (typeof c === 'object' && c !== null && tagOf(c)) {
			const found = findEffectCTn(c);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

function readValue(valNode) {
	if (!valNode) {
		return undefined;
	}
	for (const c of kids(valNode)) {
		const tag = tagOf(c);
		if (tag === 'p:strVal') {
			return { t: 'str', v: attrs(c).val };
		}
		if (tag === 'p:fltVal') {
			return { t: 'flt', v: attrs(c).val };
		}
		if (tag === 'p:intVal') {
			return { t: 'int', v: attrs(c).val };
		}
		if (tag === 'p:boolVal') {
			return { t: 'bool', v: attrs(c).val };
		}
		if (tag === 'p:clrVal') {
			const clr = kids(c)[0];
			const clrTag = tagOf(clr);
			return { t: 'clr', kind: clrTag.replace('a:', ''), v: attrs(clr).val };
		}
	}
	return undefined;
}

const frac = (ms, total) => Math.round((ms / total) * 100000) / 100000;

function readBehavior(node, totalMs) {
	const tag = tagOf(node).replace('p:', '');
	if (!TAGS.has(tag)) {
		throw new Error(`unexpected behaviour <${tag}>`);
	}
	const cBhvr = child(node, 'p:cBhvr');
	const cTn = child(cBhvr, 'p:cTn');
	const ctnAttrs = { ...attrs(cTn) };
	delete ctnAttrs.id;
	const rawDur = Number(ctnAttrs.dur);
	delete ctnAttrs.dur;
	const cond = child(child(cTn, 'p:stCondLst') ?? { x: [] }, 'p:cond');
	const rawDelay = cond ? Number(attrs(cond).delay ?? 0) : 0;
	const names = children(child(cBhvr, 'p:attrNameLst') ?? { x: [] }, 'p:attrName').map((n) => {
		const text = kids(n).find((k) => k['#text'] !== undefined);
		return text ? String(text['#text']) : '';
	});
	const out = { tag };
	if (rawDur === 1) {
		out.absDurMs = 1;
	} else {
		out.dur = frac(rawDur, totalMs);
	}
	if (rawDelay > 0 && rawDelay === totalMs - 1) {
		// The exit's closing visibility toggle: PowerPoint places it 1 ms
		// before the end at every duration.
		out.delayFromEndMs = 1;
	} else if (rawDelay > 0) {
		out.delay = frac(rawDelay, totalMs);
	}
	if (Object.keys(ctnAttrs).length > 0) {
		out.ctn = ctnAttrs;
	}
	const bhvrAttrs = attrs(cBhvr);
	if (Object.keys(bhvrAttrs).length > 0) {
		out.bhvr = bhvrAttrs;
	}
	if (child(cBhvr, 'p:attrNameLst')) {
		out.names = names;
	}
	if (Object.keys(attrs(node)).length > 0) {
		out.attrs = attrs(node);
	}
	if (tag === 'set') {
		out.setTo = readValue(child(node, 'p:to'));
	}
	if (tag === 'animEffect' && child(node, 'p:progress')) {
		out.progress = readValue(child(node, 'p:progress'));
	}
	const tavLst = child(node, 'p:tavLst');
	if (tavLst) {
		out.tav = children(tavLst, 'p:tav').map((tav) => {
			const entry = { tm: attrs(tav).tm };
			if (attrs(tav).fmla !== undefined) {
				entry.fmla = attrs(tav).fmla;
			}
			const val = readValue(child(tav, 'p:val'));
			if (val) {
				entry.val = val;
			}
			return entry;
		});
	}
	for (const key of ['from', 'to', 'by']) {
		const pt = tag === 'animScale' || tag === 'animMotion' ? child(node, `p:${key}`) : undefined;
		if (pt) {
			out.scale ??= {};
			out.scale[key] = [attrs(pt).x, attrs(pt).y];
		}
	}
	return out;
}

async function readDeck(deckPath) {
	const zip = await JSZip.loadAsync(await fs.readFile(deckPath));
	const log = (await fs.readFile(`${deckPath}.log`, 'utf8'))
		.replace(/^﻿/u, '')
		.split(/\r?\n/u)
		.filter((l) => l.trim());
	const records = [];
	for (const line of log) {
		const [slide, , , , durSec] = line.trim().split(/\s+/u);
		const xml = await zip.file(`ppt/slides/slide${slide}.xml`).async('string');
		const effect = findEffectCTn({ root: parser.parse(xml) });
		const a = attrs(effect);
		const totalMs = Math.max(1, Math.round(Number(durSec) * 1000));
		const nodes = kids(child(effect, 'p:childTnLst')).map((n) => readBehavior(n, totalMs));
		const iterate = child(effect, 'p:iterate');
		records.push({
			cls: a.presetClass,
			id: Number(a.presetID),
			sub: Number(a.presetSubtype ?? 0),
			durMs: totalMs,
			effect: Object.fromEntries(Object.entries(a).filter(([k]) => k === 'accel' || k === 'decel')),
			iterate: iterate
				? {
						type: attrs(iterate).type ?? 'el',
						...(child(iterate, 'p:tmPct')
							? { tmPct: Number(attrs(child(iterate, 'p:tmPct')).val) }
							: {}),
					}
				: undefined,
			nodes,
		});
	}
	return records;
}

async function main() {
	const [entrDeck, exitDeck] = process.argv.slice(2);
	if (!entrDeck || !exitDeck) {
		throw new Error(
			'usage: generate-animation-behavior-captures.mjs <var-entr.pptx> <var-exit.pptx>',
		);
	}
	const table = { entr: {}, exit: {} };
	for (const deck of [entrDeck, exitDeck]) {
		for (const rec of await readDeck(deck)) {
			if (rec.cls !== 'entr' && rec.cls !== 'exit') {
				continue;
			}
			let entry = table[rec.cls][rec.id];
			if (!entry) {
				entry = { durMs: rec.durMs, defaultSubtype: rec.sub, trees: [], subtypes: {} };
				if (Object.keys(rec.effect).length > 0) {
					entry.effect = rec.effect;
				}
				if (rec.iterate) {
					entry.iterate = rec.iterate;
				}
				table[rec.cls][rec.id] = entry;
			}
			if (entry.subtypes[rec.sub] !== undefined) {
				continue;
			}
			const key = JSON.stringify(rec.nodes);
			let index = entry.trees.findIndex((t) => JSON.stringify(t) === key);
			if (index < 0) {
				entry.trees.push(rec.nodes);
				index = entry.trees.length - 1;
			}
			entry.subtypes[rec.sub] = index;
		}
	}
	await fs.writeFile(OUT, `${JSON.stringify(table, null, '\t')}\n`);
	console.log(`wrote ${OUT}`);
}

await main();

/**
 * Rewrite `engine-first-allowlist.ts`'s id list from a fresh
 * `measure-smartart-engine-vs-legacy.ts` run, keeping the file's doc comment:
 * `bun scripts/measure-smartart-engine-vs-legacy.ts > out.txt && bun scripts/update-smartart-allowlist.ts out.txt`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(
	HERE,
	'../packages/core/src/core/utils/smartart-engine/engine-first-allowlist.ts',
);

const measured = readFileSync(process.argv[2], 'utf-8');
const rows: string[] = [];
for (const line of measured.split(/\r?\n/)) {
	// The measure script pads the name; an id may contain spaces, a name never contains " urn:".
	const match = /^(.+?) (urn:.+?)\s+datasets=\d+ legacy<=(\S+) engine<=(\S+) ENGINE-FIRST/.exec(
		line,
	);
	if (match) {
		const [, name, id, legacy, engine] = match;
		rows.push(`\t'${id}', // ${name.trim()} (legacy<=${legacy} -> engine<=${engine})`);
	}
}
const source = readFileSync(TARGET, 'utf-8');
const start = source.indexOf('new Set([');
const end = source.indexOf(']);', start);
writeFileSync(
	TARGET,
	`${source.slice(0, start)}new Set([\n${rows.join('\n')}\n${source.slice(end)}`,
);
console.log(`${rows.length} layouts written.`);

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const schemaDir = process.argv[2];
const output = process.argv[3] ?? 'src/core/openxml/schema-constructs.generated.ts';
if (!schemaDir) {
	throw new Error('Usage: bun generate-openxml-schema-constructs.mjs <schema-dir> [output]');
}

const schemas = [
	['presentation', 'pml.xsd'],
	['drawing', 'dml-main.xsd'],
	['chart', 'dml-chart.xsd'],
	['diagram', 'dml-diagram.xsd'],
];

const constructs = new Set();
for (const [vocabulary, file] of schemas) {
	const source = readFileSync(join(schemaDir, file), 'utf8');
	for (const kind of ['element', 'complexType']) {
		const pattern = new RegExp(`<xsd:${kind}\\s+name="([^"]+)"`, 'gu');
		for (const match of source.matchAll(pattern)) {
			constructs.add(`${vocabulary}:${kind}:${match[1]}`);
		}
	}
}
const sortedConstructs = [...constructs].sort();

const lines = [
	'/** Generated from the ECMA-376 5th edition Strict XSD set. */',
	'export const OPENXML_SCHEMA_CONSTRUCT_IDS = [',
	...sortedConstructs.map((id) => `\t${JSON.stringify(id)},`),
	'] as const;',
	'',
];
writeFileSync(resolve(output), lines.join('\n'));
console.log(`Wrote ${sortedConstructs.length} constructs to ${resolve(output)}`);

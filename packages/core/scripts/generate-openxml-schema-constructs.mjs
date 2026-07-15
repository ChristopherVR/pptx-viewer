import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [strictDir, transitionalDir, outputDir = 'src/core/openxml'] = process.argv.slice(2);
if (!strictDir || !transitionalDir) {
	throw new Error(
		'Usage: bun generate-openxml-schema-constructs.mjs <strict-dir> <transitional-dir> [output-dir]',
	);
}
const schemas = [
	['presentation', 'pml.xsd'],
	['drawing', 'dml-main.xsd'],
	['chart', 'dml-chart.xsd'],
	['diagram', 'dml-diagram.xsd'],
];
const kinds = ['element', 'complexType', 'simpleType', 'attribute', 'group', 'attributeGroup'];

function readConstructs(schemaDir) {
	const constructs = new Set();
	for (const [vocabulary, file] of schemas) {
		const source = readFileSync(join(schemaDir, file), 'utf8');
		for (const kind of kinds) {
			const pattern = new RegExp(`<xsd:${kind}\\s+name="([^"]+)"`, 'gu');
			for (const match of source.matchAll(pattern)) {
				constructs.add(`${vocabulary}:${kind}:${match[1]}`);
			}
		}
	}
	return [...constructs].sort();
}

function generatedSource(constantName, edition, constructs) {
	const rows = Array.from(
		{ length: Math.ceil(constructs.length / 8) },
		(_, index) =>
			`\t${constructs
				.slice(index * 8, index * 8 + 8)
				.map((id) => JSON.stringify(id))
				.join(', ')},`,
	);
	return [
		`/** Generated from the ECMA-376 5th edition ${edition} XSD set. */`,
		'// oxfmt-ignore',
		`export const ${constantName} = [`,
		...rows,
		'] as const;',
		'',
	].join('\n');
}

const strict = readConstructs(strictDir);
const transitional = readConstructs(transitionalDir);
const destination = resolve(outputDir);
mkdirSync(destination, { recursive: true });
writeFileSync(
	join(destination, 'schema-constructs-strict.generated.ts'),
	generatedSource('OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS', 'Strict', strict),
);
writeFileSync(
	join(destination, 'schema-constructs-transitional.generated.ts'),
	generatedSource('OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS', 'Transitional', transitional),
);
writeFileSync(
	join(destination, 'schema-constructs.generated.ts'),
	`import { OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS } from './schema-constructs-strict.generated';
import { OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS } from './schema-constructs-transitional.generated';

export { OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS, OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS };
export const OPENXML_SCHEMA_CONSTRUCT_IDS = [
\t...new Set([...OPENXML_STRICT_SCHEMA_CONSTRUCT_IDS, ...OPENXML_TRANSITIONAL_SCHEMA_CONSTRUCT_IDS]),
] as const;
`,
);
console.log(`Wrote ${strict.length} Strict and ${transitional.length} Transitional constructs.`);

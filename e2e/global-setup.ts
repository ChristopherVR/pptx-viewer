import { assertDistFreshness } from './dist-freshness';
import { generateChartFixture } from './fixtures/generate-chart-fixture';
import { generateFieldSubstitutionFixture } from './fixtures/generate-field-substitution-fixture';
import { generateFixture } from './fixtures/generate-format-painter-fixture';
import { generateLineFillFidelityFixture } from './fixtures/generate-line-fill-fidelity-fixture';
import { generateLinkedTextBoxFixture } from './fixtures/generate-linked-textbox-fixture';
import { generateMasterViewsFixture } from './fixtures/generate-master-views-fixture';
import { generateMorphShapeSwapFixture } from './fixtures/generate-morph-shape-swap-fixture';
import { generateInkFixture, generateOleFixture } from './fixtures/generate-ole-ink-fixtures';
import { generateParityWave4Fixture } from './fixtures/generate-parity-wave4-fixture';
import { generateFixture as generateTemplateEditingFixture } from './fixtures/generate-template-editing-fixture';
import {
	generateTemplateGroupFixture,
	generateTemplateMceFixture,
} from './fixtures/generate-template-group-fixture';
import { generateTextBodyFixture } from './fixtures/generate-text-body-fixture';
import { generateTextLayoutFixture } from './fixtures/generate-text-layout-fixture';
import { generateFixture as generateTransitionsAnimationsFixture } from './fixtures/generate-transitions-animations-fixture';

export default async function globalSetup() {
	// Before anything else: a stale dist means the run tests code that is not on
	// disk, and can report a spurious PASS. Fail with the build command instead.
	await assertDistFreshness();
	await generateFixture();
	await generateChartFixture();
	await generateFieldSubstitutionFixture();
	await generateTransitionsAnimationsFixture();
	await generateTemplateEditingFixture();
	await generateTemplateGroupFixture();
	await generateTemplateMceFixture();
	await generateMasterViewsFixture();
	await generateOleFixture();
	await generateInkFixture();
	await generateTextLayoutFixture();
	await generateTextBodyFixture();
	await generateLinkedTextBoxFixture();
	await generateMorphShapeSwapFixture();
	await generateLineFillFidelityFixture();
	await generateParityWave4Fixture();
}

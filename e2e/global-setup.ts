import { generateChartFixture } from './fixtures/generate-chart-fixture';
import { generateFixture } from './fixtures/generate-format-painter-fixture';
import { generateMasterViewsFixture } from './fixtures/generate-master-views-fixture';
import { generateInkFixture, generateOleFixture } from './fixtures/generate-ole-ink-fixtures';
import { generateFixture as generateTemplateEditingFixture } from './fixtures/generate-template-editing-fixture';
import { generateFixture as generateTransitionsAnimationsFixture } from './fixtures/generate-transitions-animations-fixture';

export default async function globalSetup() {
	await generateFixture();
	await generateChartFixture();
	await generateTransitionsAnimationsFixture();
	await generateTemplateEditingFixture();
	await generateMasterViewsFixture();
	await generateOleFixture();
	await generateInkFixture();
}

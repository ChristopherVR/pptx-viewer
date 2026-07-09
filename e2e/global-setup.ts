import { generateChartFixture } from './fixtures/generate-chart-fixture';
import { generateFixture } from './fixtures/generate-format-painter-fixture';
import { generateFixture as generateTemplateEditingFixture } from './fixtures/generate-template-editing-fixture';

export default async function globalSetup() {
	await generateFixture();
	await generateChartFixture();
	await generateTemplateEditingFixture();
}

import { generateChartFixture } from './fixtures/generate-chart-fixture';
import { generateFixture } from './fixtures/generate-format-painter-fixture';
import { generateInkFixture, generateOleFixture } from './fixtures/generate-ole-ink-fixtures';

export default async function globalSetup() {
	await generateFixture();
	await generateChartFixture();
	await generateOleFixture();
	await generateInkFixture();
}

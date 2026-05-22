import { generateFixture } from './fixtures/generate-format-painter-fixture';

export default async function globalSetup() {
	await generateFixture();
}

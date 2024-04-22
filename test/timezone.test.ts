import { describe, expect, test } from '@jest/globals';

// Verifies that tests are running in the UTC timezone, so that datetime string formatting is consistent
describe('Timezone', () => {
	test('Should be UTC', () => {
		expect(process.env.TZ).toBe('UTC');
	});
});

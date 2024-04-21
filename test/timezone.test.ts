import { describe, expect, it } from '@jest/globals';

// Verifies that tests are running in the UTC timezone, so that datetime string formatting is consistent
describe('Timezone', () => {
	it('Should be UTC', () => {
		expect(process.env.TZ).toBe('UTC');
	});
});

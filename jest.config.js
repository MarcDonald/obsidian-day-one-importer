/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleDirectories: ['node_modules', 'test'],
	moduleNameMapper: {
		obsidian: '__mocks__/obsidian.mocks.ts',
	},
	testMatch: ['**/*.test.ts'],
};

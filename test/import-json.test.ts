import { importJson } from '../src/import-json';
import { DEFAULT_SETTINGS } from '../src/main';
import { TFile, Vault } from 'obsidian';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals';

describe('importJson', () => {
	let vault: jest.Mocked<Vault>;

	beforeEach(() => {
		vault = {
			getFileByPath: jest.fn(),
			read: jest.fn(),
			create: jest.fn(),
		} as unknown as jest.Mocked<Vault>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should error if no input file', () => {
		vault.getFileByPath.mockReturnValue(null);

		expect(() =>
			importJson(vault, {
				...DEFAULT_SETTINGS,
				inDirectory: 'testDir',
				inFileName: 'testInput.json',
			})
		).rejects.toThrowError('No file found');
		expect(vault.getFileByPath).toBeCalledWith('testDir/testInput.json');
	});

	it('should error if file name has already been used', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						uuid: 'abc123',
					},
					{
						uuid: 'abc123',
					},
				],
			})
		);

		const res = await importJson(vault, DEFAULT_SETTINGS);
		expect(res.failures).toHaveLength(1);
		expect(res.failures[0].entry.uuid).toBe('abc123');
		expect(res.failures[0].reason).toBe(
			'A file named abc123.md already exists'
		);
	});

	it('should use provided date format to name files when date-based naming is enabled', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						creationDate: '2024-04-19T21:55:53Z',
					},
					{
						creationDate: '2023-03-11T11:15:33Z',
						isAllDay: true,
					},
				],
			})
		);

		await importJson(vault, {
			...DEFAULT_SETTINGS,
			dateBasedFileNames: true,
			dateBasedFileNameFormat: 'YYYYMMDDHHmmssS',
			dateBasedAllDayFileNameFormat: 'SssmmHHDDMMYYYY',
		});

		expect(vault.create.mock.calls[0][0]).toBe(
			'day-one-out/202404192155530.md'
		);
		expect(vault.create.mock.calls[1][0]).toBe(
			'day-one-out/033151111032023.md'
		);
	});

	it('should use UUID as file name when date-based naming is not enabled', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						creationDate: '2024-04-19T21:55:53Z',
						uuid: 'abc123',
					},
					{
						creationDate: '2023-03-11T11:15:33Z',
						isAllDay: true,
						uuid: 'def456',
					},
				],
			})
		);

		await importJson(vault, {
			...DEFAULT_SETTINGS,
			dateBasedFileNames: false,
		});

		expect(vault.create.mock.calls[0][0]).toBe('day-one-out/abc123.md');
		expect(vault.create.mock.calls[1][0]).toBe('day-one-out/def456.md');
	});

	// TODO frontmatter tests
});

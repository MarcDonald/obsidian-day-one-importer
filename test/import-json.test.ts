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
						text: 'abc',
					},
					{
						uuid: 'abc123',
						text: 'abc',
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
						text: 'abc',
					},
					{
						creationDate: '2023-03-11T11:15:33Z',
						text: 'abc',
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
						text: 'abc',
					},
					{
						creationDate: '2023-03-11T11:15:33Z',
						isAllDay: true,
						uuid: 'def456',
						text: 'abc',
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

	it('should not replace images or videos that are not found', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						creationDevice: 'marcBook Pro',
						isPinned: false,
						editingTime: 10.006034016609192,
						creationDeviceModel: 'MacBookPro18,3',
						duration: 0,
						text: '![](dayone-moment:/video/6F9B2DC7EADE4242A80DC76470D2264E)\n![](dayone-moment://24BD79E9E42F4A4CA0C9F384F547B5BC)',
						creationOSVersion: '14.3.1',
						uuid: '959E7A13B3B649D681DC573DB7E07967',
						timeZone: 'Europe/London',
						modifiedDate: '2024-04-21T22:46:02Z',
						creationDeviceType: 'MacBook Pro',
						creationOSName: 'macOS',
						isAllDay: false,
						richText:
							'{"contents":[{"embeddedObjects":[{"identifier":"E5B4E8C8B7EB4291AFDFFACB966A0382","type":"video"}]}],"meta":{"created":{"platform":"com.bloombuilt.dayone-mac","version":1552},"small-lines-removed":true,"version":1}}',
						creationDate: '2024-04-21T22:45:51Z',
						starred: false,
					},
				],
			})
		);

		await importJson(vault, DEFAULT_SETTINGS);

		expect(vault.create.mock.calls[0][1]).toBe(
			'---\n' +
				'creationDate: 2024-04-21T22:45\n' +
				'modifiedDate: 2024-04-21T22:46\n' +
				'---\n' +
				'![](dayone-moment:/video/6F9B2DC7EADE4242A80DC76470D2264E)\n' +
				'![](dayone-moment://24BD79E9E42F4A4CA0C9F384F547B5BC)'
		);
		expect(vault.create.mock.calls[0][2]).toEqual({
			ctime: 1713739551000,
			mtime: 1713739562000,
		});
	});
});

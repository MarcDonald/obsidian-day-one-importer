/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEFAULT_SETTINGS } from '../src/main';
import { Events, FileManager, TFile, Vault } from 'obsidian';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from '@jest/globals';
import { updateFrontMatter } from '../src/update-front-matter';
import * as testData from './__test_data__/day-one-in/Dev Journal.json';

const mockEntry = {
	creationDevice: 'marcBook Pro',
	isPinned: false,
	editingTime: 10.006034016609192,
	creationDeviceModel: 'MacBookPro18,3',
	duration: 0,
	text: 'testing 123',
	creationOSVersion: '14.3.1',
	uuid: '959E7A13B3B649D681DC573DB7E07967',
	timeZone: 'Europe/London',
	modifiedDate: '2024-04-21T22:46:02Z',
	creationDeviceType: 'MacBook Pro',
	creationOSName: 'macOS',
	isAllDay: false,
	richText:
		'{"contents":[{"text":"testing 123"}],"meta":{"created":{"platform":"com.bloombuilt.dayone-mac","version":1552},"small-lines-removed":true,"version":1}}',
	creationDate: '2024-04-21T22:45:51Z',
	starred: false,
};

describe('updateFrontMatter', () => {
	let vault: jest.Mocked<Vault>;
	let fileManager: jest.Mocked<FileManager>;
	let importEvents: jest.Mocked<Events>;
	let frontmatterObjs: any[] = [];

	beforeEach(() => {
		vault = {
			getFileByPath: jest.fn(),
			read: jest.fn(),
			create: jest.fn(),
		} as unknown as jest.Mocked<Vault>;
		fileManager = {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			processFrontMatter: (file: any, cb: any) => {
				const frontMatter = {};
				cb(frontMatter);
				frontmatterObjs.push(frontMatter);
			},
		} as unknown as jest.Mocked<FileManager>;
		importEvents = {
			trigger: jest.fn(),
		} as unknown as jest.Mocked<Events>;
	});

	afterEach(() => {
		jest.clearAllMocks();
		frontmatterObjs = [];
	});

	test('should error if no input file', () => {
		vault.getFileByPath.mockReturnValue(null);

		expect(() =>
			updateFrontMatter(
				vault,
				{
					...DEFAULT_SETTINGS,
					inDirectory: 'testDir',
					inFileName: 'testInput.json',
				},
				fileManager,
				importEvents
			)
		).rejects.toThrowError('No file found');
		expect(vault.getFileByPath).toBeCalledWith('testDir/testInput.json');
	});

	test('should error if file name has already been updated in this import', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						uuid: 'abc123',
					},
					{
						...mockEntry,
						uuid: 'abc123',
					},
				],
			})
		);

		const res = await updateFrontMatter(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents
		);
		expect(res.failures).toHaveLength(1);
		expect(res.failures[0].entry.uuid).toBe('abc123');
		expect(res.failures[0].reason).toBe(
			'A file named abc123.md has already been updated in this import'
		);
	});

	test('should error if file cannot be found', async () => {
		vault.getFileByPath.mockReturnValueOnce(jest.fn() as unknown as TFile);
		vault.getFileByPath.mockReturnValue(null);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						uuid: 'abc123',
					},
				],
			})
		);

		const res = await updateFrontMatter(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents
		);
		expect(res.failures).toHaveLength(1);
		expect(res.failures[0].entry.uuid).toBe('abc123');
		expect(res.failures[0].reason).toBe('Could not find file abc123.md');
	});

	test('should use provided date format to name files when date-based naming is enabled', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						creationDate: '2024-04-19T21:55:53Z',
					},
					{
						...mockEntry,
						creationDate: '2023-03-11T11:15:33Z',
						isAllDay: true,
					},
				],
			})
		);

		await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				dateBasedFileNames: true,
				dateBasedFileNameFormat: 'YYYYMMDDHHmmssS',
				dateBasedAllDayFileNameFormat: 'SssmmHHDDMMYYYY',
			},
			fileManager,
			importEvents
		);

		expect(vault.getFileByPath.mock.calls[1][0]).toBe(
			'day-one-out/202404192155530.md'
		);
		expect(vault.getFileByPath.mock.calls[2][0]).toBe(
			'day-one-out/033151111032023.md'
		);
	});

	test('should use UUID as file name when date-based naming is not enabled', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						creationDate: '2024-04-19T21:55:53Z',
						uuid: 'abc123',
					},
					{
						...mockEntry,
						creationDate: '2023-03-11T11:15:33Z',
						isAllDay: true,
						uuid: 'def456',
					},
				],
			})
		);

		await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				dateBasedFileNames: false,
			},
			fileManager,
			importEvents
		);

		expect(vault.getFileByPath.mock.calls[0][0]).toBe(
			'day-one-in/journal.json'
		);
		expect(vault.getFileByPath.mock.calls[1][0]).toBe('day-one-out/abc123.md');
		expect(vault.getFileByPath.mock.calls[2][0]).toBe('day-one-out/def456.md');
	});

	test('successful update', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testData));

		await updateFrontMatter(vault, DEFAULT_SETTINGS, fileManager, importEvents);

		expect(frontmatterObjs[0]).toEqual({
			activity: 'Train',
			creationDate: '2024-04-16T23:00',
			uuid: 'DF8B32A3FE25400BBBB3A7BBFCD23CE7',
			isAllDay: true,
			location: 'Eurpocar Dublin Airport Terminal 2, Swords, Ireland',
			coordinates: `53.4276123046875, -6.239171028137207`,
			modifiedDate: '2024-04-19T21:55',
			starred: true,
			tags: ['another-dev-testing-tag', 'dev-testing-tag'],
		});
	});

	test('should use separate coordinate fields if enabled', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testData));

		await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				separateCoordinateFields: true,
			},
			fileManager,
			importEvents
		);

		expect(frontmatterObjs[0]).toEqual({
			activity: 'Train',
			creationDate: '2024-04-16T23:00',
			uuid: 'DF8B32A3FE25400BBBB3A7BBFCD23CE7',
			isAllDay: true,
			location: 'Eurpocar Dublin Airport Terminal 2, Swords, Ireland',
			latitude: 53.4276123046875,
			longitude: -6.239171028137207,
			modifiedDate: '2024-04-19T21:55',
			starred: true,
			tags: ['another-dev-testing-tag', 'dev-testing-tag'],
		});
	});
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { importJson } from '../src/import-json';
import { DEFAULT_SETTINGS } from '../src/main';
import { Events, FileManager, TFile, TFolder, Vault } from 'obsidian';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from '@jest/globals';
import * as testData from './__test_data__/day-one-in/Dev Journal.json';
import * as testDataWithInvalidEntry from './__test_data__/day-one-in/Dev Journal One Invalid.json';
import { ZodError } from 'zod';
import { UuidMapStore } from '../src/uuid-map';

jest.mock('obsidian', () => {
	const actual = jest.requireActual('obsidian');
	return Object.assign({}, actual, {
		Notice: jest.fn(),
	});
});

const fakeJsonFile = {
	name: 'fakeFile.json',
	extension: 'json',
	basename: 'fakeFile',
	stat: {},
} as unknown as TFile;

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

describe('importJson', () => {
	let vault: jest.Mocked<Vault>;
	let fileManager: jest.Mocked<FileManager>;
	let importEvents: jest.Mocked<Events>;
	let frontmatterObjs: any[] = [];
	let mockUuidMapStore: jest.Mocked<UuidMapStore>;

	beforeEach(() => {
		vault = {
			getAbstractFileByPath: jest.fn(),
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
		mockUuidMapStore = {
			read: jest
				.fn<() => Promise<Record<string, string>>>()
				.mockResolvedValue({}),
			write: jest
				.fn<(map: Record<string, string>) => Promise<void>>()
				.mockResolvedValue(undefined),
		} as jest.Mocked<UuidMapStore>;
	});

	afterEach(() => {
		jest.clearAllMocks();
		frontmatterObjs = [];
	});

	test('should error if input directory is not found', () => {
		vault.getAbstractFileByPath.mockReturnValue(null); // Simulate missing folder
		expect(() =>
			importJson(
				vault,
				{
					...DEFAULT_SETTINGS,
					inDirectory: 'testDir',
					inFileName: 'testInput.json',
				},
				fileManager,
				importEvents,
				mockUuidMapStore
			)
		).rejects.toThrowError('Input directory does not exist.');
	});

	test('should error if no input file', () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'testDir') return { children: [] } as unknown as TFolder;
			return null;
		});
		vault.getFileByPath.mockReturnValue(null);

		expect(() =>
			importJson(
				vault,
				{
					...DEFAULT_SETTINGS,
					inDirectory: 'testDir',
					inFileName: 'testInput.json',
				},
				fileManager,
				importEvents,
				mockUuidMapStore
			)
		).rejects.toThrowError(
			'File testInput.json does not exist in the input directory.'
		);

		// Behavioral check
		expect(vault.getAbstractFileByPath).toBeCalledWith(
			'testDir/testInput.json'
		);
	});

	test('should error if file name has already been used in this import', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'testDir') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'testDir/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});
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

		const res = await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'testDir',
				inFileName: 'fakeFile.json',
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);
		expect(res.failures).toHaveLength(1);
		expect(res.failures[0].entry.uuid).toBe('abc123');
		expect(res.failures[0].reason).toBe(
			'A file named abc123.md has already been created in this import'
		);
	});

	test('should ignore if file already exists and settings.ignoreExistingFiles is true', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
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
		vault.create.mockRejectedValue(new Error('File already exists.'));

		const res = await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				ignoreExistingFiles: true,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);
		expect(res.successCount).toBe(0);
		expect(res.failures).toHaveLength(0);
		expect(res.ignoreCount).toBe(1);
	});

	test('should error if file already exists and settings.ignoreExistingFiles is false', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
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
		vault.create.mockRejectedValue(new Error('File already exists.'));

		const res = await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				ignoreExistingFiles: false,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);
		expect(res.successCount).toBe(0);
		expect(res.failures).toHaveLength(1);
		expect(res.ignoreCount).toBe(0);
	});

	test('should use provided date format to name files when date-based naming is enabled', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
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
						uuid: '959E7A13B3B649D681DC573DB7E07968',
						isAllDay: true,
					},
				],
			})
		);

		await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				dateBasedFileNames: true,
				dateBasedFileNameFormat: 'YYYYMMDDHHmmssS',
				dateBasedAllDayFileNameFormat: 'SssmmHHDDMMYYYY',
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		expect(vault.create.mock.calls.length).toBe(2);
		expect(vault.create.mock.calls[0][0]).toBe(
			'day-one-out/202404192155530.md'
		);
		expect(vault.create.mock.calls[1][0]).toBe(
			'day-one-out/033151111032023.md'
		);
	});

	test('should gracefully handle empty userActivity object', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						userActivity: {},
					},
				],
			})
		);

		await importJson(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Testing that it does not fail schema validation
		expect(vault.create.mock.calls[0][1]).toBe('testing 123');
	});

	test('should use UUID as file name when date-based naming is not enabled', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
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

		await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				dateBasedFileNames: false,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		expect(vault.create.mock.calls[0][0]).toBe('day-one-out/abc123.md');
		expect(vault.create.mock.calls[1][0]).toBe('day-one-out/def456.md');
	});

	test('should replace images or videos or audios', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						videos: [
							{
								favorite: false,
								fileSize: 2845124,
								orderInEntry: 0,
								width: 1920,
								type: 'mp4',
								identifier: '6F9B2DC7EADE4242A80DC76470D2264E',
								date: '2024-04-21T22:59:54Z',
								height: 1080,
								creationDevice: 'marcBook Pro',
								duration: 5.710108843537415,
								md5: 'd500d6789ff2c211af3f507b17be8e66',
							},
						],
						audios: [
							{
								fileSize: 47063,
								location: {
									region: {
										center: {
											longitude: -81.24,
											latitude: 42.98,
										},
										radius: 75,
									},
									localityName: 'London',
									country: 'Canada',
									timeZoneName: 'America/Toronto',
									administrativeArea: 'ON',
									longitude: -81.24,
									placeName: 'London',
									latitude: 42.987583160400391,
								},
								orderInEntry: 1,
								recordingDevice: 'AirPods Pro',
								creationDevice: 'marcPhone 16 Pro Max',
								audioChannels: 'Mono',
								duration: 5.5019999999999998,
								favorite: false,
								identifier: '08514236013D4E4A9389BFDC24A5F727',
								format: 'aac',
								date: '2025-04-06T16:10:17Z',
								height: 0,
								width: 0,
								md5: 'f35f41739499e70c6b2714e3a7d82d8c',
								sampleRate: '32.0 kHz',
								timeZoneName: 'Europe/London',
							},
						],
						photos: [
							{
								fileSize: 1472349,
								orderInEntry: 1,
								creationDevice: 'marcBook Pro',
								duration: 0,
								favorite: false,
								type: 'jpeg',
								identifier: '031C8B7DAE0349BAA27892008778F6F6',
								date: '2024-03-24T18:30:30Z',
								exposureBiasValue: 0,
								height: 1559,
								width: 1179,
								md5: '6b73e9bd86a91d3a7ead09268b0fb266',
								isSketch: false,
							},
							{
								fileSize: 1287214,
								orderInEntry: 0,
								creationDevice: 'marcBook Pro',
								duration: 0,
								favorite: false,
								type: 'jpeg',
								identifier: '24BD79E9E42F4A4CA0C9F384F547B5BC',
								date: '2024-03-24T18:28:37Z',
								exposureBiasValue: 0,
								height: 2064,
								width: 1179,
								md5: '31c871f18f68d2fde4196ccba1f8ece1',
								isSketch: false,
							},
						],
						text:
							'![](dayone-moment:/video/6F9B2DC7EADE4242A80DC76470D2264E)\n' +
							'![](dayone-moment:/audio/08514236013D4E4A9389BFDC24A5F727)\n' +
							'![](dayone-moment://24BD79E9E42F4A4CA0C9F384F547B5BC)',
					},
				],
			})
		);

		await importJson(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		expect(vault.create.mock.calls[0][1]).toBe(
			'![](d500d6789ff2c211af3f507b17be8e66.mp4)\n' +
				'![](f35f41739499e70c6b2714e3a7d82d8c.m4a)\n' +
				'![](31c871f18f68d2fde4196ccba1f8ece1.jpeg)'
		);
		expect(vault.create.mock.calls[0][2]).toEqual({
			ctime: 1713739551000,
			mtime: 1713739562000,
		});
	});

	test('should not replace images or videos that are not found', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						text:
							'![](dayone-moment:/video/6F9B2DC7EADE4242A80DC76470D2264E)\n' +
							'![](dayone-moment://24BD79E9E42F4A4CA0C9F384F547B5BC)',
					},
				],
			})
		);

		await importJson(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		expect(vault.create.mock.calls[0][1]).toBe(
			'![](dayone-moment:/video/6F9B2DC7EADE4242A80DC76470D2264E)\n' +
				'![](dayone-moment://24BD79E9E42F4A4CA0C9F384F547B5BC)'
		);
		expect(vault.create.mock.calls[0][2]).toEqual({
			ctime: 1713739551000,
			mtime: 1713739562000,
		});
	});

	test('full import', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testData));

		const result = await importJson(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Returned object
		expect(result).toEqual({
			total: 5,
			successCount: 5,
			ignoreCount: 0,
			failures: [],
			invalidEntries: [],
		});

		// entry 1 - Markdown
		expect(vault.create.mock.calls[0][0]).toBe(
			'day-one-out/DF8B32A3FE25400BBBB3A7BBFCD23CE7.md'
		);
		expect(vault.create.mock.calls[0][1]).toBe(
			'# Header 1\n\n' +
				'## Header 2\n\n' +
				'### Header 3\n\n' +
				'#### Header 4\n\n' +
				'##### Header 5\n\n' +
				'###### Header 6\n\n' +
				'> Quote block\n\n' +
				'Highlighted\n\n' +
				'---\n\n' +
				'**Bold**\n\n' +
				'*Italic*\n\n' +
				'- List item 1\n' +
				'- List item 2\n\n' +
				'- [ ] Check item 1\n' +
				'- [ ] Check item 2\n\n' +
				'1. List number 1\n' +
				'2. List number 2\n\n' +
				'`Code span` \n\n' +
				'```\nCode block\n```\n\n\n' +
				'![](31c871f18f68d2fde4196ccba1f8ece1.jpeg)'
		);
		expect(vault.create.mock.calls[0][2]).toEqual({
			ctime: 1713308400000,
			mtime: 1713563751000,
		});
		expect(frontmatterObjs[0]).toEqual({
			activity: 'Train',
			creationDate: '2024-04-16T23:00',
			uuid: 'DF8B32A3FE25400BBBB3A7BBFCD23CE7',
			isAllDay: true,
			location: 'Eurpocar Dublin Airport Terminal 2, Swords, Ireland',
			coordinates: `53.42761,-6.23917`,
			modifiedDate: '2024-04-19T21:55',
			starred: true,
			tags: ['another-dev-testing-tag', 'dev-testing-tag'],
		});

		// entry 2 - Multiple paragraphs
		expect(vault.create.mock.calls[1][0]).toBe(
			'day-one-out/1461153D91EC48C180C606C853FBFD83.md'
		);
		expect(vault.create.mock.calls[1][1]).toBe(
			'Pariatur aute nulla incididunt. Ad dolor irure est in magna est. Ut ex Lorem reprehenderit incididunt enim eiusmod et. Aute sit duis labore quis tempor laborum eiusmod ut ad labore ad.\n\n' +
				'Dolore fugiat qui duis do cupidatat. Amet ut ad aute elit dolor. Lorem nisi adipisicing elit consectetur officia reprehenderit sunt cupidatat reprehenderit in anim est est occaecat duis. Ut veniam ad id aliqua ex excepteur consequat tempor ut eu ex deserunt duis. Consequat labore minim ea veniam Lorem laboris esse minim velit do nostrud nisi ullamco. Dolore adipisicing do ea.'
		);
		expect(vault.create.mock.calls[1][2]).toEqual({
			ctime: 1713394800000,
			mtime: 1713563393000,
		});
		expect(frontmatterObjs[1]).toEqual({
			creationDate: '2024-04-17T23:00',
			isAllDay: true,
			modifiedDate: '2024-04-19T21:49',
			uuid: '1461153D91EC48C180C606C853FBFD83',
		});

		// entry 3 - Hyphens and parentheses
		expect(vault.create.mock.calls[2][0]).toBe(
			'day-one-out/876E72B228F847379F296B1698CA3F61.md'
		);
		expect(vault.create.mock.calls[2][1]).toBe(
			'"This text is in quotes"\n' +
				'This-text-is-hyphenated\n' +
				'(This text is in parentheses)\n\n' +
				'Dolore ex commodo aliqua irure ullamco quis aliquip. Consectetur et magna ullamco amet nisi. Ut commodo officia laborum aliquip Lorem adipisicing ipsum do amet consequat. Fugiat officia dolore aute do quis sunt exercitation. Pariatur sint exercitation ut eiusmod velit sint exercitation ullamco minim commodo qui tempor adipisicing esse amet. Lorem ad sit ullamco dolore labore commodo ea ad officia quis deserunt. Adipisicing duis qui elit ipsum aliqua ipsum ea.'
		);
		expect(vault.create.mock.calls[2][2]).toEqual({
			ctime: 1713563316000,
			mtime: 1713563332000,
		});
		expect(frontmatterObjs[2]).toEqual({
			creationDate: '2024-04-19T21:48',
			location: 'Dundas Castle, Edinburgh, United Kingdom',
			coordinates: `55.97502,-3.41434`,
			modifiedDate: '2024-04-19T21:48',
			pinned: true,
			uuid: '876E72B228F847379F296B1698CA3F61',
		});

		// entry 4 - Media
		expect(vault.create.mock.calls[3][0]).toBe(
			'day-one-out/479270F4CAD1429AB1564DB34D0FE337.md'
		);
		expect(vault.create.mock.calls[3][1]).toBe(
			'Ipsum labore tempor eu elit voluptate incididunt sint ea enim aute do minim. Quis mollit ullamco nostrud dolore id id commodo veniam consequat commodo dolore ullamco tempor tempor commodo. Lorem tempor laboris in ipsum ea veniam laboris id sit dolor anim sit consequat nulla et.![](31c871f18f68d2fde4196ccba1f8ece1.jpeg). Nostrud est magna proident nostrud. Velit aliqua consectetur non ea id sit nostrud irure ut. Nostrud ut id consequat commodo ea labore laborum nisi in duis nisi. Aliquip nisi deserunt id laborum excepteur.\n\n' +
				'![](6b73e9bd86a91d3a7ead09268b0fb266.jpeg)'
		);
		expect(vault.create.mock.calls[3][2]).toEqual({
			ctime: 1713563753000,
			mtime: 1713563820000,
		});
		expect(frontmatterObjs[3]).toEqual({
			creationDate: '2024-04-19T21:55',
			location: 'London Eye, London, United Kingdom',
			modifiedDate: '2024-04-19T21:57',
			uuid: '479270F4CAD1429AB1564DB34D0FE337',
			coordinates: `51.50336,-0.11951`,
		});

		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			1,
			'percentage-update',
			20
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			2,
			'percentage-update',
			40
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			3,
			'percentage-update',
			60
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			4,
			'percentage-update',
			80
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			5,
			'percentage-update',
			100
		);
	});

	test('full import with invalid entries', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/journal.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testDataWithInvalidEntry));

		const result = await importJson(
			vault,
			DEFAULT_SETTINGS,
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Returned object
		expect(result).toEqual({
			total: 6,
			successCount: 5,
			ignoreCount: 0,
			failures: [],
			invalidEntries: [
				{
					entryId: '1461153D91EC48C180C606C853FBFD83',
					creationDate: '2024-04-17T23:00:00Z',
					reason: new ZodError([
						{
							code: 'invalid_type',
							expected: 'string',
							received: 'object',
							path: ['text'],
							message: 'Expected string, received object',
						},
					]),
				},
			],
		});

		// entry 1 - Markdown
		expect(vault.create.mock.calls[0][0]).toBe(
			'day-one-out/DF8B32A3FE25400BBBB3A7BBFCD23CE7.md'
		);
		expect(vault.create.mock.calls[0][1]).toBe(
			'# Header 1\n\n' +
				'## Header 2\n\n' +
				'### Header 3\n\n' +
				'#### Header 4\n\n' +
				'##### Header 5\n\n' +
				'###### Header 6\n\n' +
				'> Quote block\n\n' +
				'Highlighted\n\n' +
				'---\n\n' +
				'**Bold**\n\n' +
				'*Italic*\n\n' +
				'- List item 1\n' +
				'- List item 2\n\n' +
				'- [ ] Check item 1\n' +
				'- [ ] Check item 2\n\n' +
				'1. List number 1\n' +
				'2. List number 2\n\n' +
				'`Code span` \n\n' +
				'```\nCode block\n```\n\n\n' +
				'![](31c871f18f68d2fde4196ccba1f8ece1.jpeg)'
		);
		expect(vault.create.mock.calls[0][2]).toEqual({
			ctime: 1713308400000,
			mtime: 1713563751000,
		});
		expect(frontmatterObjs[0]).toEqual({
			activity: 'Train',
			creationDate: '2024-04-16T23:00',
			uuid: 'DF8B32A3FE25400BBBB3A7BBFCD23CE7',
			isAllDay: true,
			location: 'Eurpocar Dublin Airport Terminal 2, Swords, Ireland',
			coordinates: `53.42761,-6.23917`,
			modifiedDate: '2024-04-19T21:55',
			starred: true,
			tags: ['another-dev-testing-tag', 'dev-testing-tag'],
		});

		// entry 2 - Multiple paragraphs
		expect(vault.create.mock.calls[1][0]).toBe(
			'day-one-out/1461153D91EC48C180C606C853FBFD83.md'
		);
		expect(vault.create.mock.calls[1][1]).toBe(
			'Pariatur aute nulla incididunt. Ad dolor irure est in magna est. Ut ex Lorem reprehenderit incididunt enim eiusmod et. Aute sit duis labore quis tempor laborum eiusmod ut ad labore ad.\n\n' +
				'Dolore fugiat qui duis do cupidatat. Amet ut ad aute elit dolor. Lorem nisi adipisicing elit consectetur officia reprehenderit sunt cupidatat reprehenderit in anim est est occaecat duis. Ut veniam ad id aliqua ex excepteur consequat tempor ut eu ex deserunt duis. Consequat labore minim ea veniam Lorem laboris esse minim velit do nostrud nisi ullamco. Dolore adipisicing do ea.'
		);
		expect(vault.create.mock.calls[1][2]).toEqual({
			ctime: 1713394800000,
			mtime: 1713563393000,
		});
		expect(frontmatterObjs[1]).toEqual({
			creationDate: '2024-04-17T23:00',
			isAllDay: true,
			modifiedDate: '2024-04-19T21:49',
			uuid: '1461153D91EC48C180C606C853FBFD83',
		});

		// entry 3 - Hyphens and parentheses
		expect(vault.create.mock.calls[2][0]).toBe(
			'day-one-out/876E72B228F847379F296B1698CA3F61.md'
		);
		expect(vault.create.mock.calls[2][1]).toBe(
			'"This text is in quotes"\n' +
				'This-text-is-hyphenated\n' +
				'(This text is in parentheses)\n\n' +
				'Dolore ex commodo aliqua irure ullamco quis aliquip. Consectetur et magna ullamco amet nisi. Ut commodo officia laborum aliquip Lorem adipisicing ipsum do amet consequat. Fugiat officia dolore aute do quis sunt exercitation. Pariatur sint exercitation ut eiusmod velit sint exercitation ullamco minim commodo qui tempor adipisicing esse amet. Lorem ad sit ullamco dolore labore commodo ea ad officia quis deserunt. Adipisicing duis qui elit ipsum aliqua ipsum ea.'
		);
		expect(vault.create.mock.calls[2][2]).toEqual({
			ctime: 1713563316000,
			mtime: 1713563332000,
		});
		expect(frontmatterObjs[2]).toEqual({
			creationDate: '2024-04-19T21:48',
			location: 'Dundas Castle, Edinburgh, United Kingdom',
			coordinates: `55.97502,-3.41434`,
			modifiedDate: '2024-04-19T21:48',
			pinned: true,
			uuid: '876E72B228F847379F296B1698CA3F61',
		});

		// entry 4 - Media
		expect(vault.create.mock.calls[3][0]).toBe(
			'day-one-out/479270F4CAD1429AB1564DB34D0FE337.md'
		);
		expect(vault.create.mock.calls[3][1]).toBe(
			'Ipsum labore tempor eu elit voluptate incididunt sint ea enim aute do minim. Quis mollit ullamco nostrud dolore id id commodo veniam consequat commodo dolore ullamco tempor tempor commodo. Lorem tempor laboris in ipsum ea veniam laboris id sit dolor anim sit consequat nulla et.![](31c871f18f68d2fde4196ccba1f8ece1.jpeg). Nostrud est magna proident nostrud. Velit aliqua consectetur non ea id sit nostrud irure ut. Nostrud ut id consequat commodo ea labore laborum nisi in duis nisi. Aliquip nisi deserunt id laborum excepteur.\n\n' +
				'![](6b73e9bd86a91d3a7ead09268b0fb266.jpeg)'
		);
		expect(vault.create.mock.calls[3][2]).toEqual({
			ctime: 1713563753000,
			mtime: 1713563820000,
		});
		expect(frontmatterObjs[3]).toEqual({
			creationDate: '2024-04-19T21:55',
			location: 'London Eye, London, United Kingdom',
			modifiedDate: '2024-04-19T21:57',
			uuid: '479270F4CAD1429AB1564DB34D0FE337',
			coordinates: `51.50336,-0.11951`,
		});

		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			1,
			'percentage-update',
			20
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			2,
			'percentage-update',
			40
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			3,
			'percentage-update',
			60
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			4,
			'percentage-update',
			80
		);
		expect(importEvents.trigger).toHaveBeenNthCalledWith(
			5,
			'percentage-update',
			100
		);
	});

	test('should update UUID map when enableInternalLinks is true', async () => {
		// Clear mocks before running this test
		jest.clearAllMocks();

		// Reset the mock implementations
		mockUuidMapStore.read.mockReset();
		mockUuidMapStore.write.mockReset();

		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});

		// Simulate the vault.create behavior
		vault.create.mockImplementation(() => Promise.resolve({} as TFile));
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						uuid: 'abc123',
					},
					{
						...mockEntry,
						uuid: 'def456',
					},
				],
			})
		);

		// Simulate an existing UUID map
		const existingUuidMap = {
			'existing-uuid': 'old-file.md',
		};
		mockUuidMapStore.read.mockResolvedValue(existingUuidMap);

		await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				enableInternalLinks: true, // Enable internal links
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Verify that read was called
		expect(mockUuidMapStore.read).toHaveBeenCalled();

		// Verify that write was called
		expect(mockUuidMapStore.write).toHaveBeenCalled();

		// Verify the map was updated with our entries
		// Get the first argument of the first call to write
		const updatedMap = mockUuidMapStore.write.mock.calls[0][0];

		// Verify that the existing entry was preserved
		expect(updatedMap['existing-uuid']).toBe('old-file.md');

		// Verify that both new UUIDs were added to the map
		expect(updatedMap).toHaveProperty('abc123');
		expect(updatedMap).toHaveProperty('def456');
	});

	test('should NOT update UUID map when enableInternalLinks is false', async () => {
		// Clear mocks before running this test
		jest.clearAllMocks();

		// Reset the mock implementations
		mockUuidMapStore.read.mockReset();
		mockUuidMapStore.write.mockReset();

		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return { children: [fakeJsonFile] } as unknown as TFolder;
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});

		// Simulate the vault.create behavior
		vault.create.mockImplementation(() => Promise.resolve({} as TFile));
		vault.read.mockResolvedValue(
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						uuid: 'abc123',
					},
					{
						...mockEntry,
						uuid: 'def456',
					},
				],
			})
		);

		await importJson(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				enableInternalLinks: false, // Disable internal links
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Verify that read was not called
		expect(mockUuidMapStore.read).not.toHaveBeenCalled();

		// Verify that write was not called
		expect(mockUuidMapStore.write).not.toHaveBeenCalled();
	});
});

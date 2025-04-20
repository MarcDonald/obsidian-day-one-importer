/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { updateFrontMatter } from '../src/update-front-matter';
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

// Helper to create a mock TFolder
function createMockFolder(path: string, children: any[] = []): TFolder {
	return {
		isRoot: false,
		vault: {} as Vault,
		path: path,
		name: path.split('/').pop() || '',
		parent: null,
		children: children,
	} as unknown as TFolder;
}

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
				.fn()
				.mockImplementation(async (): Promise<Record<string, string>> => ({})),
			write: jest.fn().mockImplementation(async (): Promise<void> => {}),
		} as jest.Mocked<UuidMapStore>;
	});

	afterEach(() => {
		jest.clearAllMocks();
		frontmatterObjs = [];
	});

	test('should error if input directory is not found', () => {
		vault.getAbstractFileByPath.mockReturnValue(null); // Simulate missing folder
		expect(() =>
			updateFrontMatter(
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
			if (path === 'testDir') return createMockFolder('testDir');
			return null;
		});

		expect(() =>
			updateFrontMatter(
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
		expect(vault.getAbstractFileByPath).toBeCalledWith('testDir');
		expect(vault.getAbstractFileByPath).toBeCalledWith(
			'testDir/testInput.json'
		);
	});

	test('should error if file name has already been updated in this import', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'testDir') {
				return createMockFolder('testDir', [fakeJsonFile]);
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

		const res = await updateFrontMatter(
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
			'A file named abc123.md has already been updated in this import'
		);
	});

	test('should error if file cannot be found', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});
		// First call is to the JSON file, which should exist
		vault.getFileByPath.mockReturnValueOnce(fakeJsonFile);
		// Second call is to the output file, which should not exist
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

		// Make sure our mock vault.getFileByPath behaves correctly
		// When checking for the JSON file (it should exist)
		expect(vault.getFileByPath('day-one-in/fakeFile.json')).toBeTruthy();
		// When checking for the output MD file (it should not exist)
		expect(vault.getFileByPath('day-one-out/abc123.md')).toBeNull();

		const res = await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				outDirectory: 'day-one-out',
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);
		expect(res.failures).toHaveLength(1);
		expect(res.failures[0].entry.uuid).toBe('abc123');
		expect(res.failures[0].reason).toBe('Could not find file abc123.md');
	});

	test('should use provided date format to name files when date-based naming is enabled', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});

		// Set up mock to return existing files for all getFileByPath calls
		const mockFile = { path: 'mock-file.md' } as unknown as TFile;
		vault.getFileByPath.mockReturnValue(mockFile);

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
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				outDirectory: 'day-one-out',
				dateBasedFileNames: true,
				dateBasedFileNameFormat: 'YYYYMMDDHHmmssS',
				dateBasedAllDayFileNameFormat: 'SssmmHHDDMMYYYY',
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Check that the correct filenames were generated based on dates
		const filePathCalls = vault.getFileByPath.mock.calls.map((call) => call[0]);
		expect(filePathCalls).toContain('day-one-out/202404192155530.md');
		expect(filePathCalls).toContain('day-one-out/033151111032023.md');
	});

	test('should use UUID as file name when date-based naming is not enabled', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});

		// Set up mock to return existing files for all getFileByPath calls
		const mockFile = { path: 'mock-file.md' } as unknown as TFile;
		vault.getFileByPath.mockReturnValue(mockFile);

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
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				outDirectory: 'day-one-out',
				dateBasedFileNames: false,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Check that the correct filenames were generated based on UUIDs
		const filePathCalls = vault.getFileByPath.mock.calls.map((call) => call[0]);
		expect(filePathCalls).toContain('day-one-out/abc123.md');
		expect(filePathCalls).toContain('day-one-out/def456.md');
	});

	test('should handle multiple JSON files if no inFileName is specified', async () => {
		const fakeJsonFile1 = {
			name: 'journal1.json',
			extension: 'json',
			basename: 'journal1',
			stat: {},
		} as unknown as TFile;

		const fakeJsonFile2 = {
			name: 'journal2.json',
			extension: 'json',
			basename: 'journal2',
			stat: {},
		} as unknown as TFile;

		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile1, fakeJsonFile2]);
			}
			if (path === 'day-one-in/journal1.json') {
				return fakeJsonFile1;
			}
			if (path === 'day-one-in/journal2.json') {
				return fakeJsonFile2;
			}
			return null;
		});

		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);

		// First file has one entry
		vault.read.mockImplementationOnce(async () =>
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						uuid: 'abc123',
					},
				],
			})
		);

		// Second file has two entries
		vault.read.mockImplementationOnce(async () =>
			JSON.stringify({
				entries: [
					{
						...mockEntry,
						uuid: 'def456',
					},
					{
						...mockEntry,
						uuid: 'ghi789',
					},
				],
			})
		);

		const result = await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: '', // Empty to test multiple files
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Should have processed 3 entries total
		expect(result.total).toBe(3);
		expect(result.successCount).toBe(3);
		expect(vault.read).toHaveBeenCalledTimes(2);
	});

	test('should update UUID map for internal links when enabled', async () => {
		jest.clearAllMocks();

		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});

		// Set up mock to return existing files for all getFileByPath calls
		const mockFile = { path: 'mock-file.md' } as unknown as TFile;
		vault.getFileByPath.mockReturnValue(mockFile);

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

		const existingUuidMap = {
			xyz789: 'oldFile.md',
		};
		mockUuidMapStore.read.mockResolvedValue(existingUuidMap);

		await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				enableInternalLinks: true,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Verify that write was called at least once
		expect(mockUuidMapStore.write).toHaveBeenCalled();

		// Verify that the map was modified to include both the existing entry and the new one
		const writtenMap = mockUuidMapStore.write.mock.calls[0][0];
		expect(writtenMap).toHaveProperty('xyz789'); // Original entry preserved
		expect(writtenMap).toHaveProperty('abc123'); // New entry added
	});

	test('should NOT update UUID map when internal links are disabled', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});

		// Set up mock to return existing files for all getFileByPath calls
		const mockFile = { path: 'mock-file.md' } as unknown as TFile;
		vault.getFileByPath.mockReturnValue(mockFile);

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

		await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				enableInternalLinks: false,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Check that the UUID map was not updated
		expect(mockUuidMapStore.write).not.toHaveBeenCalled();
	});

	test('should use separate coordinate fields if enabled', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testData));

		const result = await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
				separateCoordinateFields: true,
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		expect(result.total).toBe(testData.entries.length);
		expect(frontmatterObjs.length).toBe(testData.entries.length);

		// Find an entry with location data and check its frontmatter
		const entryWithLocation = frontmatterObjs.find(
			(fm) => fm.latitude && fm.longitude
		);
		expect(entryWithLocation).toBeDefined();
		expect(entryWithLocation.latitude).toBeDefined();
		expect(entryWithLocation.longitude).toBeDefined();
		expect(entryWithLocation.coordinates).toBeUndefined();
	});

	test('should handle invalid entries gracefully', async () => {
		vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === 'day-one-in') {
				return createMockFolder('day-one-in', [fakeJsonFile]);
			}
			if (path === 'day-one-in/fakeFile.json') {
				return fakeJsonFile;
			}
			return null;
		});
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testDataWithInvalidEntry));

		const result = await updateFrontMatter(
			vault,
			{
				...DEFAULT_SETTINGS,
				inDirectory: 'day-one-in',
				inFileName: 'fakeFile.json',
			},
			fileManager,
			importEvents,
			mockUuidMapStore
		);

		// Should have the invalid entry in the results
		expect(result.invalidEntries).toHaveLength(1);
		expect(result.invalidEntries[0].entryId).toBe(
			'1461153D91EC48C180C606C853FBFD83'
		);
		expect(result.invalidEntries[0].reason).toBeInstanceOf(ZodError);
	});
});

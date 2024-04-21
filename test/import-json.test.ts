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
import * as testData from './__test_data__/day-one-in/Dev Journal.json';

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

	it('full import', async () => {
		vault.getFileByPath.mockReturnValue(jest.fn() as unknown as TFile);
		vault.read.mockResolvedValue(JSON.stringify(testData));

		await importJson(vault, DEFAULT_SETTINGS);

		// entry 1
		expect(vault.create.mock.calls[0][0]).toBe(
			'day-one-out/DF8B32A3FE25400BBBB3A7BBFCD23CE7.md'
		);
		expect(vault.create.mock.calls[0][1]).toBe(
			'---\n' +
				'creationDate: 2024-04-16T23:00\n' +
				'modifiedDate: 2024-04-19T21:55\n' +
				'isAllDay: true\n' +
				'starred: true\n' +
				'tags:\n' +
				'  - another-dev-testing-tag\n' +
				'  - dev-testing-tag\n' +
				'activity: Train\n' +
				'location: Eurpocar Dublin Airport Terminal 2, Swords, Ireland\n' +
				'---\n' +
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

		// entry 2
		expect(vault.create.mock.calls[1][0]).toBe(
			'day-one-out/1461153D91EC48C180C606C853FBFD83.md'
		);
		expect(vault.create.mock.calls[1][1]).toBe(
			'---\n' +
				'creationDate: 2024-04-17T23:00\n' +
				'modifiedDate: 2024-04-19T21:49\n' +
				'isAllDay: true\n' +
				'---\n' +
				'Pariatur aute nulla incididunt. Ad dolor irure est in magna est. Ut ex Lorem reprehenderit incididunt enim eiusmod et. Aute sit duis labore quis tempor laborum eiusmod ut ad labore ad.\n\nDolore fugiat qui duis do cupidatat. Amet ut ad aute elit dolor. Lorem nisi adipisicing elit consectetur officia reprehenderit sunt cupidatat reprehenderit in anim est est occaecat duis. Ut veniam ad id aliqua ex excepteur consequat tempor ut eu ex deserunt duis. Consequat labore minim ea veniam Lorem laboris esse minim velit do nostrud nisi ullamco. Dolore adipisicing do ea.'
		);
		expect(vault.create.mock.calls[1][2]).toEqual({
			ctime: 1713394800000,
			mtime: 1713563393000,
		});

		// entry 3
		expect(vault.create.mock.calls[2][0]).toBe(
			'day-one-out/876E72B228F847379F296B1698CA3F61.md'
		);
		expect(vault.create.mock.calls[2][1]).toBe(
			'---\n' +
				'creationDate: 2024-04-19T21:48\n' +
				'modifiedDate: 2024-04-19T21:48\n' +
				'pinned: true\n' +
				'location: Dundas Castle, Edinburgh, United Kingdom\n' +
				'---\n' +
				'Dolore ex commodo aliqua irure ullamco quis aliquip. Consectetur et magna ullamco amet nisi. Ut commodo officia laborum aliquip Lorem adipisicing ipsum do amet consequat. Fugiat officia dolore aute do quis sunt exercitation. Pariatur sint exercitation ut eiusmod velit sint exercitation ullamco minim commodo qui tempor adipisicing esse amet. Lorem ad sit ullamco dolore labore commodo ea ad officia quis deserunt. Adipisicing duis qui elit ipsum aliqua ipsum ea.'
		);
		expect(vault.create.mock.calls[2][2]).toEqual({
			ctime: 1713563316000,
			mtime: 1713563332000,
		});

		// entry 4
		expect(vault.create.mock.calls[3][0]).toBe(
			'day-one-out/479270F4CAD1429AB1564DB34D0FE337.md'
		);
		expect(vault.create.mock.calls[3][1]).toBe(
			'---\n' +
				'creationDate: 2024-04-19T21:55\n' +
				'modifiedDate: 2024-04-19T21:57\n' +
				'location: London Eye, London, United Kingdom\n' +
				'---\n' +
				'Ipsum labore tempor eu elit voluptate incididunt sint ea enim aute do minim. Quis mollit ullamco nostrud dolore id id commodo veniam consequat commodo dolore ullamco tempor tempor commodo. Lorem tempor laboris in ipsum ea veniam laboris id sit dolor anim sit consequat nulla et.![](31c871f18f68d2fde4196ccba1f8ece1.jpeg). Nostrud est magna proident nostrud. Velit aliqua consectetur non ea id sit nostrud irure ut. Nostrud ut id consequat commodo ea labore laborum nisi in duis nisi. Aliquip nisi deserunt id laborum excepteur.\n\n' +
				'![](6b73e9bd86a91d3a7ead09268b0fb266.jpeg)'
		);
		expect(vault.create.mock.calls[3][2]).toEqual({
			ctime: 1713563753000,
			mtime: 1713563820000,
		});

		// entry 5
		expect(vault.create.mock.calls[4][0]).toBe(
			'day-one-out/959E7A13B3B649D681DC573DB7E07967.md'
		);
		expect(vault.create.mock.calls[4][1]).toBe(
			'---\n' +
				'creationDate: 2024-04-21T22:45\n' +
				'modifiedDate: 2024-04-21T22:46\n' +
				'---\n' +
				'![](d500d6789ff2c211af3f507b17be8e66.mp4)'
		);
		expect(vault.create.mock.calls[4][2]).toEqual({
			ctime: 1713739551000,
			mtime: 1713739562000,
		});
	});
});

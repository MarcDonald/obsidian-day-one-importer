/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events, FileManager, TFile, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import { DayOneItem, DayOneItemSchema } from './schema';
import {
	buildFileName,
	ImportFailure,
	ImportInvalidEntry,
	ImportResult,
} from './utils';
import moment from 'moment';

export async function updateFrontMatter(
	vault: Vault,
	settings: DayOneImporterSettings,
	fileManager: FileManager,
	importEvents: Events
): Promise<ImportResult> {
	try {
		const inFile = vault.getFileByPath(
			settings.inDirectory + '/' + settings.inFileName
		);

		if (!inFile) {
			throw new Error('No file found');
		}

		const fileData = await vault.read(inFile);
		const parsedFileData = JSON.parse(fileData);

		const validEntries: DayOneItem[] = [];
		const invalidEntries: ImportInvalidEntry[] = [];

		if (!Array.isArray(parsedFileData.entries)) {
			throw new Error('Invalid file format');
		}

		parsedFileData.entries.forEach((entry: unknown) => {
			const parsedEntry = DayOneItemSchema.safeParse(entry);
			if (parsedEntry.success) {
				validEntries.push(parsedEntry.data);
			} else {
				const entryId = (entry as any)?.uuid;
				const entryCreationDate = (entry as any)?.creationDate;
				invalidEntries.push({
					entryId,
					creationDate: entryCreationDate,
					reason: parsedEntry.error,
				});
				console.error(
					`Invalid entry: ${entryId} ${entryCreationDate} - ${parsedEntry.error}`
				);
			}
		});

		let successCount = 0;
		const ignoreCount = 0;
		const failures: ImportFailure[] = [];

		const fileNames = new Set();

		let percentage = 0;
		for (const [index, item] of validEntries.entries()) {
			try {
				const fileName = buildFileName(settings, item);

				if (fileNames.has(fileName)) {
					throw new Error(
						`A file named ${fileName} has already been updated in this import`
					);
				} else {
					fileNames.add(fileName);
					const entryFile = vault.getFileByPath(
						`${settings.outDirectory}/${fileName}`
					);
					if (entryFile) {
						await writeFrontMatter(entryFile, item, settings, fileManager);
					} else {
						throw new Error(`Could not find file ${fileName}`);
					}
				}

				successCount++;
			} catch (e) {
				console.error(e);
				failures.push({
					entry: item,
					reason: e.message,
				});
			}

			const entryNumber = index + 1;
			percentage = (entryNumber / validEntries.length) * 100;
			importEvents.trigger('percentage-update', percentage);
		}

		return {
			total: validEntries.length + invalidEntries.length,
			successCount,
			ignoreCount,
			failures,
			invalidEntries,
		};
	} catch (err) {
		console.error(err);
		throw err;
	}
}

export async function writeFrontMatter(
	file: TFile,
	item: DayOneItem,
	settings: DayOneImporterSettings,
	fileManager: FileManager
) {
	await fileManager.processFrontMatter(file, (frontMatter) => {
		frontMatter['creationDate'] =
			`${moment(item.creationDate).format('YYYY-MM-DD')}T${moment(item.creationDate).format('HH:mm')}`;
		frontMatter['modifiedDate'] =
			`${moment(item.modifiedDate).format('YYYY-MM-DD')}T${moment(item.modifiedDate).format('HH:mm')}`;
		frontMatter['uuid'] = item.uuid;
		if (item.isAllDay) {
			frontMatter['isAllDay'] = true;
		}
		if (item.isPinned) {
			frontMatter['pinned'] = true;
		}
		if (item.starred) {
			frontMatter['starred'] = true;
		}
		if (item.tags?.length ?? 0 > 0) {
			frontMatter['tags'] = item.tags;
		}
		if (item.userActivity?.activityName) {
			frontMatter['activity'] = item.userActivity.activityName;
		}
		if (item.location) {
			if (
				item.location?.placeName &&
				item.location?.localityName &&
				item.location?.country
			) {
				frontMatter['location'] =
					`${item.location.placeName}, ${item.location.localityName}, ${item.location.country}`;
			} else {
				frontMatter['location'] =
					`${item.location.latitude}, ${item.location.longitude}`;
			}

			if (item.location.latitude && item.location.longitude) {
				if (settings.separateCoordinateFields) {
					frontMatter['coordinates'] = undefined;
					frontMatter['latitude'] = item.location.latitude;
					frontMatter['longitude'] = item.location.longitude;
				} else {
					frontMatter['latitude'] = undefined;
					frontMatter['longitude'] = undefined;
					frontMatter['coordinates'] =
						`${item.location.latitude},${item.location.longitude}`;
				}
			}
		}
	});
}

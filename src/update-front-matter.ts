/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events, FileManager, TFile, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import { DayOneItem } from './schema';
import {
	buildFileName,
	ImportFailure,
	ImportResult,
	collectDayOneEntries,
} from './utils';
import moment from 'moment';
import { UuidMapStore } from './uuid-map';

/**
 * Updates the frontmatter of existing notes based on Day One JSON entries.
 * Unlike importJson, this function doesn't create new files, it only updates
 * the frontmatter of existing files.
 */
export async function updateFrontMatter(
	vault: Vault,
	settings: DayOneImporterSettings,
	fileManager: FileManager,
	importEvents: Events,
	uuidMapStore?: UuidMapStore
): Promise<ImportResult> {
	try {
		// Use the shared utility to collect entries
		const { allEntries, allInvalidEntries } = await collectDayOneEntries(
			vault,
			settings
		);

		// If no entries were found
		if (allEntries.length === 0) {
			return {
				total: 0,
				successCount: 0,
				ignoreCount: 0,
				failures: [],
				invalidEntries: allInvalidEntries,
			};
		}

		// Only handle UUID map if internal links are enabled
		let uuidToFileName: Record<string, string> = {};
		const useInternalLinks = settings.enableInternalLinks && !!uuidMapStore;

		if (useInternalLinks) {
			// Load existing UUID map
			uuidToFileName = await uuidMapStore!.read();
		}

		// Process each entry and update their frontmatter
		const fileNames = new Set();
		let successCount = 0;
		const ignoreCount = 0;
		const failures: ImportFailure[] = [];

		for (const [index, { item }] of allEntries.entries()) {
			try {
				const fileName = useInternalLinks
					? uuidToFileName[item.uuid]
					: buildFileName(settings, item);

				if (fileNames.has(fileName)) {
					throw new Error(
						`A file named ${fileName} has already been updated in this import`
					);
				} else {
					fileNames.add(fileName);

					// Update the UUID mapping if internal links are enabled
					if (useInternalLinks) {
						uuidToFileName[item.uuid] = fileName;
					}

					const entryFile = vault.getFileByPath(
						`${settings.outDirectory}/${fileName}`
					);
					if (entryFile) {
						await writeFrontMatter(entryFile, item, settings, fileManager);
						successCount++;
					} else {
						throw new Error(`Could not find file ${fileName}`);
					}
				}
			} catch (e) {
				console.error(e);
				failures.push({
					entry: item,
					reason: e.message,
				});
			}

			// Update progress
			const entryNumber = index + 1;
			const percentage = (entryNumber / allEntries.length) * 100;
			importEvents.trigger('percentage-update', percentage);
		}

		// Persist UUID map if needed
		if (useInternalLinks) {
			await uuidMapStore!.write(uuidToFileName);
		}

		return {
			total: allEntries.length + allInvalidEntries.length,
			successCount,
			ignoreCount,
			failures,
			invalidEntries: allInvalidEntries,
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
		frontMatter['creationDate'] = moment
			.utc(item.creationDate)
			.format('YYYY-MM-DDTHH:mm');
		frontMatter['modifiedDate'] = moment
			.utc(item.modifiedDate)
			.format('YYYY-MM-DDTHH:mm');
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
					frontMatter['latitude'] = item.location.latitude;
					frontMatter['longitude'] = item.location.longitude;
				} else {
					frontMatter['coordinates'] =
						`${item.location.latitude},${item.location.longitude}`;
				}
			}
		}
	});
}

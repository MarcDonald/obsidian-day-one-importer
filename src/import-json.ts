/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events, FileManager, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import { DayOneItem, MediaObject } from './schema';
import {
	buildFileName,
	ImportFailure,
	ImportResult,
	collectDayOneEntries,
} from './utils';
import { writeFrontMatter } from './update-front-matter';
import { resolveInternalLinks } from './utils';
import { UuidMapStore } from './uuid-map';

export async function importJson(
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

		// Only build UUID map if internal links are enabled
		let uuidToFileName: Record<string, string> = {};
		const useInternalLinks = settings.enableInternalLinks && !!uuidMapStore;

		if (useInternalLinks) {
			try {
				// Try to read an existing UUID map
				uuidToFileName = await uuidMapStore!.read();
			} catch (e) {
				uuidToFileName = {};
				console.log('Failed to read UUID map, starting with an empty map.');
			}

			// Update with new entries
			allEntries.forEach(({ item }) => {
				uuidToFileName[item.uuid] = buildFileName(settings, item);
			});
		}

		// Ensure output directory exists
		if (!vault.getAbstractFileByPath(settings.outDirectory)) {
			console.log(`Creating output directory: ${settings.outDirectory}`);
			await vault.createFolder(settings.outDirectory);
		}

		// Process each entry (create notes)
		const fileNames = new Set();
		let successCount = 0;
		let ignoreCount = 0;
		const failures: ImportFailure[] = [];
		const totalEntries = allEntries.length + allInvalidEntries.length;

		for (const [index, { item }] of allEntries.entries()) {
			try {
				const outFileName = useInternalLinks
					? uuidToFileName[item.uuid]
					: buildFileName(settings, item);

				if (fileNames.has(outFileName)) {
					throw new Error(
						`A file named ${outFileName} has already been created in this import`
					);
				} else {
					fileNames.add(outFileName);
				}

				// Create the actual note file
				const file = await vault.create(
					`${settings.outDirectory}/${outFileName}`,
					buildFileBody(item, useInternalLinks ? uuidToFileName : {}),
					{
						ctime: new Date(item.creationDate).getTime(),
						mtime: new Date(item.modifiedDate).getTime(),
					}
				);

				await writeFrontMatter(file, item, settings, fileManager);
				successCount++;
			} catch (e) {
				if (
					e.message === 'File already exists.' &&
					settings.ignoreExistingFiles
				) {
					ignoreCount++;
				} else {
					console.error(e);
					failures.push({
						entry: item,
						reason: e.message,
					});
				}
			}
			const globalProgress = ((index + 1) / allEntries.length) * 100;
			importEvents.trigger('percentage-import', globalProgress);
		}

		// Persist UUID map if needed
		if (useInternalLinks) {
			await uuidMapStore!.write(uuidToFileName);
		}

		return {
			total: totalEntries,
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

/**
 * Builds the file body for a Day One entry
 * Cleans up text from unwanted characters or sequences
 */
export function buildFileBody(
	item: DayOneItem,
	uuidToFileName: Record<string, string>
): string {
	// Clean up text by removing unwanted characters and sequences
	let text = `${(item.text as string)
		.replace(/\\/gm, '')
		.replace(/```\s+```/gm, '')
		.replace(/\u2028/g, '\n')
		.replace(/\u1C6A/g, '\n\n')
		.replace(/\u200b/g, '')}`;

	const photoMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/\/([^)]+)\)/g)
	);

	const videoMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/video\/([^)]+)\)/g)
	);

	const audioMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/audio\/([^)]+)\)/g)
	);

	const pdfMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/pdfAttachment\/([^)]+)\)/g)
	);

	const replacements = [
		...photoMoments,
		...videoMoments,
		...audioMoments,
		...pdfMoments,
	].map((match) => buildMediaReplacement(item, match));

	if (replacements.length > 0) {
		replacements.forEach((replacement) => {
			text = text.replace(replacement.replace, replacement.with);
		});
	}

	// Only resolve internal links if we have a UUID map
	text =
		Object.keys(uuidToFileName).length > 0
			? resolveInternalLinks(text, uuidToFileName).text
			: text;

	return text;
}

function buildMediaReplacement(item: DayOneItem, match: RegExpMatchArray) {
	// Define media collections with optional custom transform for audio
	// Audio files:
	// 	I tried a few different formats but Day One always seems to convert them to m4a
	// 	May get some bug reports about this in the future if Day One isn't consistent
	const mediaTypes: Array<{
		collection?: MediaObject[];
		fn?: (m: MediaObject) => MediaObject;
	}> = [
		{ collection: item.photos },
		{ collection: item.videos },
		{ collection: item.pdfAttachments },
		{
			collection: item.audios,
			fn: (audio: MediaObject) => ({ ...audio, type: 'm4a' }),
		},
	];

	// Find the media object in any of the collections
	let mediaObj: MediaObject | null = null;
	for (const { collection, fn = (media: MediaObject) => media } of mediaTypes) {
		if (!collection) continue;

		const found = collection.find((media) => media.identifier === match[1]);
		console.log(`Found media with identifier ${found?.identifier}`);
		if (found) {
			mediaObj = fn(found);
			break;
		}
	}

	// Create markdown link if media was found
	if (mediaObj) {
		// Ensure we have a type value, default to extension-less format if not provided
		const mediaFileName = mediaObj.type
			? `${mediaObj.md5}.${mediaObj.type}`
			: mediaObj.md5;

		return {
			replace: match[0],
			with: `![](${mediaFileName})`,
		};
	}

	// Log error and return unchanged if no media found
	console.error(
		`Could not find media with identifier ${match[1]} in entry ${item.uuid}`
	);

	return {
		replace: match[0],
		with: match[0],
	};
}

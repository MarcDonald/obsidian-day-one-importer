/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events, FileManager, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import { DayOneItem, DayOneItemSchema, MediaObject } from './schema';
import {
	buildFileName,
	ImportFailure,
	ImportInvalidEntry,
	ImportResult,
} from './utils';
import { writeFrontMatter } from './update-front-matter';

export async function importJson(
	vault: Vault,
	settings: DayOneImporterSettings,
	fileManager: FileManager,
	importEvents: Events
): Promise<ImportResult> {
	try {
		const file = vault.getFileByPath(
			settings.inDirectory + '/' + settings.inFileName
		);

		if (!file) {
			throw new Error('No file found');
		}

		const fileData = await vault.read(file);
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
		let ignoreCount = 0;
		const failures: ImportFailure[] = [];

		const fileNames = new Set();

		let percentage = 0;
		for (const [index, item] of validEntries.entries()) {
			try {
				const fileName = buildFileName(settings, item);

				if (fileNames.has(fileName)) {
					throw new Error(
						`A file named ${fileName} has already been created in this import`
					);
				} else {
					fileNames.add(fileName);
				}

				const file = await vault.create(
					`${settings.outDirectory}/${fileName}`,
					// Day One seems to export escaped full stops for some reason, so replace those with just a regular full stop
					buildFileBody(item),
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

function buildFileBody(item: DayOneItem): string {
	let returned = `${(item.text as string).replace(/\\/gm, '')}`;

	const photoMoments = Array.from(
		returned.matchAll(/!\[]\(dayone-moment:\/\/([^)]+)\)/g)
	);

	const videoMoments = Array.from(
		returned.matchAll(/!\[]\(dayone-moment:\/video\/([^)]+)\)/g)
	);

	const audioMoments = Array.from(
		returned.matchAll(/!\[]\(dayone-moment:\/audio\/([^)]+)\)/g)
	);

	const pdfMoments = Array.from(
		returned.matchAll(/!\[]\(dayone-moment:\/pdfAttachment\/([^)]+)\)/g)
	);

	const replacements = [
		...photoMoments,
		...videoMoments,
		...audioMoments,
		...pdfMoments,
	].map((match) => buildMediaReplacement(item, match));

	if (replacements.length > 0) {
		replacements.forEach((replacement) => {
			returned = returned.replace(replacement.replace, replacement.with);
		});
	}

	return returned;
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events, FileManager, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import { DayOneItem } from './schema';
import {
	buildFileName,
	ImportFailure,
	ImportResult,
	collectDayOneEntries,
} from './utils';
import { writeFrontMatter } from './update-front-matter';
import { resolveInternalLinks } from './utils';
import { UuidMapStore } from './uuid-map';

/**
 * Import Day One JSON entries and create markdown notes.
 */
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
			importEvents.trigger('percentage-update', globalProgress);
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

function buildFileBody(
	item: DayOneItem,
	uuidToFileName: Record<string, string>
): string {
	let text = `${(item.text as string).replace(/\\/gm, '')}`;

	const photoMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/\/([^)]+)\)/g)
	);

	const videoMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/video\/([^)]+)\)/g)
	);

	const audioMoments = Array.from(
		text.matchAll(/!\[]\(dayone-moment:\/audio\/([^)]+)\)/g)
	);

	// Replace the photos
	if (photoMoments.length) {
		for (const match of photoMoments) {
			text = text.replace(match[0], buildMediaReplacement(item, match));
		}
	}

	// Replace the videos
	if (videoMoments.length) {
		for (const match of videoMoments) {
			text = text.replace(match[0], buildMediaReplacement(item, match));
		}
	}

	// Replace the audios
	if (audioMoments.length) {
		for (const match of audioMoments) {
			text = text.replace(match[0], buildMediaReplacement(item, match));
		}
	}

	// Only resolve internal links if we have a UUID map
	return Object.keys(uuidToFileName).length > 0
		? resolveInternalLinks(text, uuidToFileName).text
		: text;
}

function buildMediaReplacement(item: DayOneItem, match: RegExpMatchArray) {
	// Find the photo in the item's photos array
	let mediaId = match[1];

	if (mediaId.startsWith('/')) {
		// For videos and audios with format /audio/abc-123
		mediaId = mediaId.substring(mediaId.lastIndexOf('/') + 1);
	}

	// Check if thumbnail image exists among photos
	if (item.photos) {
		const photo = item.photos.find((p) => p.identifier === mediaId);
		if (photo) {
			return `![](${photo.md5}.jpeg)`;
		}
	}

	// Check for videos
	if (item.videos) {
		const video = item.videos.find((v) => v.identifier === mediaId);
		if (video) {
			// For videos, use the MD5 with mp4 extension
			return `![](${video.md5}.mp4)`;
		}
	}

	// Check for audios
	if (item.audios) {
		const audio = item.audios.find((a) => a.identifier === mediaId);
		if (audio) {
			// For audios, use the MD5 with m4a extension
			return `![](${audio.md5}.m4a)`;
		}
	}

	// If media not found, return the original match
	return match[0];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Events, FileManager, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import { z } from 'zod';
import { DayOneItem, DayOneItemSchema } from './schema';
import { buildFileName } from './utils';
import { writeFrontMatter } from './update-front-matter';

export async function importJson(
	vault: Vault,
	settings: DayOneImporterSettings,
	fileManager: FileManager,
	importEvents: Events
) {
	try {
		const file = vault.getFileByPath(
			settings.inDirectory + '/' + settings.inFileName
		);

		if (!file) {
			throw new Error('No file found');
		}

		const fileData = await vault.read(file);
		const parsedFileData = JSON.parse(fileData);
		const entries = z.array(DayOneItemSchema).parse(parsedFileData.entries);

		let successCount = 0;
		let ignoreCount = 0;
		const failures: { entry: DayOneItem; reason: string }[] = [];

		const fileNames = new Set();

		let percentage = 0;
		for (const [index, item] of entries.entries()) {
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

				await writeFrontMatter(file, item, fileManager);

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
			percentage = (entryNumber / entries.length) * 100;
			importEvents.trigger('percentage-update', percentage);
		}

		return {
			total: entries.length,
			successCount,
			ignoreCount,
			failures,
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

	const replacements = [...photoMoments, ...videoMoments].map((match) =>
		buildMediaReplacement(item, match)
	);

	if (replacements.length > 0) {
		replacements.forEach((replacement) => {
			returned = returned.replace(replacement.replace, replacement.with);
		});
	}

	return returned;
}

function buildMediaReplacement(item: DayOneItem, match: RegExpMatchArray) {
	let mediaObj = item.photos?.find((p: any) => p.identifier === match[1]);

	if (!mediaObj) {
		mediaObj = item.videos?.find((p: any) => p.identifier === match[1]);
	}

	if (mediaObj) {
		const mediaFileName = `${mediaObj.md5}.${mediaObj.type}`;
		return {
			replace: match[0],
			with: `![](${mediaFileName})`,
		};
	}

	console.error(
		`Could not find photo or video with identifier ${match[1]} in entry ${item.uuid}`
	);
	return {
		replace: match[0],
		with: match[0],
	};
}

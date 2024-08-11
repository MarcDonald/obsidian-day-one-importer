/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	Events,
	FileManager,
	moment,
	normalizePath,
	TFile,
	Vault,
} from 'obsidian';
import { DayOneImporterSettings } from './main';
import { z } from 'zod';

const DayOneItemSchema = z.object({
	modifiedDate: z.string().datetime(),
	creationDate: z.string().datetime(),
	isAllDay: z.boolean().optional(),
	isPinned: z.boolean().optional(),
	starred: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
	text: z.string().default(''),
	userActivity: z
		.object({
			activityName: z.string().optional(),
		})
		.optional(),
	location: z
		.object({
			localityName: z.string().optional(),
			country: z.string().optional(),
			placeName: z.string().optional(),
			latitude: z.number(),
			longitude: z.number(),
		})
		.optional(),
	uuid: z.string(),
	photos: z
		.array(
			z.object({
				type: z.string(),
				identifier: z.string(),
				md5: z.string(),
			})
		)
		.optional(),
	videos: z
		.array(
			z.object({
				type: z.string(),
				identifier: z.string(),
				md5: z.string(),
			})
		)
		.optional(),
});

type DayOneItem = z.infer<typeof DayOneItemSchema>;

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

				await addFrontMatter(file, item, fileManager);

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

function buildFileName(settings: DayOneImporterSettings, item: DayOneItem) {
	if (settings.dateBasedFileNames) {
		if (item.isAllDay) {
			return normalizePath(
				`${moment(item.creationDate).format(settings.dateBasedAllDayFileNameFormat)}.md`
			);
		} else {
			return normalizePath(
				`${moment(item.creationDate).format(settings.dateBasedFileNameFormat)}.md`
			);
		}
	} else {
		return normalizePath(`${item.uuid}.md`);
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

async function addFrontMatter(
	file: TFile,
	item: DayOneItem,
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
		}
	});
}

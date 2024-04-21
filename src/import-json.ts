/* eslint-disable @typescript-eslint/no-explicit-any */
import { moment, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';

export async function importJson(
	vault: Vault,
	settings: DayOneImporterSettings
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
		const entries = parsedFileData.entries;
		console.log(`Found ${entries.length} journal entries`);

		let successCount = 0;
		const failures: any[] = [];

		const fileNames = new Set();

		entries.forEach((item: any) => {
			try {
				const fileName = buildFileName(settings, item);

				if (fileNames.has(fileName)) {
					throw new Error(`A file named ${fileName} already exists`);
				} else {
					fileNames.add(fileName);
				}

				let fileData = '';

				fileData += buildFrontmatter(item);

				// Day One seems to export escaped full stops for some reason, so replace those with just a regular full stop
				fileData += buildFileBody(item);

				vault.create(`${settings.outDirectory}/${fileName}`, fileData, {
					ctime: new Date(item.creationDate).getTime(),
					mtime: new Date(item.modifiedDate).getTime(),
				});
				console.log(`${fileName} created successfully`);
				successCount++;
			} catch (e) {
				console.error(e);
				failures.push({
					entry: item,
					reason: e.message,
				});
			}
		});

		return {
			total: entries.length,
			successCount: successCount,
			failures,
		};
	} catch (err) {
		console.error(err);
		throw err;
	}
}

function buildFileName(settings: DayOneImporterSettings, item: any) {
	if (settings.dateBasedFileNames) {
		if (item.isAllDay) {
			return `${moment(item.creationDate).format(settings.dateBasedAllDayFileNameFormat)}.md`;
		} else {
			return `${moment(item.creationDate).format(settings.dateBasedFileNameFormat)}.md`;
		}
	} else {
		return `${item.uuid}.md`;
	}
}

function buildFrontmatter(item: any) {
	let fileData = '---\n';
	fileData += buildFrontmatterProperty(
		'creationDate',
		`${moment(item.creationDate).format('YYYY-MM-DD')}T${moment(item.creationDate).format('HH:mm')}`
	);
	fileData += buildFrontmatterProperty(
		'modifiedDate',
		`${moment(item.modifiedDate).format('YYYY-MM-DD')}T${moment(item.modifiedDate).format('HH:mm')}`
	);

	if (item.isAllDay) {
		fileData += buildFrontmatterProperty('isAllDay', 'true');
	}
	if (item.isPinned) {
		fileData += buildFrontmatterProperty('pinned', 'true');
	}
	if (item.starred) {
		fileData += buildFrontmatterProperty('starred', 'true');
	}

	if (item.tags) {
		fileData += buildFrontmatterProperty('tags', item.tags);
	}

	if (item.userActivity) {
		fileData += buildFrontmatterProperty(
			'activity',
			item.userActivity.activityName
		);
	}
	if (item.location) {
		fileData += buildFrontmatterProperty(
			'location',
			`${item.location.placeName}, ${item.location.localityName}, ${item.location.country}`
		);
	}

	fileData += `---\n`;
	return fileData;
}

function buildFrontmatterProperty(
	propertyName: string,
	propertyValue: string | string[]
) {
	if (Array.isArray(propertyValue)) {
		return `${propertyName}:\n${propertyValue.map((item: string) => '  - ' + item + '\n').join('')}`;
	}

	return `${propertyName}: ${propertyValue}\n`;
}

function buildFileBody(item: any): string {
	if (typeof item.text !== 'string') {
		throw new Error('item.text is not a string');
	}

	let returned = `${(item.text as string).replace(/\\./gm, '.')}`;

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

function buildMediaReplacement(item: any, match: RegExpMatchArray) {
	let mediaObj = item.photos?.find((p: any) => p.identifier === match[1]);

	if (!mediaObj) {
		mediaObj = item.videos?.find((p: any) => p.identifier === match[1]);
	}

	if (mediaObj) {
		const mediaFileName = `${mediaObj.md5}.${mediaObj.type}`;
		console.log(`Replacing ${match[0]} with ![]${mediaFileName}`);
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

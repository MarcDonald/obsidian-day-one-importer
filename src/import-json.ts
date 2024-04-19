/* eslint-disable @typescript-eslint/no-explicit-any */
import { moment, Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';
import * as path from 'node:path';

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
		let failureCount = 0;
		entries.forEach((item: any) => {
			try {
				const fileName =
					moment(item.creationDate).format(`YYYYMMDDHHMMss`) + '.md';

				let fileData = '---\n';
				fileData += buildFrontmatterProperty(
					'creationDate',
					`${moment(item.creationDate).format('YYYY-MM-DD')}T${moment(item.creationDate).format('HH:MM')}`
				);
				fileData += buildFrontmatterProperty(
					'modifiedDate',
					`${moment(item.modifiedDate).format('YYYY-MM-DD')}T${moment(item.modifiedDate).format('HH:MM')}`
				);

				if (item.isAllDay) {
					fileData += buildFrontmatterProperty('isAllDay', 'true');
				}
				if (item.isPinned) {
					fileData += buildFrontmatterProperty('isPinned', 'true');
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

				fileData += `${item.text}`;

				vault.create(path.join(settings.outDirectory, fileName), fileData, {
					ctime: new Date(item.creationDate).getTime(),
					mtime: new Date(item.modifiedDate).getTime(),
				});
				console.log(`${fileName} created successfully`);
				successCount++;
			} catch (e) {
				console.error(e);
				failureCount++;
			}
		});

		return Promise.resolve({
			total: entries.length,
			successes: successCount,
			failures: failureCount,
		});
	} catch (err) {
		console.error(err);
		throw err;
	}
}

function buildFrontmatterProperty(
	propertyName: string,
	propertyValue: string | string[]
) {
	if (Array.isArray(propertyValue)) {
		return `${propertyName}:\n${propertyValue.map((item: string) => '  - ' + item + '\n').join('')}\n`;
	}

	return `${propertyName}: ${propertyValue}\n`;
}

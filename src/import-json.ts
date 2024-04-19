/* eslint-disable @typescript-eslint/no-explicit-any */
import { Vault } from 'obsidian';
import { DayOneImporterSettings } from './main';

function sleep(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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
		const failureCount = 0;
		entries.forEach((item: any, i: number) => {
			if (i < 3) {
				successCount++;
				vault.create(
					settings.outDirectory + '/' + item.creationDate + '.md',
					item.text
				);
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

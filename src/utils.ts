import { DayOneImporterSettings } from './main';
import { DayOneItem } from './schema';
import { normalizePath } from 'obsidian';
import { ZodError } from 'zod';
import moment from 'moment';
import { TFile, TFolder, Vault, Notice } from 'obsidian';
import { DayOneItemSchema } from './schema';

export const ILLEGAL_FILENAME_CHARACTERS = [
	'[',
	']',
	':',
	'\\',
	'/',
	'^',
	'|',
	'#',
];

export function buildFileName(
	settings: DayOneImporterSettings,
	item: DayOneItem
) {
	if (settings.dateBasedFileNames) {
		if (item.isAllDay) {
			return normalizePath(
				`${moment.utc(item.creationDate).format(settings.dateBasedAllDayFileNameFormat)}.md`
			);
		} else {
			return normalizePath(
				`${moment.utc(item.creationDate).format(settings.dateBasedFileNameFormat)}.md`
			);
		}
	} else {
		return normalizePath(`${item.uuid}.md`);
	}
}

export type ImportFailure = { entry: DayOneItem; reason: string };
export type ImportInvalidEntry = {
	entryId?: string;
	creationDate?: string;
	reason: ZodError;
};

export type ImportResult = {
	total: number;
	successCount: number;
	ignoreCount: number;
	failures: ImportFailure[];
	invalidEntries: ImportInvalidEntry[];
};

export function isIllegalFileName(fileName: string): boolean {
	return ILLEGAL_FILENAME_CHARACTERS.some((illegal) =>
		fileName.contains(illegal)
	);
}

/**
 * Utility for resolving Day One internal links to Obsidian wiki-links using a UUID-to-filename map.
 * Returns the updated text along with statistics about how many links were resolved.
 */
export function resolveInternalLinks(
	text: string,
	uuidToFileName: Record<string, string>
): { text: string; resolvedCount: number; totalCount: number } {
	let resolvedCount = 0;
	let totalCount = 0;

	const updatedText = text.replace(
		/\[([^\]]+)\]\(dayone:\/\/view\?entryId=([A-F0-9]+)\)/g,
		(match, linkText, uuid) => {
			totalCount++;
			const fileName = uuidToFileName[uuid];
			if (fileName) {
				resolvedCount++;
				return `[[${fileName}|${linkText}]]`;
			}
			return match;
		}
	);

	return { text: updatedText, resolvedCount, totalCount };
}

/**
 * Checks if the given object is an instance of TFolder or TFile
 * without relying on 'instanceof' operator since it breaks testing
 */
export function isTFolder(obj: unknown): obj is TFolder {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'children' in obj &&
		Array.isArray((obj as { children?: unknown }).children)
	);
}

export function isTFile(obj: unknown): obj is TFile {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'basename' in obj &&
		'extension' in obj &&
		'stat' in obj
	);
}

/**
 * Collects and validates entries from Day One JSON files.
 * Shared function used by both importJson and updateFrontMatter.
 */
export async function collectDayOneEntries(
	vault: Vault,
	settings: DayOneImporterSettings
): Promise<{
	allEntries: { item: DayOneItem; fileName: string }[];
	allInvalidEntries: ImportInvalidEntry[];
}> {
	const folder = settings.inDirectory;
	const fileNameOverride = settings.inFileName;

	const folderFiles = vault.getAbstractFileByPath(folder);
	if (!folderFiles || !isTFolder(folderFiles)) {
		new Notice('Input directory does not exist. Please check your settings.');
		throw new Error('Input directory does not exist.');
	}

	let filesToProcess: string[] = [];
	if (fileNameOverride && fileNameOverride.trim() !== '') {
		filesToProcess = [fileNameOverride];
		const file = vault.getAbstractFileByPath(folder + '/' + fileNameOverride);
		if (!file || !isTFile(file)) {
			new Notice(
				`File ${fileNameOverride} does not exist in the input directory.`
			);
			throw new Error(
				`File ${fileNameOverride} does not exist in the input directory.`
			);
		}
	} else {
		filesToProcess = folderFiles.children
			.filter((f) => isTFile(f) && f.name.endsWith('.json'))
			.map((f) => f.name);
	}

	if (!filesToProcess.length) {
		new Notice('No JSON files found in the input directory.');
		return {
			allEntries: [],
			allInvalidEntries: [],
		};
	}

	// Collect all entries from all files
	const allEntries: { item: DayOneItem; fileName: string }[] = [];
	const allInvalidEntries: ImportInvalidEntry[] = [];

	for (const fileName of filesToProcess) {
		const file = vault.getAbstractFileByPath(folder + '/' + fileName);
		if (!file || !isTFile(file)) {
			console.error(`No file found: ${folder}/${fileName}`);
			continue;
		}
		const fileData = await vault.read(file);
		const parsedFileData = JSON.parse(fileData);
		if (!Array.isArray(parsedFileData.entries)) {
			console.error('Invalid file format in ' + fileName);
			continue;
		}
		parsedFileData.entries.forEach((entry: unknown) => {
			const parsedEntry = DayOneItemSchema.safeParse(entry);
			if (parsedEntry.success) {
				allEntries.push({ item: parsedEntry.data, fileName });
			} else {
				const entryId = (entry as DayOneItem)?.uuid;
				const entryCreationDate = (entry as DayOneItem)?.creationDate;
				allInvalidEntries.push({
					entryId,
					creationDate: entryCreationDate,
					reason: parsedEntry.error,
				});
				console.error(
					`Invalid entry: ${entryId} ${entryCreationDate} - ${parsedEntry.error}`
				);
			}
		});
	}

	return {
		allEntries,
		allInvalidEntries,
	};
}

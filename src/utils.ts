import { DayOneImporterSettings } from './main';
import { DayOneItem } from './schema';
import { moment, normalizePath } from 'obsidian';
import { ZodError } from 'zod';

export function buildFileName(
	settings: DayOneImporterSettings,
	item: DayOneItem
) {
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

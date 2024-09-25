import { DayOneImporterSettings } from './main';
import { DayOneItem } from './schema';
import { moment, normalizePath } from 'obsidian';

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

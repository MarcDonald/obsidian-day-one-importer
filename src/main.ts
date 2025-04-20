import { EventRef, Events, Plugin, Notice, TFolder, TFile } from 'obsidian';
import { SettingsTab } from './settings-tab';
import { UuidMapStoreImpl } from './uuid-map';
import { ImportResult, resolveInternalLinks } from './utils';
import moment from 'moment';

export interface DayOneImporterSettings {
	inDirectory: string;
	inFileName?: string;
	outDirectory: string;
	dateBasedFileNames: boolean;
	dateBasedFileNameFormat: string;
	dateBasedAllDayFileNameFormat: string;
	ignoreExistingFiles: boolean;
	separateCoordinateFields: boolean;
	enableInternalLinks: boolean;
}

export const DEFAULT_SETTINGS: DayOneImporterSettings = {
	inDirectory: 'day-one-in',
	inFileName: 'journal.json',
	outDirectory: 'day-one-out',
	dateBasedFileNames: false,
	dateBasedFileNameFormat: 'YYYY-MM-DD HHmmss',
	dateBasedAllDayFileNameFormat: 'YYYY-MM-DD',
	ignoreExistingFiles: false,
	separateCoordinateFields: false,
	enableInternalLinks: false,
};

export default class DayOneImporter extends Plugin {
	settings: DayOneImporterSettings;
	importEvents = new Events();
	percentageUpdateRef: EventRef;
	uuidMapStore: UuidMapStoreImpl;

	async onload() {
		await this.loadSettings();
		this.uuidMapStore = new UuidMapStoreImpl(this);
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {
		this.importEvents.offref(this.percentageUpdateRef);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async resolveInternalLinksInNotes(): Promise<void> {
		// Only proceed if internal links resolving is enabled
		if (!this.settings.enableInternalLinks) {
			new Notice('Internal link resolving is disabled in settings.');
			return;
		}
		// Check if UUID map exists
		let uuidMap: Record<string, string> = {};
		try {
			uuidMap = await this.uuidMapStore.read();
		} catch (e) {
			new Notice(
				'No UUID map found. Make sure you have imported with internal links enabled.'
			);
			return;
		}
		// Get output directory and process only .md files
		const folder = this.app.vault.getAbstractFileByPath(
			this.settings.outDirectory
		);
		if (!folder || !(folder instanceof TFolder)) {
			new Notice('Output directory does not exist.');
			return;
		}
		const notes = folder.children.filter(
			(f) => f instanceof TFile && f.extension === 'md'
		) as TFile[];
		for (const note of notes) {
			const content = await this.app.vault.cachedRead(note);
			const updated = resolveInternalLinks(content, uuidMap);
			if (updated !== content) {
				await this.app.vault.modify(note, updated);
			}
		}
	}

	async handleImportResult(res: ImportResult, type: 'import' | 'update') {
		new Notice(
			`${type === 'import' ? 'Import' : 'Update'} results:\n` +
				`Successful: ${res.successCount}\nFailed: ${res.failures.length}\nInvalid: ${res.invalidEntries.length}\nIgnored: ${res.ignoreCount}`
		);

		res.failures.forEach((failure) => {
			if (failure.entry) {
				new Notice(
					`Entry ${failure.entry.uuid} failed to ${type}. ${failure.reason}`
				);
			} else {
				new Notice(
					`A file or directory-related failure occurred during ${type}: ${failure.reason}`
				);
			}
		});

		let errorFileContent: string = '';

		if (res.invalidEntries.length > 0) {
			errorFileContent += res.invalidEntries
				.map((invalidEntry) => {
					const entryId = invalidEntry.entryId || 'N/A';
					const creationDate = invalidEntry.creationDate
						? moment(invalidEntry.creationDate).format('YYYY-MM-DD HH:mm:ss')
						: 'N/A';
					return `- ${entryId} - ${creationDate}\n  - ${JSON.stringify(invalidEntry.reason)}`;
				})
				.join('\n');
		}

		if (res.failures.length > 0) {
			errorFileContent += res.failures
				.filter((failure) => failure.entry)
				.map((failure) => {
					const uuid = failure.entry?.uuid || 'N/A';
					const creationDate = failure.entry?.creationDate
						? moment(failure.entry.creationDate).format('YYYY-MM-DD HH:mm:ss')
						: 'N/A';
					return `- ${uuid} - ${creationDate}\n  - ${failure.reason}`;
				})
				.join('\n');
		}

		if (errorFileContent.length > 0) {
			await this.app.vault.create(
				`${this.settings.outDirectory}/Failed ${type === 'import' ? 'Imports' : 'Updates'} ${moment().toDate().getTime()}.md`,
				errorFileContent
			);
		}
	}
}

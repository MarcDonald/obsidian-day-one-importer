import { EventRef, Events, Plugin, Notice, TFolder, TFile } from 'obsidian';
import { SettingsTab } from './settings-tab';
import { UuidMapStoreImpl } from './uuid-map';
import { ImportResult, resolveInternalLinks } from './utils';
import moment from 'moment';

export type TagStyle =
	| 'camelCase'
	| 'PascalCase'
	| 'snake_case'
	| 'kebab-case'
	| undefined;

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
	tagStyle?: TagStyle;
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
	tagStyle: undefined,
};

export default class DayOneImporter extends Plugin {
	settings: DayOneImporterSettings;
	importEvents = new Events();
	percentageImportRef: EventRef;
	percentageUpdateRef: EventRef;
	uuidMapStore: UuidMapStoreImpl;

	async onload() {
		await this.loadSettings();
		this.uuidMapStore = new UuidMapStoreImpl(this);
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {
		this.importEvents.offref(this.percentageUpdateRef);
		this.importEvents.offref(this.percentageImportRef);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async resolveInternalLinksInNotes(): Promise<void> {
		// Extra check: only proceed if internal links resolving is enabled
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

		let totalResolvedLinks = 0;
		let totalLinks = 0;
		let updatedNotes = 0;

		for (const note of notes) {
			const content = await this.app.vault.cachedRead(note);
			const result = resolveInternalLinks(content, uuidMap);

			if (result.text !== content) {
				await this.app.vault.modify(note, result.text);
				updatedNotes++;
			}

			totalResolvedLinks += result.resolvedCount;
			totalLinks += result.totalCount;
		}

		// Display a summary notice
		if (totalLinks > 0) {
			new Notice(
				`Resolved ${totalResolvedLinks} out of ${totalLinks} internal links across ${updatedNotes} notes.`
			);
		} else {
			new Notice('No Day One internal links found in any notes.');
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

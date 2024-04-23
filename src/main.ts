import { EventRef, Events, Plugin } from 'obsidian';
import { SettingsTab } from './settings-tab';

export interface DayOneImporterSettings {
	inFileName: string;
	inDirectory: string;
	outDirectory: string;
	dateBasedFileNames: boolean;
	dateBasedFileNameFormat: string;
	dateBasedAllDayFileNameFormat: string;
}

export const DEFAULT_SETTINGS: DayOneImporterSettings = {
	inDirectory: 'day-one-in',
	inFileName: 'journal.json',
	outDirectory: 'day-one-out',
	dateBasedFileNames: false,
	dateBasedFileNameFormat: 'YYYY-MM-DD HHmmss',
	dateBasedAllDayFileNameFormat: 'YYYY-MM-DD',
};

export default class DayOneImporter extends Plugin {
	settings: DayOneImporterSettings;
	importEvents = new Events();
	percentageUpdateRef: EventRef;

	async onload() {
		await this.loadSettings();

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
}

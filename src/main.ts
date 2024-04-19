import { Plugin } from 'obsidian';
import { SettingsTab } from './settings-tab';

export interface DayOneImporterSettings {
	inFileName: string;
	inDirectory: string;
	outDirectory: string;
}

const DEFAULT_SETTINGS: DayOneImporterSettings = {
	inDirectory: 'day-one-in',
	inFileName: 'journal.json',
	outDirectory: 'day-one-out',
};

export default class DayOneImporter extends Plugin {
	settings: DayOneImporterSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

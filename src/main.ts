import { Plugin } from 'obsidian';
import { SettingsTab } from './settings-tab';

interface DayOneImporterSettings {
	importDirectory: string;
	exportDirectory: string;
}

const DEFAULT_SETTINGS: DayOneImporterSettings = {
	importDirectory: 'day-one-import',
	exportDirectory: 'day-one-export',
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

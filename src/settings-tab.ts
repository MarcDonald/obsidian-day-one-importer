import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import DayOneImporter from './main';
import { importJson } from './import-json';

export class SettingsTab extends PluginSettingTab {
	plugin: DayOneImporter;

	constructor(app: App, plugin: DayOneImporter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Day One Files')
			.setDesc('Location where you extracted the zip file from Day One')
			.addText((text) =>
				text
					.setPlaceholder('Directory')
					.setValue(this.plugin.settings.inDirectory)
					.onChange(async (value) => {
						this.plugin.settings.inDirectory = value;
						await this.plugin.saveSettings();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder('Journal JSON file')
					.setValue(this.plugin.settings.inFileName)
					.onChange(async (value) => {
						this.plugin.settings.inFileName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Out Directory')
			.setDesc('Directory to create imported files in')
			.addText((text) =>
				text
					.setPlaceholder('day-one-out')
					.setValue(this.plugin.settings.outDirectory)
					.onChange(async (value) => {
						this.plugin.settings.outDirectory = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Import').onClick(() => {
				button.setDisabled(true);
				importJson(this.app.vault, this.plugin.settings)
					.then((res) => {
						new Notice(JSON.stringify(res));
					})
					.catch((err) => {
						new Notice(err);
					})
					.finally(() => {
						button.setDisabled(false);
					});
			})
		);
	}
}

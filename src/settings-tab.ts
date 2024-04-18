import { App, PluginSettingTab, Setting } from 'obsidian';
import DayOneImporter from './main';

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
			.setName('Import Directory')
			.setDesc('Directory to create imported files in')
			.addText((text) =>
				text
					.setPlaceholder('day-one')
					.setValue(this.plugin.settings.importDirectory)
					.onChange(async (value) => {
						this.plugin.settings.importDirectory = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

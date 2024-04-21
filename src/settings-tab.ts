import { App, moment, Notice, PluginSettingTab, Setting } from 'obsidian';
import DayOneImporter from './main';
import { importJson } from './import-json';

const ILLEGAL_FILENAME_CHARACTERS = ['[', ']', ':', '\\', '/', '^', '|', '#'];

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

		new Setting(containerEl).setName('File name').setHeading();

		new Setting(containerEl)
			.setName('Date-based File Names (may cause collisions)')
			.setDesc(
				"Use entry's creation date as the file name. This may cause collisions and files to be overwritten if two entries have the same creation date/time." +
					"If this option is disabled then the entry's UUID will be used as the file name. This guarantees no collisions."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.dateBasedFileNames)
					.onChange(async (value) => {
						this.plugin.settings.dateBasedFileNames = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Date-based File Name Format')
			.addMomentFormat((timeFormat) =>
				timeFormat
					.setValue(this.plugin.settings.dateBasedFileNameFormat.toString())
					.setPlaceholder('YYYY-MM-DD HH:mm:ss')
					.onChange(async (value) => {
						if (value !== '') {
							if (isIllegalFileName(value)) {
								new Notice(
									`File name cannot contain any of the following characters: ${ILLEGAL_FILENAME_CHARACTERS.join('')}`
								);
							} else {
								this.plugin.settings.dateBasedFileNameFormat = value;
								await this.plugin.saveSettings();
							}
						}
					})
			);

		new Setting(containerEl)
			.setName('Date-based File Name Format (All Day Entries)')
			.addMomentFormat((timeFormat) =>
				timeFormat
					.setValue(
						this.plugin.settings.dateBasedAllDayFileNameFormat.toString()
					)
					.setPlaceholder('YYYY-MM-DD')
					.onChange(async (value) => {
						if (value !== '') {
							if (isIllegalFileName(value)) {
								new Notice(
									`File name cannot contain any of the following characters: ${ILLEGAL_FILENAME_CHARACTERS.join('')}`
								);
							} else {
								this.plugin.settings.dateBasedAllDayFileNameFormat = value;
								await this.plugin.saveSettings();
							}
						}
					})
			);

		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Import').onClick(() => {
				button.setDisabled(true);
				importJson(this.app.vault, this.plugin.settings)
					.then(async (res) => {
						new Notice(
							`Successful: ${res.successCount} - Failed: ${res.failures.length}`
						);

						res.failures.forEach((failure) => {
							new Notice(
								`Entry ${failure.entry.uuid} failed to import. ${failure.reason}`
							);
						});

						if (res.failures.length > 0) {
							await this.app.vault.create(
								`${this.plugin.settings.outDirectory}/Failed Imports.md`,
								res.failures
									.map(
										(failure) =>
											`- ${failure.entry.uuid} - ${moment(failure.entry.creationDate).format('YYYY-MM-DD HH:mm:ss')}\n  - ${failure.reason}`
									)
									.join('\n')
							);
						}
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

function isIllegalFileName(fileName: string): boolean {
	return ILLEGAL_FILENAME_CHARACTERS.some((illegal) =>
		fileName.contains(illegal)
	);
}

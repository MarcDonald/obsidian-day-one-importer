import {
	App,
	moment,
	normalizePath,
	Notice,
	PluginSettingTab,
	Setting,
} from 'obsidian';
import DayOneImporter from './main';
import { importJson } from './import-json';
import { updateFrontMatter } from './update-front-matter';

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
			.setName('Day One files')
			.setDesc('Location where you extracted the zip file from Day One')
			.addText((text) =>
				text
					.setPlaceholder('Directory')
					.setValue(this.plugin.settings.inDirectory)
					.onChange(async (value) => {
						this.plugin.settings.inDirectory = normalizePath(value);
						await this.plugin.saveSettings();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder('Journal JSON file')
					.setValue(this.plugin.settings.inFileName)
					.onChange(async (value) => {
						this.plugin.settings.inFileName = normalizePath(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Out directory')
			.setDesc('Directory to create imported files in')
			.addText((text) =>
				text
					.setPlaceholder('day-one-out')
					.setValue(this.plugin.settings.outDirectory)
					.onChange(async (value) => {
						this.plugin.settings.outDirectory = normalizePath(value);
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName('Ignore existing files')
			.setDesc(
				'If disabled then conflicting file names will be logged as failures, otherwise they will be ignored'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.ignoreExistingFiles)
					.onChange(async (value) => {
						this.plugin.settings.ignoreExistingFiles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName('File name').setHeading();

		new Setting(containerEl)
			.setName('Date-based file names (may cause collisions)')
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
			.setName('Date-based file name format')
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
								this.plugin.settings.dateBasedFileNameFormat =
									normalizePath(value);
								await this.plugin.saveSettings();
							}
						}
					})
			);

		new Setting(containerEl)
			.setName('Date-based file name format (all day entries)')
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
								this.plugin.settings.dateBasedAllDayFileNameFormat =
									normalizePath(value);
								await this.plugin.saveSettings();
							}
						}
					})
			);

		new Setting(containerEl).setName('FrontMatter').setHeading();

		new Setting(containerEl)
			.setName('Separate co-ordinate fields')
			.setDesc(
				'If enabled then latitude and longitude will be stored in separate fields in the frontmatter, otherwise they will be combined into a single field.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.separateCoordinateFields)
					.onChange(async (value) => {
						this.plugin.settings.separateCoordinateFields = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName('Import').setHeading();

		new Setting(containerEl)
			.addProgressBar((pb) => {
				pb.setValue(0);
				this.plugin.percentageUpdateRef = this.plugin.importEvents.on(
					'percentage-update',
					(newPercentage: number) => {
						pb.setValue(newPercentage);
					}
				);
			})
			.addButton((button) =>
				button.setButtonText('Import').onClick(async () => {
					try {
						button.setDisabled(true);
						const res = await importJson(
							this.app.vault,
							this.plugin.settings,
							this.app.fileManager,
							this.plugin.importEvents
						);
						new Notice(
							`Successful: ${res.successCount}\nFailed: ${res.failures.length}\nInvalid: ${res.invalidEntries.length}\nIgnored: ${res.ignoreCount}`
						);

						res.failures.forEach((failure) => {
							new Notice(
								`Entry ${failure.entry.uuid} failed to import. ${failure.reason}`
							);
						});

						let errorFileContent: string = '';

						if (res.invalidEntries.length > 0) {
							errorFileContent += res.invalidEntries
								.map(
									(invalidEntry) =>
										`- ${invalidEntry.entryId} - ${moment(invalidEntry.creationDate).format('YYYY-MM-DD HH:mm:ss')}\n  - ${JSON.stringify(invalidEntry.reason)}`
								)
								.join('\n');
						}

						if (res.failures.length > 0) {
							errorFileContent += res.failures
								.map(
									(failure) =>
										`- ${failure.entry.uuid} - ${moment(failure.entry.creationDate).format('YYYY-MM-DD HH:mm:ss')}\n  - ${failure.reason}`
								)
								.join('\n');
						}

						await this.app.vault.create(
							`${this.plugin.settings.outDirectory}/Failed Imports ${moment().toDate().getTime()}.md`,
							errorFileContent
						);
					} catch (err) {
						new Notice(err);
					} finally {
						button.setDisabled(false);
					}
				})
			);

		new Setting(containerEl).setName('Update FrontMatter').setHeading();

		new Setting(containerEl)
			.setName(
				'IMPORTANT: This is a destructive operation and will overwrite any existing FrontMatter in previously imported entries.'
			)
			.setDesc(
				'You must use the same file name settings as you did when doing the initial import.'
			);

		new Setting(containerEl)
			.addProgressBar((pb) => {
				pb.setValue(0);
				this.plugin.percentageUpdateRef = this.plugin.importEvents.on(
					'percentage-update',
					(newPercentage: number) => {
						pb.setValue(newPercentage);
					}
				);
			})
			.addButton((button) =>
				button.setButtonText('Update Frontmatter').onClick(async () => {
					try {
						button.setDisabled(true);
						const res = await updateFrontMatter(
							this.app.vault,
							this.plugin.settings,
							this.app.fileManager,
							this.plugin.importEvents
						);
						new Notice(
							`Successful: ${res.successCount} - Failed: ${res.failures.length} - Ignored: ${res.ignoreCount}`
						);

						res.failures.forEach((failure) => {
							new Notice(
								`Entry ${failure.entry.uuid} failed to update. ${failure.reason}`
							);
						});

						if (res.failures.length > 0) {
							await this.app.vault.create(
								`${this.plugin.settings.outDirectory}/Failed Updates ${moment().toDate().getTime()}.md`,
								res.failures
									.map(
										(failure) =>
											`- ${failure.entry.uuid} - ${moment(failure.entry.creationDate).format('YYYY-MM-DD HH:mm:ss')}\n  - ${failure.reason}`
									)
									.join('\n')
							);
						}
					} catch (err) {
						new Notice(err);
					} finally {
						button.setDisabled(false);
					}
				})
			);
	}
}

function isIllegalFileName(fileName: string): boolean {
	return ILLEGAL_FILENAME_CHARACTERS.some((illegal) =>
		fileName.contains(illegal)
	);
}

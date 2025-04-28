import {
	App,
	normalizePath,
	Notice,
	PluginSettingTab,
	Setting,
	ButtonComponent,
} from 'obsidian';
import DayOneImporter from './main';
import { TagStyle } from './main';
import { importJson } from './import-json';
import { updateFrontMatter } from './update-front-matter';
import { isIllegalFileName, ILLEGAL_FILENAME_CHARACTERS } from './utils';

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
			.setName('Day One import folder')
			.setDesc(
				`Folder where Day One JSON exports are located.
				All JSON files in this folder will be imported unless a specific file is set below.`
			)
			.addSearch((cb) => {
				cb.setPlaceholder('Example: folder1/folder2')
					.setValue(this.plugin.settings.inDirectory)
					.onChange(async (importFolder) => {
						importFolder = importFolder.trim();
						importFolder = importFolder.replace(/\/$/, '');
						this.plugin.settings.inDirectory = importFolder;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Import only this file (optional)')
			.setDesc(
				'If set, only this JSON file in the folder above will be imported.'
			)
			.addText((text) =>
				text
					.setPlaceholder('journal.json')
					.setValue(this.plugin.settings.inFileName || '')
					.onChange(async (value) => {
						this.plugin.settings.inFileName = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Out directory')
			.setDesc('Directory to create imported files in.')
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
				'If disabled then conflicting file names will be logged as failures, otherwise they will be ignored.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.ignoreExistingFiles)
					.onChange(async (value) => {
						this.plugin.settings.ignoreExistingFiles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Tag style')
			.setDesc(
				`Obsidian doesn't support tags with spaces. 
				You can choose the tag style for tags in frontmatter. 
				If you leave them as-is, you might end up with multi-word tags split into separate tags.`
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('', 'Leave as-is')
					.addOption('camelCase', 'camelCase')
					.addOption('PascalCase', 'PascalCase')
					.addOption('snake_case', 'snake_case')
					.addOption('kebab-case', 'kebab-case')
					.setValue(this.plugin.settings.tagStyle ?? '')
					.onChange(async (value) => {
						this.plugin.settings.tagStyle =
							value === '' ? undefined : (value as TagStyle);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Internal links')
			.setDesc(
				'Enable/disable replacing Day One internal links (dayone://view?entryId=UUID) with Obsidian links.'
			)
			.setHeading();

		new Setting(containerEl)
			.setName('Enable internal links resolving')
			.setDesc(
				'When possible, Day One internal links will resolve across multiple imported journals.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInternalLinks)
					.onChange(async (value) => {
						this.plugin.settings.enableInternalLinks = value;
						await this.plugin.saveSettings();
						if (resolveInternalLinksButton) {
							resolveInternalLinksButton.setDisabled(!value);
						}
					})
			);

		// A button component to resolve links
		let resolveInternalLinksButton: ButtonComponent;

		new Setting(containerEl)
			.setName('Resolve internal links in imported notes')
			.setDesc(
				'Scan all imported notes in the output folder and update internal links using the current UUID map. Only works if internal link resolving is enabled. Only notes currently in the output directory will be affected.'
			)
			.addButton((btn) => {
				resolveInternalLinksButton = btn;
				btn
					.setButtonText('Resolve links')
					.setDisabled(!this.plugin.settings.enableInternalLinks)
					.onClick(async () => {
						btn.setDisabled(true);
						await this.plugin.resolveInternalLinksInNotes();
						btn.setDisabled(false);
					});
			});

		new Setting(containerEl).setName('File name').setHeading();

		new Setting(containerEl)
			.setName('Date-based file names (may cause collisions)')
			.setDesc(
				`Use entry's creation date as the file name. This may cause collisions and files to be overwritten if two entries have the same creation date/time.
				If this option is disabled then the entry's UUID will be used as the file name. This guarantees no collisions.`
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

		new Setting(containerEl).setName('Frontmatter').setHeading();

		new Setting(containerEl)
			.setName('Separate coordinate fields')
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
			.setName('Start the import process')
			.addProgressBar((pb) => {
				pb.setValue(0);
				this.plugin.percentageImportRef = this.plugin.importEvents.on(
					'percentage-import',
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
							this.plugin.importEvents,
							this.plugin.uuidMapStore
						);
						await this.plugin.handleImportResult(res, 'import');
					} catch (err) {
						new Notice(err);
					} finally {
						button.setDisabled(false);
					}
				})
			);

		new Setting(containerEl).setName('Update Frontmatter').setHeading();

		new Setting(containerEl)
			.setName('Start the frontmatter update process')
			.setDesc(
				`IMPORTANT: This is a destructive operation and will overwrite any existing Frontmatter in previously imported entries.
				You must use the same file name settings as you did when doing the initial import.`
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
						await this.plugin.handleImportResult(res, 'update');
					} catch (err) {
						new Notice(err);
					} finally {
						button.setDisabled(false);
					}
				})
			);
	}
}

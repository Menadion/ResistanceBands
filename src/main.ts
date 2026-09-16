import {
	Notice,
	Plugin,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	ResBandSettings,
	ResBandSettingTab,
} from './settings';

export default class ResBandPlugin extends Plugin {
	settings!: ResBandSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('dice', 'Sample', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new Notice('A notice for the addCommand!');
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ResBandSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ResBandSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
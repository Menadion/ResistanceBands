import {
	Plugin,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	ResBandSettings,
	ResBandSettingTab,
} from './settings';

import {
	ResBandView,
	VIEW_TYPE_RESBAND,
} from './view'

export default class ResBandPlugin extends Plugin {
	settings!: ResBandSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_RESBAND, (leaf) => new ResBandView(leaf))

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('waypoints', 'Start resistance band', (_evt: MouseEvent) => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-rb-graph',
			name: 'Open rb graph',
			callback: () => {
				void this.activateView();
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

	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_RESBAND)
		let leaf = leaves[0]

		if (!leaf) {
			leaf = this.app.workspace.getLeaf(true)
			await leaf.setViewState({ type: VIEW_TYPE_RESBAND, active: true })
		}
		
		await this.app.workspace.revealLeaf(leaf)
	}
}
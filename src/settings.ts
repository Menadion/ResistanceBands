import { App, PluginSettingTab, Setting } from 'obsidian';
import ResBandPlugin from './main';

export interface ResBandSettings {
	ResBandSetting: string;
}

export const DEFAULT_SETTINGS: ResBandSettings = {
	ResBandSetting: 'default',
};

export class ResBandSettingTab extends PluginSettingTab {
	plugin: ResBandPlugin;

	constructor(app: App, plugin: ResBandPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.ResBandSetting)
					.onChange(async (value) => {
						this.plugin.settings.ResBandSetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

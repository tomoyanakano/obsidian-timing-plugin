import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface TimingPluginSettings {
	enableTimeTracking: boolean;
	timingAppPath: string;
}

const DEFAULT_SETTINGS: TimingPluginSettings = {
	enableTimeTracking: true,
	timingAppPath: '/Applications/Timing.app'
}

export default class TimingPlugin extends Plugin {
	settings: TimingPluginSettings;

	async onload() {
		await this.loadSettings();

		console.log('Timing Plugin loaded');

		this.addSettingTab(new TimingSettingTab(this.app, this));
	}

	onunload() {
		console.log('Timing Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TimingSettingTab extends PluginSettingTab {
	plugin: TimingPlugin;

	constructor(app: App, plugin: TimingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Timing Plugin Settings'});

		new Setting(containerEl)
			.setName('Enable Time Tracking')
			.setDesc('Enable automatic time tracking with Timing app')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableTimeTracking)
				.onChange(async (value) => {
					this.plugin.settings.enableTimeTracking = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Timing App Path')
			.setDesc('Path to the Timing application')
			.addText(text => text
				.setPlaceholder('/Applications/Timing.app')
				.setValue(this.plugin.settings.timingAppPath)
				.onChange(async (value) => {
					this.plugin.settings.timingAppPath = value;
					await this.plugin.saveSettings();
				}));
	}
}

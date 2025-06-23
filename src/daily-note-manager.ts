import { App, TFile, TFolder, moment } from 'obsidian';
import { TimingSectionInfo, DailyNoteTemplate, TimingPluginSettings } from './types';

interface DateFormat {
	pattern: RegExp;
	formatString: string;
	parser: (filename: string) => Date | null;
	formatter: (date: Date) => string;
}

export class DailyNoteManager {
	private app: App;
	private settings: TimingPluginSettings;
	private supportedFormats: DateFormat[];

	constructor(app: App, settings: TimingPluginSettings) {
		this.app = app;
		this.settings = settings;
		this.setupSupportedFormats();
	}

	private setupSupportedFormats(): void {
		this.supportedFormats = [
			{
				pattern: /^(\d{4})-(\d{2})-(\d{2})$/,
				formatString: 'YYYY-MM-DD',
				parser: (filename) => {
					const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
					if (match) {
						const [, year, month, day] = match;
						return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
					}
					return null;
				},
				formatter: (date) => {
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					return `${year}-${month}-${day}`;
				}
			},
			{
				pattern: /^(\d{4})\/(\d{2})\/(\d{2})$/,
				formatString: 'YYYY/MM/DD',
				parser: (filename) => {
					const match = filename.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
					if (match) {
						const [, year, month, day] = match;
						return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
					}
					return null;
				},
				formatter: (date) => {
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					return `${year}/${month}/${day}`;
				}
			},
			{
				pattern: /^(\d{2})-(\d{2})-(\d{4})$/,
				formatString: 'DD-MM-YYYY',
				parser: (filename) => {
					const match = filename.match(/^(\d{2})-(\d{2})-(\d{4})/);
					if (match) {
						const [, day, month, year] = match;
						return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
					}
					return null;
				},
				formatter: (date) => {
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					return `${day}-${month}-${year}`;
				}
			}
		];
	}

	async findDailyNote(date: Date): Promise<TFile | null> {
		console.log('Looking for Daily Note for date:', date);

		// 1. Check Daily Notes plugin settings first
		const dailyNotesSettings = this.getDailyNotesPluginSettings();
		if (dailyNotesSettings?.folder && dailyNotesSettings?.format) {
			const expectedPath = this.buildDailyNotePath(date, dailyNotesSettings);
			console.log('Checking Daily Notes plugin path:', expectedPath);
			const file = this.app.vault.getAbstractFileByPath(expectedPath);
			if (file instanceof TFile) {
				console.log('Found Daily Note via plugin settings:', file.path);
				return file;
			}
		}

		// 2. Search using current plugin settings
		const pluginPath = this.buildDailyNotePathFromSettings(date);
		console.log('Checking plugin settings path:', pluginPath);
		const pluginFile = this.app.vault.getAbstractFileByPath(pluginPath);
		if (pluginFile instanceof TFile) {
			console.log('Found Daily Note via plugin settings:', pluginFile.path);
			return pluginFile;
		}

		// 3. Search common locations with different formats
		const searchPaths = this.generateSearchPaths(date);
		console.log('Searching common paths:', searchPaths);
		
		for (const path of searchPaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				console.log('Found Daily Note in common location:', file.path);
				return file;
			}
		}

		// 4. Fuzzy search by scanning all files
		console.log('Performing fuzzy search...');
		return await this.fuzzySearchDailyNote(date);
	}

	private getDailyNotesPluginSettings(): { folder: string; format: string } | null {
		try {
			// Check if Daily Notes core plugin is enabled
			const dailyNotesPlugin = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
			if (dailyNotesPlugin && dailyNotesPlugin.enabled && dailyNotesPlugin.instance?.options) {
				const options = dailyNotesPlugin.instance.options;
				return {
					folder: options.folder || '',
					format: options.format || 'YYYY-MM-DD'
				};
			}
		} catch (error) {
			console.warn('Failed to get Daily Notes plugin settings:', error);
		}
		return null;
	}

	private buildDailyNotePath(date: Date, settings: { folder: string; format: string }): string {
		const dateStr = this.formatDate(date, settings.format);
		return settings.folder ? this.buildNestedPath(settings.folder, date, dateStr) : `${dateStr}.md`;
	}

	private buildDailyNotePathFromSettings(date: Date): string {
		const format = this.getFormatForSettings();
		const dateStr = format.formatter(date);
		return this.settings.folder ? this.buildNestedPath(this.settings.folder, date, dateStr) : `${dateStr}.md`;
	}

	private getFormatForSettings(): DateFormat {
		const formatStr = this.settings.dateFormat;
		return this.supportedFormats.find(f => f.formatString === formatStr) || this.supportedFormats[0];
	}

	private buildNestedPath(folderTemplate: string, date: Date, dateStr: string): string {
		// Support date placeholders in folder paths
		// Example: "life/daily/{YYYY}/{MM}" -> "life/daily/2025/06"
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		
		let processedFolder = folderTemplate
			.replace(/{YYYY}/g, year.toString())
			.replace(/{MM}/g, month)
			.replace(/{DD}/g, day)
			.replace(/{YYYY-MM-DD}/g, `${year}-${month}-${day}`)
			.replace(/{YYYY\/MM\/DD}/g, `${year}/${month}/${day}`)
			.replace(/{DD-MM-YYYY}/g, `${day}-${month}-${year}`);
		
		// Ensure no trailing slash
		processedFolder = processedFolder.replace(/\/$/, '');
		
		return `${processedFolder}/${dateStr}.md`;
	}

	private generateSearchPaths(date: Date): string[] {
		const paths: string[] = [];
		const commonFolders = ['', 'Daily', 'Notes', 'Journal', 'daily', 'notes'];
		
		// Generate paths for each supported format
		for (const format of this.supportedFormats) {
			const dateStr = format.formatter(date);
			
			for (const folder of commonFolders) {
				const path = folder ? this.buildNestedPath(folder, date, dateStr) : `${dateStr}.md`;
				paths.push(path);
			}
		}
		
		return paths;
	}

	private async fuzzySearchDailyNote(date: Date): Promise<TFile | null> {
		const targetDate = this.normalizeDate(date);
		
		const allFiles = this.app.vault.getMarkdownFiles();
		
		for (const file of allFiles) {
			const filename = file.basename;
			
			// Try each format to see if this file matches the target date
			for (const format of this.supportedFormats) {
				const parsedDate = format.parser(filename);
				if (parsedDate && this.normalizeDate(parsedDate).getTime() === targetDate.getTime()) {
					console.log(`Found Daily Note via fuzzy search: ${file.path} (format: ${format.formatString})`);
					return file;
				}
			}
		}
		
		return null;
	}

	private normalizeDate(date: Date): Date {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	private formatDate(date: Date, format: string): string {
		// Simple format conversion - in a real implementation, you might use moment.js or similar
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		
		switch (format) {
			case 'YYYY-MM-DD':
				return `${year}-${month}-${day}`;
			case 'YYYY/MM/DD':
				return `${year}/${month}/${day}`;
			case 'DD-MM-YYYY':
				return `${day}-${month}-${year}`;
			default:
				return `${year}-${month}-${day}`;
		}
	}

	async createDailyNote(date: Date): Promise<TFile> {
		if (!this.settings.autoCreateDailyNotes) {
			throw new Error('Auto-creation of Daily Notes is disabled');
		}

		console.log('Creating new Daily Note for date:', date);

		const template = await this.generateTemplate(date);
		const filePath = this.buildDailyNotePathFromSettings(date);
		
		// Ensure parent directory exists
		await this.ensureDirectoryExists(this.getDirectoryPath(filePath));
		
		console.log('Creating Daily Note at path:', filePath);
		const file = await this.app.vault.create(filePath, template.content);
		
		console.log('Successfully created Daily Note:', file.path);
		return file;
	}

	private async generateTemplate(date: Date): Promise<DailyNoteTemplate> {
		const dateStr = this.getFormatForSettings().formatter(date);
		
		// Check for existing template from Daily Notes plugin
		const existingTemplate = await this.getExistingTemplate();
		if (existingTemplate) {
			return this.injectTimingSection(existingTemplate, dateStr);
		}
		
		// Generate default template
		return {
			title: dateStr,
			content: this.generateDefaultTemplate(dateStr),
			timingSectionLocation: this.settings.timingSectionLocation
		};
	}

	private async getExistingTemplate(): Promise<string | null> {
		try {
			const dailyNotesSettings = this.getDailyNotesPluginSettings();
			if (dailyNotesSettings) {
				// Try to find template file
				// This is simplified - in reality you'd need to check the Daily Notes plugin's template settings
				return null;
			}
		} catch (error) {
			console.warn('Failed to get existing template:', error);
		}
		return null;
	}

	private injectTimingSection(template: string, dateStr: string): DailyNoteTemplate {
		const timingSection = '\n\n## Timing Tracking\n<!-- Timing data will be automatically updated here -->\n\n';
		
		switch (this.settings.timingSectionLocation) {
			case 'top':
				return {
					title: dateStr,
					content: `# ${dateStr}${timingSection}${template}`,
					timingSectionLocation: 'top'
				};
			case 'bottom':
				return {
					title: dateStr,
					content: `${template}${timingSection}`,
					timingSectionLocation: 'bottom'
				};
			default:
				return {
					title: dateStr,
					content: `${template}${timingSection}`,
					timingSectionLocation: 'bottom'
				};
		}
	}

	private generateDefaultTemplate(dateStr: string): string {
		const timingSection = this.settings.timingSectionLocation === 'top' 
			? '## Timing Tracking\n<!-- Timing data will be automatically updated here -->\n\n'
			: '';
		
		const mainContent = `# ${dateStr}

${timingSection}## Daily Overview

## Tasks

`;

		const bottomTimingSection = this.settings.timingSectionLocation === 'bottom'
			? '## Timing Tracking\n<!-- Timing data will be automatically updated here -->\n\n'
			: '';

		const reflection = this.settings.includeReflection
			? '## Reflection\n\n'
			: '';

		return mainContent + bottomTimingSection + reflection;
	}

	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (!dirPath) return;
		
		try {
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir) {
				// Create nested directories recursively
				const pathParts = dirPath.split('/').filter(part => part.length > 0);
				let currentPath = '';
				
				for (const part of pathParts) {
					currentPath = currentPath ? `${currentPath}/${part}` : part;
					const existingDir = this.app.vault.getAbstractFileByPath(currentPath);
					
					if (!existingDir) {
						await this.app.vault.createFolder(currentPath);
						console.log('Created directory:', currentPath);
					}
				}
			}
		} catch (error) {
			console.warn('Failed to create directory:', dirPath, error);
		}
	}

	private getDirectoryPath(filePath: string): string {
		const lastSlash = filePath.lastIndexOf('/');
		return lastSlash >= 0 ? filePath.substring(0, lastSlash) : '';
	}

	updateSettings(settings: TimingPluginSettings): void {
		this.settings = settings;
		this.setupSupportedFormats(); // Refresh format handlers
	}
}
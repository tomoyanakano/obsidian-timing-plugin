import { App, TFile } from 'obsidian';
import { TimingSectionInfo, DailyTimeData, TimingPluginSettings } from './types';
import { DataTransformer } from './data-transformer';

export class TimingSectionManager {
	private app: App;
	private settings: TimingPluginSettings;
	private dataTransformer: DataTransformer;

	constructor(app: App, settings: TimingPluginSettings) {
		this.app = app;
		this.settings = settings;
		this.dataTransformer = new DataTransformer();
	}

	async updateTimingSection(file: TFile, timingData: DailyTimeData): Promise<void> {
		console.log('Updating timing section in file:', file.path);
		
		const content = await this.app.vault.read(file);
		const sectionInfo = this.findTimingSection(content);
		
		if (sectionInfo.exists) {
			console.log('Replacing existing timing section');
			await this.replaceExistingSection(file, sectionInfo, timingData);
		} else {
			console.log('Inserting new timing section');
			await this.insertNewSection(file, timingData);
		}
	}

	findTimingSection(content: string): TimingSectionInfo {
		const lines = content.split('\n');
		const timingHeaderRegex = /^#{1,6}\s*timing\s*tracking/i;
		
		let startLine = -1;
		let headerLevel = 0;
		
		// Find timing section header
		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].match(timingHeaderRegex);
			if (match) {
				startLine = i;
				const headerMatch = lines[i].match(/^#+/);
				headerLevel = headerMatch ? headerMatch[0].length : 2;
				break;
			}
		}
		
		if (startLine === -1) {
			return { 
				exists: false, 
				startLine: -1, 
				endLine: -1, 
				content: '', 
				headerLevel: 0 
			};
		}
		
		// Find section end
		let endLine = lines.length;
		for (let i = startLine + 1; i < lines.length; i++) {
			const lineHeaderMatch = lines[i].match(/^#+/);
			if (lineHeaderMatch && lineHeaderMatch[0].length <= headerLevel) {
				endLine = i;
				break;
			}
		}
		
		return {
			exists: true,
			startLine,
			endLine,
			content: lines.slice(startLine, endLine).join('\n'),
			headerLevel
		};
	}

	private async replaceExistingSection(
		file: TFile, 
		sectionInfo: TimingSectionInfo, 
		timingData: DailyTimeData
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');
		
		// Preserve user's reflection content if it exists
		const reflectionContent = this.extractReflectionContent(sectionInfo.content);
		
		// Generate new timing content
		const newTimingContent = this.generateTimingContent(timingData, reflectionContent, sectionInfo.headerLevel);
		
		// Replace section content
		const newLines = [
			...lines.slice(0, sectionInfo.startLine),
			...newTimingContent.split('\n'),
			...lines.slice(sectionInfo.endLine)
		];
		
		await this.app.vault.modify(file, newLines.join('\n'));
		console.log('Successfully replaced timing section');
	}

	private async insertNewSection(file: TFile, timingData: DailyTimeData): Promise<void> {
		const content = await this.app.vault.read(file);
		const insertionPoint = this.findInsertionPoint(content);
		
		const timingContent = this.generateTimingContent(timingData, null, 2);
		const newContent = this.insertAtPosition(content, insertionPoint, timingContent);
		
		await this.app.vault.modify(file, newContent);
		console.log('Successfully inserted new timing section');
	}

	private extractReflectionContent(sectionContent: string): string | null {
		const lines = sectionContent.split('\n');
		let reflectionStart = -1;
		
		// Look for reflection subsection
		for (let i = 0; i < lines.length; i++) {
			if (/^#{2,6}\s*reflection/i.test(lines[i])) {
				reflectionStart = i;
				break;
			}
		}
		
		if (reflectionStart === -1) {
			return null;
		}
		
		// Find end of reflection section
		let reflectionEnd = lines.length;
		const reflectionHeaderLevel = (lines[reflectionStart].match(/^#+/) || ['##'])[0].length;
		
		for (let i = reflectionStart + 1; i < lines.length; i++) {
			const headerMatch = lines[i].match(/^#+/);
			if (headerMatch && headerMatch[0].length <= reflectionHeaderLevel) {
				reflectionEnd = i;
				break;
			}
		}
		
		const reflectionLines = lines.slice(reflectionStart + 1, reflectionEnd);
		const reflectionText = reflectionLines.join('\n').trim();
		
		return reflectionText || null;
	}

	private generateTimingContent(
		timingData: DailyTimeData, 
		existingReflection: string | null,
		headerLevel: number = 2
	): string {
		const h = '#'.repeat(headerLevel);
		const h2 = '#'.repeat(headerLevel + 1);
		
		let content = `${h} Timing Tracking\n\n`;
		
		// Summary section
		content += this.generateSummarySection(timingData, h2);
		
		// Application breakdown
		if (this.settings.groupBy === 'application' || this.settings.groupBy === 'both') {
			content += this.generateApplicationSection(timingData, h2);
		}
		
		// Category breakdown
		if (this.settings.groupBy === 'category' || this.settings.groupBy === 'both') {
			content += this.generateCategorySection(timingData, h2);
		}
		
		// Timeline
		if (this.settings.includeTimeline) {
			content += this.generateTimelineSection(timingData, h2);
		}
		
		// Reflection section
		if (this.settings.includeReflection) {
			content += this.generateReflectionSection(existingReflection, h2);
		}
		
		return content;
	}

	private generateSummarySection(timingData: DailyTimeData, h2: string): string {
		const totalTime = this.dataTransformer.formatDuration(timingData.summary.totalTime);
		const mostUsedApp = this.dataTransformer.getMostUsedApplication(timingData.summary);
		const mostProductiveHour = this.dataTransformer.getMostProductiveHour(timingData.summary);
		
		let content = `${h2} Summary\n\n`;
		content += `- **Total tracked time**: ${totalTime}\n`;
		
		if (mostUsedApp) {
			const appTime = this.dataTransformer.formatDuration(mostUsedApp.time);
			content += `- **Most used app**: ${mostUsedApp.name} (${appTime})\n`;
		}
		
		if (mostProductiveHour) {
			const hourTime = this.dataTransformer.formatDuration(mostProductiveHour.time);
			const hourStr = this.dataTransformer.formatTime(`${mostProductiveHour.hour.toString().padStart(2, '0')}:00:00`, this.settings.timeFormat);
			content += `- **Most productive hour**: ${hourStr} (${hourTime})\n`;
		}
		
		content += '\n';
		return content;
	}

	private generateApplicationSection(timingData: DailyTimeData, h2: string): string {
		let content = `${h2} By Application\n\n`;
		
		if (timingData.summary.byApplication.size === 0) {
			content += '*No application data available*\n\n';
			return content;
		}
		
		content += '| Application | Time | Percentage |\n';
		content += '|-------------|------|------------|\n';
		
		// Sort applications by time spent
		const sortedApps = Array.from(timingData.summary.byApplication.entries())
			.sort((a, b) => b[1] - a[1]);
		
		for (const [app, time] of sortedApps) {
			if (time >= this.settings.minimumDuration) {
				const formattedTime = this.dataTransformer.formatDuration(time);
				const percentage = this.dataTransformer.calculatePercentage(time, timingData.summary.totalTime);
				content += `| ${app} | ${formattedTime} | ${percentage}% |\n`;
			}
		}
		
		content += '\n';
		return content;
	}

	private generateCategorySection(timingData: DailyTimeData, h2: string): string {
		let content = `${h2} By Category\n\n`;
		
		if (timingData.summary.byCategory.size === 0) {
			content += '*No category data available*\n\n';
			return content;
		}
		
		content += '| Category | Time | Percentage |\n';
		content += '|----------|------|------------|\n';
		
		// Sort categories by time spent
		const sortedCategories = Array.from(timingData.summary.byCategory.entries())
			.sort((a, b) => b[1] - a[1]);
		
		for (const [category, time] of sortedCategories) {
			if (time >= this.settings.minimumDuration) {
				const formattedTime = this.dataTransformer.formatDuration(time);
				const percentage = this.dataTransformer.calculatePercentage(time, timingData.summary.totalTime);
				content += `| ${category} | ${formattedTime} | ${percentage}% |\n`;
			}
		}
		
		content += '\n';
		return content;
	}

	private generateTimelineSection(timingData: DailyTimeData, h2: string): string {
		let content = `${h2} Timeline\n\n`;
		
		if (timingData.entries.length === 0) {
			content += '*No timeline data available*\n\n';
			return content;
		}
		
		// Filter entries by minimum duration and sort by start time
		const filteredEntries = this.dataTransformer.filterEntriesByMinimumDuration(
			timingData.entries, 
			this.settings.minimumDuration
		);
		
		if (filteredEntries.length === 0) {
			content += '*No activities meet the minimum duration threshold*\n\n';
			return content;
		}
		
		for (const entry of filteredEntries) {
			const startTime = this.dataTransformer.formatTime(entry.startTime, this.settings.timeFormat);
			const endTime = this.dataTransformer.formatTime(entry.endTime, this.settings.timeFormat);
			const duration = this.dataTransformer.formatDuration(entry.duration);
			
			let timelineEntry = `- **${startTime} - ${endTime}** (${duration}): ${entry.application}`;
			
			if (entry.category) {
				timelineEntry += ` (${entry.category})`;
			}
			
			if (entry.title) {
				timelineEntry += ` - ${entry.title}`;
			}
			
			content += timelineEntry + '\n';
		}
		
		content += '\n';
		return content;
	}

	private generateReflectionSection(existingReflection: string | null, h2: string): string {
		let content = `${h2} Reflection\n\n`;
		
		if (existingReflection) {
			content += existingReflection + '\n\n';
		} else {
			content += '<!-- Add your daily time usage reflection here -->\n\n';
		}
		
		return content;
	}

	private findInsertionPoint(content: string): number {
		switch (this.settings.timingSectionLocation) {
			case 'top':
				return this.findAfterTitle(content);
			case 'bottom':
				return content.length;
			case 'after-header':
				return this.findAfterSpecificHeader(content, this.settings.afterHeaderName || 'Tasks');
			default:
				return content.length;
		}
	}

	private findAfterTitle(content: string): number {
		const lines = content.split('\n');
		
		// Look for the first H1 header
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].startsWith('# ')) {
				// Insert after the title line
				return lines.slice(0, i + 1).join('\n').length + 1;
			}
		}
		
		// If no title found, insert at beginning
		return 0;
	}

	private findAfterSpecificHeader(content: string, headerName: string): number {
		const lines = content.split('\n');
		const headerRegex = new RegExp(`^#{1,6}\\s*${headerName}\\s*$`, 'i');
		
		for (let i = 0; i < lines.length; i++) {
			if (headerRegex.test(lines[i])) {
				// Find the end of this section
				const headerLevel = (lines[i].match(/^#+/) || ['##'])[0].length;
				
				for (let j = i + 1; j < lines.length; j++) {
					const nextHeaderMatch = lines[j].match(/^#+/);
					if (nextHeaderMatch && nextHeaderMatch[0].length <= headerLevel) {
						// Insert before the next header of same or higher level
						return lines.slice(0, j).join('\n').length + 1;
					}
				}
				
				// If no next header found, insert at end of section
				return lines.slice(0, i + 1).join('\n').length + 1;
			}
		}
		
		// If header not found, fall back to bottom
		return content.length;
	}

	private insertAtPosition(content: string, position: number, insertContent: string): string {
		const before = content.substring(0, position);
		const after = content.substring(position);
		
		// Ensure proper spacing
		const spacing = before.endsWith('\n\n') ? '' : (before.endsWith('\n') ? '\n' : '\n\n');
		const endSpacing = after.startsWith('\n') ? '' : '\n';
		
		return before + spacing + insertContent + endSpacing + after;
	}

	updateSettings(settings: TimingPluginSettings): void {
		this.settings = settings;
	}
}
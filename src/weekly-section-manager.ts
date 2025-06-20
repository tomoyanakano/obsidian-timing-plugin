import { App, TFile } from 'obsidian';
import { TimingPluginSettings, WeeklyTimeData, TimingSectionInfo } from './types';
import { DataTransformer } from './data-transformer';

export class WeeklySectionManager {
	private app: App;
	private settings: TimingPluginSettings;
	private dataTransformer: DataTransformer;

	constructor(app: App, settings: TimingPluginSettings) {
		this.app = app;
		this.settings = settings;
		this.dataTransformer = new DataTransformer();
	}

	/**
	 * Update timing section in Weekly Note
	 */
	async updateWeeklyTimingSection(file: TFile, weeklyData: WeeklyTimeData): Promise<void> {
		try {
			console.log('Updating Weekly Note timing section:', file.path);
			
			const content = await this.app.vault.read(file);
			const sectionInfo = this.findWeeklyTimingSection(content);
			
			const newContent = sectionInfo.exists 
				? this.replaceExistingWeeklySection(content, sectionInfo, weeklyData)
				: this.addNewWeeklySection(content, weeklyData);
			
			await this.app.vault.modify(file, newContent);
			console.log('Successfully updated Weekly Note timing section');
			
		} catch (error) {
			console.error('Failed to update Weekly Note timing section:', error);
			throw error;
		}
	}

	/**
	 * Find Weekly Timing section in content
	 */
	private findWeeklyTimingSection(content: string): TimingSectionInfo {
		const lines = content.split('\n');
		
		// Look for Weekly Timing headers
		const patterns = [
			/^##\s+Weekly\s+Timing\s+Summary/i,
			/^##\s+Timing\s+Summary/i,
			/^##\s+Weekly\s+Time\s+Tracking/i,
			/^##\s+Time\s+Summary/i
		];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			for (const pattern of patterns) {
				if (pattern.test(line)) {
					const endLine = this.findSectionEnd(lines, i);
					return {
						exists: true,
						startLine: i,
						endLine: endLine,
						content: lines.slice(i, endLine + 1).join('\n'),
						headerLevel: this.getHeaderLevel(line)
					};
				}
			}
		}

		return {
			exists: false,
			startLine: -1,
			endLine: -1,
			content: '',
			headerLevel: 2
		};
	}

	/**
	 * Find the end of a section
	 */
	private findSectionEnd(lines: string[], startLine: number): number {
		const headerLevel = this.getHeaderLevel(lines[startLine]);
		
		for (let i = startLine + 1; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith('#')) {
				const currentLevel = this.getHeaderLevel(line);
				if (currentLevel <= headerLevel) {
					return i - 1;
				}
			}
		}
		
		return lines.length - 1;
	}

	/**
	 * Get header level from line
	 */
	private getHeaderLevel(line: string): number {
		const match = line.match(/^(#+)/);
		return match ? match[1].length : 0;
	}

	/**
	 * Replace existing Weekly section
	 */
	private replaceExistingWeeklySection(content: string, sectionInfo: TimingSectionInfo, weeklyData: WeeklyTimeData): string {
		const lines = content.split('\n');
		const newSection = this.generateWeeklySectionContent(weeklyData, sectionInfo.headerLevel);
		
		// Replace the section
		lines.splice(sectionInfo.startLine, sectionInfo.endLine - sectionInfo.startLine + 1, ...newSection.split('\n'));
		
		return lines.join('\n');
	}

	/**
	 * Add new Weekly section
	 */
	private addNewWeeklySection(content: string, weeklyData: WeeklyTimeData): string {
		const newSection = this.generateWeeklySectionContent(weeklyData, 2);
		
		switch (this.settings.timingSectionLocation) {
			case 'top':
				return this.addSectionAtTop(content, newSection);
			case 'bottom':
				return this.addSectionAtBottom(content, newSection);
			case 'after-header':
				return this.addSectionAfterHeader(content, newSection);
			default:
				return this.addSectionAtBottom(content, newSection);
		}
	}

	/**
	 * Generate Weekly section content
	 */
	private generateWeeklySectionContent(weeklyData: WeeklyTimeData, headerLevel: number): string {
		const headerPrefix = '#'.repeat(headerLevel);
		const { summary } = weeklyData;
		
		let content = `${headerPrefix} Weekly Timing Summary\n\n`;
		
		// Overview
		content += '### Overview\n';
		content += `- **Week**: ${weeklyData.weekStart} — ${weeklyData.weekEnd}\n`;
		content += `- **Total Time**: ${this.dataTransformer.formatDuration(summary.totalTime)}\n`;
		content += `- **Average Daily**: ${this.dataTransformer.formatDuration(summary.averageDailyTime)}\n`;
		content += `- **Most Productive Day**: ${summary.mostProductiveDay}\n\n`;

		// Productivity Breakdown
		if (this.settings.includeWeeklySummary) {
			content += '### Productivity Breakdown\n';
			content += `- **Focus Time**: ${this.dataTransformer.formatDuration(summary.productivity.focusTime)} (${this.calculatePercentage(summary.productivity.focusTime, summary.totalTime)}%)\n`;
			content += `- **Meeting Time**: ${this.dataTransformer.formatDuration(summary.productivity.meetingTime)} (${this.calculatePercentage(summary.productivity.meetingTime, summary.totalTime)}%)\n`;
			content += `- **Break Time**: ${this.dataTransformer.formatDuration(summary.productivity.breakTime)} (${this.calculatePercentage(summary.productivity.breakTime, summary.totalTime)}%)\n\n`;
		}

		// Daily Breakdown
		content += '### Daily Breakdown\n';
		const sortedDays = Array.from(summary.byDay.entries())
			.sort((a, b) => b[1] - a[1]);
		
		for (const [day, time] of sortedDays) {
			if (time > 0) {
				content += `- **${day}**: ${this.dataTransformer.formatDuration(time)}\n`;
			}
		}
		content += '\n';

		// Top Applications
		content += '### Top Applications\n';
		const topApps = Array.from(summary.byApplication.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		
		for (const [app, time] of topApps) {
			const percentage = this.calculatePercentage(time, summary.totalTime);
			content += `- **${app}**: ${this.dataTransformer.formatDuration(time)} (${percentage}%)\n`;
		}
		content += '\n';

		// Categories
		if (summary.byCategory.size > 0) {
			content += '### Categories\n';
			const topCategories = Array.from(summary.byCategory.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8);
			
			for (const [category, time] of topCategories) {
				const percentage = this.calculatePercentage(time, summary.totalTime);
				content += `- **${category}**: ${this.dataTransformer.formatDuration(time)} (${percentage}%)\n`;
			}
			content += '\n';
		}

		// Weekly Timeline (if enabled)
		if (this.settings.includeTimeline) {
			content += '### Weekly Timeline\n';
			content += this.generateWeeklyTimeline(weeklyData);
			content += '\n';
		}

		return content;
	}

	/**
	 * Generate weekly timeline visualization
	 */
	private generateWeeklyTimeline(weeklyData: WeeklyTimeData): string {
		let timeline = '';
		const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		
		// Create timeline for each day
		const currentDate = new Date(weeklyData.weekStart);
		
		for (let i = 0; i < 7; i++) {
			const dateStr = this.formatDate(currentDate);
			const dayName = dayNames[currentDate.getDay()];
			const dailyData = weeklyData.dailyData.get(dateStr);
			
			if (dailyData && dailyData.summary.totalTime > 0) {
				timeline += `**${dayName}** (${dateStr}):\n`;
				
				// Top 3 activities for the day
				const topActivities = Array.from(dailyData.summary.byApplication.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, 3);
				
				for (const [app, time] of topActivities) {
					timeline += `  - ${app}: ${this.dataTransformer.formatDuration(time)}\n`;
				}
				timeline += '\n';
			} else {
				timeline += `**${dayName}** (${dateStr}): No tracking data\n\n`;
			}
			
			currentDate.setDate(currentDate.getDate() + 1);
		}
		
		return timeline;
	}

	/**
	 * Format date as YYYY-MM-DD
	 */
	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * Calculate percentage
	 */
	private calculatePercentage(part: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((part / total) * 100 * 10) / 10;
	}

	/**
	 * Add section at top of content
	 */
	private addSectionAtTop(content: string, newSection: string): string {
		const lines = content.split('\n');
		let insertIndex = 0;
		
		// Skip title if it exists
		if (lines[0] && lines[0].startsWith('# ')) {
			insertIndex = 1;
			// Skip empty lines after title
			while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
				insertIndex++;
			}
		}
		
		lines.splice(insertIndex, 0, newSection, '');
		return lines.join('\n');
	}

	/**
	 * Add section at bottom of content
	 */
	private addSectionAtBottom(content: string, newSection: string): string {
		return content.trim() + '\n\n' + newSection;
	}

	/**
	 * Add section after specific header
	 */
	private addSectionAfterHeader(content: string, newSection: string): string {
		if (!this.settings.afterHeaderName) {
			return this.addSectionAtBottom(content, newSection);
		}
		
		const lines = content.split('\n');
		const headerPattern = new RegExp(`^#+\\s+${this.settings.afterHeaderName}`, 'i');
		
		for (let i = 0; i < lines.length; i++) {
			if (headerPattern.test(lines[i])) {
				lines.splice(i + 1, 0, '', newSection, '');
				return lines.join('\n');
			}
		}
		
		// If header not found, add at bottom
		return this.addSectionAtBottom(content, newSection);
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: TimingPluginSettings): void {
		this.settings = settings;
	}
}
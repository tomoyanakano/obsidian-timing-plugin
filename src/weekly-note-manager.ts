import { App, TFile, moment } from 'obsidian';
import { TimingPluginSettings, WeeklyTimeData, WeeklySummary, DailyTimeData, WeeklyNoteTemplate } from './types';

interface WeekInfo {
	weekStart: Date;
	weekEnd: Date;
	weekNumber: number;
	year: number;
	weekStartString: string;
	weekEndString: string;
}

export class WeeklyNoteManager {
	private app: App;
	private settings: TimingPluginSettings;

	constructor(app: App, settings: TimingPluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Get week information for a given date
	 */
	getWeekInfo(date: Date): WeekInfo {
		const weekStart = this.getWeekStart(date);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 6);

		const weekNumber = this.getWeekNumber(weekStart);
		const year = weekStart.getFullYear();

		return {
			weekStart,
			weekEnd,
			weekNumber,
			year,
			weekStartString: this.formatDate(weekStart),
			weekEndString: this.formatDate(weekEnd)
		};
	}

	/**
	 * Get the start of the week for a given date
	 */
	private getWeekStart(date: Date): Date {
		const day = date.getDay();
		const diff = this.settings.weekStartsOn === 'monday' 
			? (day === 0 ? -6 : 1 - day) // Monday start
			: -day; // Sunday start
		
		const weekStart = new Date(date);
		weekStart.setDate(date.getDate() + diff);
		weekStart.setHours(0, 0, 0, 0);
		
		return weekStart;
	}

	/**
	 * Get week number for a date
	 */
	private getWeekNumber(date: Date): number {
		const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
		const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
		return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
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
	 * Generate Weekly Note filename
	 */
	private generateWeeklyNoteFilename(weekInfo: WeekInfo): string {
		switch (this.settings.weeklyDateFormat) {
			case 'YYYY-[W]WW':
				return `${weekInfo.year}-W${String(weekInfo.weekNumber).padStart(2, '0')}`;
			case 'YYYY-MM-DD':
				return `${weekInfo.weekStartString}`;
			case 'GGGG-[W]WW':
				// ISO week date format
				const isoWeek = this.getISOWeekNumber(weekInfo.weekStart);
				return `${weekInfo.year}-W${String(isoWeek).padStart(2, '0')}`;
			default:
				return `${weekInfo.year}-W${String(weekInfo.weekNumber).padStart(2, '0')}`;
		}
	}

	/**
	 * Get ISO week number
	 */
	private getISOWeekNumber(date: Date): number {
		const thursdayOfWeek = new Date(date);
		thursdayOfWeek.setDate(date.getDate() - date.getDay() + 4);
		const yearStart = new Date(thursdayOfWeek.getFullYear(), 0, 1);
		const weekNumber = Math.ceil(((thursdayOfWeek.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
		return weekNumber;
	}

	/**
	 * Find existing Weekly Note for a given date
	 */
	async findWeeklyNote(date: Date): Promise<TFile | null> {
		const weekInfo = this.getWeekInfo(date);
		const filename = this.generateWeeklyNoteFilename(weekInfo);
		
		// Search in configured folder
		const searchPaths = [
			this.settings.weeklyNotesFolder ? `${this.settings.weeklyNotesFolder}/${filename}.md` : `${filename}.md`,
			// Common weekly note locations
			`Weekly/${filename}.md`,
			`Week/${filename}.md`,
			`weekly/${filename}.md`,
			`week/${filename}.md`,
			`${filename}.md`
		];

		for (const path of searchPaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				console.log('Found Weekly Note:', file.path);
				return file;
			}
		}

		// Fuzzy search for Weekly Notes
		return await this.fuzzySearchWeeklyNote(weekInfo);
	}

	/**
	 * Fuzzy search for Weekly Notes
	 */
	private async fuzzySearchWeeklyNote(weekInfo: WeekInfo): Promise<TFile | null> {
		const allFiles = this.app.vault.getMarkdownFiles();
		const weekPatterns = [
			new RegExp(`${weekInfo.year}-W${String(weekInfo.weekNumber).padStart(2, '0')}`),
			new RegExp(`${weekInfo.year}_W${String(weekInfo.weekNumber).padStart(2, '0')}`),
			new RegExp(`Week_${weekInfo.weekNumber}_${weekInfo.year}`),
			new RegExp(`${weekInfo.weekStartString}.*${weekInfo.weekEndString}`),
			new RegExp(`${weekInfo.weekStartString}`)
		];

		for (const file of allFiles) {
			for (const pattern of weekPatterns) {
				if (pattern.test(file.basename)) {
					console.log(`Found Weekly Note via fuzzy search: ${file.path}`);
					return file;
				}
			}
		}

		return null;
	}

	/**
	 * Create a new Weekly Note
	 */
	async createWeeklyNote(date: Date): Promise<TFile> {
		if (!this.settings.autoCreateWeeklyNotes) {
			throw new Error('Auto-creation of Weekly Notes is disabled');
		}

		const weekInfo = this.getWeekInfo(date);
		const template = await this.generateWeeklyTemplate(weekInfo);
		const filename = this.generateWeeklyNoteFilename(weekInfo);
		const filePath = this.settings.weeklyNotesFolder ? 
			`${this.settings.weeklyNotesFolder}/${filename}.md` : 
			`${filename}.md`;

		// Ensure parent directory exists
		await this.ensureDirectoryExists(this.getDirectoryPath(filePath));

		console.log('Creating Weekly Note at path:', filePath);
		const file = await this.app.vault.create(filePath, template.content);

		console.log('Successfully created Weekly Note:', file.path);
		return file;
	}

	/**
	 * Generate Weekly Note template
	 */
	private async generateWeeklyTemplate(weekInfo: WeekInfo): Promise<WeeklyNoteTemplate> {
		const title = `Week ${weekInfo.weekNumber}, ${weekInfo.year}`;
		const content = this.generateDefaultWeeklyTemplate(weekInfo);

		return {
			title,
			content,
			timingSectionLocation: this.settings.timingSectionLocation
		};
	}

	/**
	 * Generate default Weekly Note template content
	 */
	private generateDefaultWeeklyTemplate(weekInfo: WeekInfo): string {
		const title = `# Week ${weekInfo.weekNumber}, ${weekInfo.year}`;
		const dateRange = `**${weekInfo.weekStartString} — ${weekInfo.weekEndString}**`;
		
		const timingSection = this.settings.timingSectionLocation === 'top' 
			? '## Weekly Timing Summary\n<!-- Weekly timing data will be automatically updated here -->\n\n'
			: '';

		const dailyLinks = this.generateDailyLinks(weekInfo);
		
		const mainContent = `${title}

${dateRange}

${timingSection}## Overview

## Goals for this week
- [ ] 

## Daily Notes
${dailyLinks}

## Weekly Review

### Accomplishments
- 

### Challenges
- 

### Learnings
- 

`;

		const bottomTimingSection = this.settings.timingSectionLocation === 'bottom'
			? '## Weekly Timing Summary\n<!-- Weekly timing data will be automatically updated here -->\n\n'
			: '';

		const reflection = this.settings.includeWeeklyReflection
			? '## Time Management Reflection\n\n### What worked well?\n\n### What could be improved?\n\n### Plans for next week\n\n'
			: '';

		return mainContent + bottomTimingSection + reflection;
	}

	/**
	 * Generate links to daily notes for the week
	 */
	private generateDailyLinks(weekInfo: WeekInfo): string {
		const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		const links: string[] = [];
		
		const currentDate = new Date(weekInfo.weekStart);
		
		for (let i = 0; i < 7; i++) {
			const dayName = dayNames[currentDate.getDay()];
			const dateStr = this.formatDate(currentDate);
			
			// Create link in format: - [[2025-06-18|Monday, June 18]]
			const displayName = `${dayName}, ${currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
			links.push(`- [[${dateStr}|${displayName}]]`);
			
			currentDate.setDate(currentDate.getDate() + 1);
		}
		
		return links.join('\n');
	}

	/**
	 * Aggregate daily data into weekly summary
	 */
	aggregateWeeklyData(dailyDataMap: Map<string, DailyTimeData>, weekInfo: WeekInfo): WeeklyTimeData {
		const summary = this.calculateWeeklySummary(dailyDataMap);
		
		return {
			weekStart: weekInfo.weekStartString,
			weekEnd: weekInfo.weekEndString,
			weekNumber: weekInfo.weekNumber,
			year: weekInfo.year,
			dailyData: dailyDataMap,
			summary
		};
	}

	/**
	 * Calculate weekly summary from daily data
	 */
	private calculateWeeklySummary(dailyDataMap: Map<string, DailyTimeData>): WeeklySummary {
		const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		
		let totalTime = 0;
		const byApplication = new Map<string, number>();
		const byCategory = new Map<string, number>();
		const byDay = new Map<string, number>();
		
		let maxDayTime = 0;
		let mostProductiveDay = 'Monday';

		// Process each day's data
		for (const [dateStr, dailyData] of dailyDataMap) {
			const date = new Date(dateStr);
			const dayName = dayNames[date.getDay()];
			
			totalTime += dailyData.summary.totalTime;
			byDay.set(dayName, dailyData.summary.totalTime);
			
			// Track most productive day
			if (dailyData.summary.totalTime > maxDayTime) {
				maxDayTime = dailyData.summary.totalTime;
				mostProductiveDay = dayName;
			}
			
			// Aggregate applications
			for (const [app, time] of dailyData.summary.byApplication) {
				byApplication.set(app, (byApplication.get(app) || 0) + time);
			}
			
			// Aggregate categories
			for (const [cat, time] of dailyData.summary.byCategory) {
				byCategory.set(cat, (byCategory.get(cat) || 0) + time);
			}
		}

		const averageDailyTime = dailyDataMap.size > 0 ? totalTime / dailyDataMap.size : 0;

		// Calculate productivity metrics (simplified)
		const focusTime = this.calculateFocusTime(byApplication);
		const meetingTime = this.calculateMeetingTime(byApplication);
		const breakTime = totalTime - focusTime - meetingTime;

		return {
			totalTime,
			averageDailyTime,
			byApplication,
			byCategory,
			byDay,
			mostProductiveDay,
			productivity: {
				focusTime: Math.max(0, focusTime),
				breakTime: Math.max(0, breakTime),
				meetingTime: Math.max(0, meetingTime)
			}
		};
	}

	/**
	 * Calculate focus time from applications (simplified heuristic)
	 */
	private calculateFocusTime(byApplication: Map<string, number>): number {
		const focusApps = ['Xcode', 'VS Code', 'Visual Studio Code', 'IntelliJ', 'Sublime Text', 'Atom', 'WebStorm', 'PhpStorm'];
		let focusTime = 0;
		
		for (const [app, time] of byApplication) {
			if (focusApps.some(focusApp => app.toLowerCase().includes(focusApp.toLowerCase()))) {
				focusTime += time;
			}
		}
		
		return focusTime;
	}

	/**
	 * Calculate meeting time from applications (simplified heuristic)
	 */
	private calculateMeetingTime(byApplication: Map<string, number>): number {
		const meetingApps = ['Zoom', 'Teams', 'Slack', 'Discord', 'Google Meet', 'Skype'];
		let meetingTime = 0;
		
		for (const [app, time] of byApplication) {
			if (meetingApps.some(meetingApp => app.toLowerCase().includes(meetingApp.toLowerCase()))) {
				meetingTime += time;
			}
		}
		
		return meetingTime;
	}

	/**
	 * Ensure directory exists
	 */
	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (!dirPath) return;
		
		try {
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir) {
				await this.app.vault.createFolder(dirPath);
				console.log('Created directory:', dirPath);
			}
		} catch (error) {
			console.warn('Failed to create directory:', dirPath, error);
		}
	}

	/**
	 * Get directory path from file path
	 */
	private getDirectoryPath(filePath: string): string {
		const lastSlash = filePath.lastIndexOf('/');
		return lastSlash >= 0 ? filePath.substring(0, lastSlash) : '';
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: TimingPluginSettings): void {
		this.settings = settings;
	}
}
import { TimingRawData, DailyTimeData, TimeEntry, TimeSummary } from './types';

export class DataTransformer {
	
	transformTimingData(rawData: TimingRawData): DailyTimeData {
		this.validateRawData(rawData);
		
		const entries = this.transformEntries(rawData.entries);
		const summary = this.calculateSummary(entries);
		
		return {
			date: rawData.date,
			entries,
			summary
		};
	}

	private validateRawData(rawData: TimingRawData): void {
		if (!rawData) {
			throw new Error('Raw data is null or undefined');
		}
		
		if (!rawData.date) {
			throw new Error('Raw data missing date field');
		}
		
		if (!this.isValidDate(rawData.date)) {
			throw new Error(`Invalid date format: ${rawData.date}`);
		}
		
		if (!Array.isArray(rawData.entries)) {
			throw new Error('Raw data entries must be an array');
		}
	}

	private transformEntries(rawEntries: any[]): TimeEntry[] {
		return rawEntries
			.map(entry => this.transformEntry(entry))
			.filter((entry): entry is TimeEntry => entry !== null)
			.sort((a, b) => a.startTime.localeCompare(b.startTime));
	}

	private transformEntry(rawEntry: any): TimeEntry | null {
		try {
			this.validateRawEntry(rawEntry);
			
			return {
				startTime: this.normalizeTime(rawEntry.startTime),
				endTime: this.normalizeTime(rawEntry.endTime),
				duration: this.parseDuration(rawEntry.duration),
				application: this.sanitizeString(rawEntry.application),
				category: rawEntry.category ? this.sanitizeString(rawEntry.category) : undefined,
				title: rawEntry.title ? this.sanitizeString(rawEntry.title) : undefined,
				productivity: rawEntry.productivity ? this.parseProductivity(rawEntry.productivity) : undefined
			};
		} catch (error) {
			console.warn('Failed to transform entry:', rawEntry, error);
			return null;
		}
	}

	private validateRawEntry(rawEntry: any): void {
		if (!rawEntry.startTime || !rawEntry.endTime) {
			throw new Error('Entry missing required time fields');
		}
		
		if (!rawEntry.application) {
			throw new Error('Entry missing application field');
		}
		
		if (typeof rawEntry.duration !== 'number' || rawEntry.duration < 0) {
			throw new Error('Entry has invalid duration');
		}
	}

	private normalizeTime(timeString: string): string {
		// Ensure time is in HH:MM:SS format
		const timePattern = /^(\d{1,2}):(\d{2}):(\d{2})$/;
		const match = timeString.match(timePattern);
		
		if (!match) {
			throw new Error(`Invalid time format: ${timeString}`);
		}
		
		const [, hours, minutes, seconds] = match;
		return `${hours.padStart(2, '0')}:${minutes}:${seconds}`;
	}

	private parseDuration(duration: any): number {
		if (typeof duration === 'number') {
			return Math.max(0, Math.round(duration));
		}
		
		if (typeof duration === 'string') {
			const parsed = parseInt(duration, 10);
			if (!isNaN(parsed)) {
				return Math.max(0, parsed);
			}
		}
		
		throw new Error(`Invalid duration: ${duration}`);
	}

	private parseProductivity(productivity: any): number | undefined {
		if (typeof productivity === 'number') {
			return Math.max(0, Math.min(5, Math.round(productivity)));
		}
		
		if (typeof productivity === 'string') {
			const parsed = parseInt(productivity, 10);
			if (!isNaN(parsed)) {
				return Math.max(0, Math.min(5, parsed));
			}
		}
		
		return undefined;
	}

	private sanitizeString(input: string): string {
		if (typeof input !== 'string') {
			return String(input || '');
		}
		
		return input
			.trim()
			.replace(/[\r\n\t]/g, ' ')
			.replace(/\s+/g, ' ')
			.substring(0, 200); // Limit length
	}

	private calculateSummary(entries: TimeEntry[]): TimeSummary {
		const summary: TimeSummary = {
			totalTime: 0,
			byApplication: new Map(),
			byCategory: new Map(),
			byHour: new Map()
		};

		for (const entry of entries) {
			summary.totalTime += entry.duration;
			
			// By application
			const currentApp = summary.byApplication.get(entry.application) || 0;
			summary.byApplication.set(entry.application, currentApp + entry.duration);
			
			// By category
			if (entry.category) {
				const currentCat = summary.byCategory.get(entry.category) || 0;
				summary.byCategory.set(entry.category, currentCat + entry.duration);
			}
			
			// By hour
			const hour = this.extractHour(entry.startTime);
			const currentHour = summary.byHour.get(hour) || 0;
			summary.byHour.set(hour, currentHour + entry.duration);
		}

		return summary;
	}

	private extractHour(timeString: string): number {
		const [hourStr] = timeString.split(':');
		return parseInt(hourStr, 10);
	}

	private isValidDate(dateString: string): boolean {
		const date = new Date(dateString);
		return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
	}

	formatDuration(seconds: number): string {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m`;
		}
		
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		
		if (remainingMinutes === 0) {
			return `${hours}h`;
		}
		
		return `${hours}h ${remainingMinutes}m`;
	}

	formatTime(timeString: string, format: '12h' | '24h' = '24h'): string {
		if (format === '24h') {
			return timeString;
		}
		
		const [hours, minutes] = timeString.split(':');
		const hour24 = parseInt(hours, 10);
		const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
		const ampm = hour24 < 12 ? 'AM' : 'PM';
		
		return `${hour12}:${minutes} ${ampm}`;
	}

	calculatePercentage(value: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((value / total) * 100 * 10) / 10; // Round to 1 decimal place
	}

	getMostUsedApplication(summary: TimeSummary): { name: string; time: number } | null {
		if (summary.byApplication.size === 0) {
			return null;
		}
		
		let maxTime = 0;
		let maxApp = '';
		
		for (const [app, time] of summary.byApplication.entries()) {
			if (time > maxTime) {
				maxTime = time;
				maxApp = app;
			}
		}
		
		return { name: maxApp, time: maxTime };
	}

	getMostProductiveHour(summary: TimeSummary): { hour: number; time: number } | null {
		if (summary.byHour.size === 0) {
			return null;
		}
		
		let maxTime = 0;
		let maxHour = 0;
		
		for (const [hour, time] of summary.byHour.entries()) {
			if (time > maxTime) {
				maxTime = time;
				maxHour = hour;
			}
		}
		
		return { hour: maxHour, time: maxTime };
	}

	filterEntriesByMinimumDuration(entries: TimeEntry[], minimumSeconds: number): TimeEntry[] {
		return entries.filter(entry => entry.duration >= minimumSeconds);
	}

	groupEntriesByApplication(entries: TimeEntry[]): Map<string, TimeEntry[]> {
		const grouped = new Map<string, TimeEntry[]>();
		
		for (const entry of entries) {
			if (!grouped.has(entry.application)) {
				grouped.set(entry.application, []);
			}
			grouped.get(entry.application)!.push(entry);
		}
		
		return grouped;
	}

	groupEntriesByCategory(entries: TimeEntry[]): Map<string, TimeEntry[]> {
		const grouped = new Map<string, TimeEntry[]>();
		
		for (const entry of entries) {
			const category = entry.category || 'Uncategorized';
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push(entry);
		}
		
		return grouped;
	}

	createEmptyDailyData(date: string): DailyTimeData {
		return {
			date,
			entries: [],
			summary: {
				totalTime: 0,
				byApplication: new Map(),
				byCategory: new Map(),
				byHour: new Map()
			}
		};
	}
}
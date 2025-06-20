import { TimeEntry } from '../types';

export interface TimeBlock {
	startTime: string;
	endTime: string;
	duration: number;
	application: string;
	category?: string;
	entries: TimeEntry[];
	title: string;
	isExpanded?: boolean;
}

export class TimeBlockGrouper {
	/**
	 * Groups consecutive activities into time blocks
	 */
	static groupIntoTimeBlocks(entries: TimeEntry[], options: {
		mergeThreshold?: number; // minutes gap to consider consecutive
		minimumBlockDuration?: number; // minimum seconds for a block
		groupBy?: 'application' | 'category' | 'both';
	} = {}): TimeBlock[] {
		const {
			mergeThreshold = 5, // 5 minutes gap
			minimumBlockDuration = 60, // 1 minute minimum
			groupBy = 'application'
		} = options;

		if (entries.length === 0) return [];

		// Sort entries by start time
		const sortedEntries = [...entries].sort((a, b) => 
			a.startTime.localeCompare(b.startTime)
		);

		const timeBlocks: TimeBlock[] = [];
		let currentBlock: TimeEntry[] = [sortedEntries[0]];

		for (let i = 1; i < sortedEntries.length; i++) {
			const currentEntry = sortedEntries[i];
			const lastEntry = currentBlock[currentBlock.length - 1];

			// Check if entries should be merged
			if (this.shouldMergeEntries(lastEntry, currentEntry, mergeThreshold, groupBy)) {
				currentBlock.push(currentEntry);
			} else {
				// Finalize current block and start new one
				const block = this.createTimeBlock(currentBlock);
				if (block.duration >= minimumBlockDuration) {
					timeBlocks.push(block);
				}
				currentBlock = [currentEntry];
			}
		}

		// Add the last block
		if (currentBlock.length > 0) {
			const block = this.createTimeBlock(currentBlock);
			if (block.duration >= minimumBlockDuration) {
				timeBlocks.push(block);
			}
		}

		return timeBlocks;
	}

	private static shouldMergeEntries(
		entry1: TimeEntry, 
		entry2: TimeEntry, 
		mergeThreshold: number,
		groupBy: 'application' | 'category' | 'both'
	): boolean {
		// Check if they should be grouped by application/category
		const sameApplication = entry1.application === entry2.application;
		const sameCategory = entry1.category === entry2.category;

		let shouldGroup = false;
		switch (groupBy) {
			case 'application':
				shouldGroup = sameApplication;
				break;
			case 'category':
				shouldGroup = sameCategory;
				break;
			case 'both':
				shouldGroup = sameApplication && sameCategory;
				break;
		}

		if (!shouldGroup) return false;

		// Check time proximity
		const entry1End = this.timeToMinutes(entry1.endTime);
		const entry2Start = this.timeToMinutes(entry2.startTime);
		const gap = entry2Start - entry1End;

		return gap <= mergeThreshold;
	}

	private static createTimeBlock(entries: TimeEntry[]): TimeBlock {
		if (entries.length === 0) throw new Error('Cannot create block from empty entries');

		const first = entries[0];
		const last = entries[entries.length - 1];
		
		// Calculate total duration
		const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);

		// Create block title
		const title = this.createBlockTitle(entries);

		return {
			startTime: first.startTime,
			endTime: last.endTime,
			duration: totalDuration,
			application: first.application,
			category: first.category || undefined,
			entries: entries,
			title: title,
			isExpanded: false
		};
	}

	private static createBlockTitle(entries: TimeEntry[]): string {
		if (entries.length === 1) {
			const entry = entries[0];
			return entry.title || `${entry.application}${entry.category ? ` - ${entry.category}` : ''}`;
		}

		// Multiple entries - create summary title
		const app = entries[0].application;
		const category = entries[0].category;
		const uniqueTitles = [...new Set(entries.map(e => e.title).filter(Boolean))];

		if (uniqueTitles.length === 1 && uniqueTitles[0]) {
			return uniqueTitles[0];
		} else if (uniqueTitles.length > 1) {
			return `${app} - Multiple activities`;
		} else {
			return `${app}${category ? ` - ${category}` : ''}`;
		}
	}

	/**
	 * Groups time blocks by hour for timeline display
	 */
	static groupBlocksByHour(timeBlocks: TimeBlock[]): Map<number, TimeBlock[]> {
		const grouped = new Map<number, TimeBlock[]>();

		timeBlocks.forEach(block => {
			const startHour = parseInt(block.startTime.split(':')[0], 10);
			const endHour = parseInt(block.endTime.split(':')[0], 10);

			// A block might span multiple hours
			for (let hour = startHour; hour <= endHour; hour++) {
				if (!grouped.has(hour)) {
					grouped.set(hour, []);
				}
				
				// Only add once per hour (to the starting hour)
				if (hour === startHour) {
					grouped.get(hour)!.push(block);
				}
			}
		});

		return grouped;
	}

	/**
	 * Calculates visual height for time blocks based on duration
	 */
	static calculateBlockHeight(block: TimeBlock, options: {
		minHeight?: number;
		maxHeight?: number;
		pixelsPerMinute?: number;
	} = {}): number {
		const {
			minHeight = 30,
			maxHeight = 200,
			pixelsPerMinute = 2
		} = options;

		const durationMinutes = Math.round(block.duration / 60);
		const calculatedHeight = durationMinutes * pixelsPerMinute;

		return Math.min(Math.max(calculatedHeight, minHeight), maxHeight);
	}

	/**
	 * Filters time blocks by minimum duration
	 */
	static filterBlocksByDuration(blocks: TimeBlock[], minimumSeconds: number): TimeBlock[] {
		return blocks.filter(block => block.duration >= minimumSeconds);
	}

	/**
	 * Formats time block duration for display
	 */
	static formatBlockDuration(block: TimeBlock): string {
		const minutes = Math.round(block.duration / 60);
		
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

	private static timeToMinutes(timeString: string): number {
		const [hours, minutes] = timeString.split(':').map(Number);
		return hours * 60 + minutes;
	}
}
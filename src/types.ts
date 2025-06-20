export interface TimeEntry {
	startTime: string;
	endTime: string;
	duration: number;
	application: string;
	category?: string;
	title?: string;
	productivity?: number;
}

export interface DailyTimeData {
	date: string;
	entries: TimeEntry[];
	summary: TimeSummary;
}

export interface TimeSummary {
	totalTime: number;
	byApplication: Map<string, number>;
	byCategory: Map<string, number>;
	byHour: Map<number, number>;
}

export interface TimingRawData {
	date: string;
	entries: Array<{
		startTime: string;
		endTime: string;
		duration: number;
		application: string;
		category?: string;
		title?: string;
		productivity?: number;
	}>;
	summary: {
		totalTime: number;
		applications: Record<string, number>;
		categories: Record<string, number>;
	};
}

export interface TimingPluginSettings {
	enableTimeTracking: boolean;
	timingAppPath: string;
	updateInterval: number;
	dateFormat: string;
	folder: string;
	autoCreateDailyNotes: boolean;
	timingSectionLocation: 'top' | 'bottom' | 'after-header' | 'custom';
	afterHeaderName?: string;
	includeTimeline: boolean;
	includeReflection: boolean;
	groupBy: 'application' | 'category' | 'both';
	timeFormat: '12h' | '24h';
	minimumDuration: number;
}

export interface CachedEntry<T = any> {
	key: string;
	data: T;
	timestamp: number;
	lastAccessed: number;
	source: 'applescript' | 'computed' | 'user_input';
	version: string;
	checksum?: string;
	dependencies?: string[];
}

export interface TimingCacheEntry extends CachedEntry<DailyTimeData> {
	lastFetchTime: number;
	isComplete: boolean;
	nextUpdateTime: number;
}

export enum TimingIntegrationError {
	APP_NOT_FOUND = 'Timing app not found',
	INSUFFICIENT_PERMISSIONS = 'AppleScript permissions required',
	SUBSCRIPTION_REQUIRED = 'Timing Connect subscription required',
	DATA_PARSING_ERROR = 'Failed to parse Timing data',
	APPLESCRIPT_EXECUTION_ERROR = 'AppleScript execution failed',
	APP_NOT_RUNNING = 'Timing app not running'
}

export interface TimingPluginError {
	type: TimingIntegrationError;
	title: string;
	description: string;
	solutionSteps: Array<{
		description: string;
		action?: {
			label: string;
			callback: () => void;
		};
	}>;
}

export enum RibbonIconState {
	ACTIVE = 'timing-active',
	WARNING = 'timing-warning',
	ERROR = 'timing-error',
	SYNCING = 'timing-syncing',
	DISABLED = 'timing-disabled'
}

export enum FetchStrategy {
	IMMEDIATE = 'immediate',
	SCHEDULED = 'scheduled',
	LAZY = 'lazy',
	BACKGROUND = 'background'
}

export interface TimingSectionInfo {
	exists: boolean;
	startLine: number;
	endLine: number;
	content: string;
	headerLevel: number;
}

export interface DailyNoteTemplate {
	title: string;
	content: string;
	timingSectionLocation: 'top' | 'bottom' | 'after-header' | 'custom';
}
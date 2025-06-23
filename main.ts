import { App, Plugin, PluginSettingTab, Setting, Notice } from "obsidian";
import { TimingPluginSettings, RibbonIconState } from "./src/types";
import { TimingIntegration } from "./src/timing-integration";
import { CacheManager, TimingDataCache } from "./src/cache-manager";
import { DailyNoteManager } from "./src/daily-note-manager";
import { TimingSectionManager } from "./src/timing-section-manager";
import { WeeklyNoteManager } from "./src/weekly-note-manager";
import { WeeklySectionManager } from "./src/weekly-section-manager";
import { SetupWizardModal } from "./src/modals/setup-wizard-modal";
import { DatePickerModal } from "./src/modals/date-picker-modal";
import {
	TimingDataView,
	TIMING_DATA_VIEW_TYPE,
} from "./src/views/timing-data-view";
import {
	TimingTimelineView,
	TIMING_TIMELINE_VIEW_TYPE,
} from "./src/views/timing-timeline-view";
import { DataTransformer } from "./src/data-transformer";

const DEFAULT_SETTINGS: TimingPluginSettings = {
	enableTimeTracking: true,
	timingAppPath: "/Applications/Timing.app",
	updateInterval: 5 * 60 * 1000, // 5 minutes
	dateFormat: "YYYY-MM-DD",
	folder: "",
	autoCreateDailyNotes: true,
	timingSectionLocation: "bottom",
	includeTimeline: true,
	includeReflection: true,
	groupBy: "both",
	timeFormat: "24h",
	minimumDuration: 60, // 1 minute in seconds
	// Weekly Notes settings
	enableWeeklyNotes: true,
	weeklyNotesFolder: "Weekly",
	weeklyDateFormat: "YYYY-[W]WW",
	autoCreateWeeklyNotes: true,
	weekStartsOn: "monday",
	includeWeeklySummary: true,
	includeWeeklyReflection: true,
};

export default class TimingPlugin extends Plugin {
	settings: TimingPluginSettings;
	timingIntegration: TimingIntegration;
	cacheManager: CacheManager;
	timingDataCache: TimingDataCache;
	dailyNoteManager: DailyNoteManager;
	timingSectionManager: TimingSectionManager;
	weeklyNoteManager: WeeklyNoteManager;
	weeklySectionManager: WeeklySectionManager;
	dataTransformer: DataTransformer;
	ribbonIconEl: HTMLElement;
	timelineRibbonIconEl: HTMLElement;
	statusBarItemEl: HTMLElement;
	private updateInterval: NodeJS.Timeout | null = null;
	private timelineView: TimingTimelineView | null = null;

	async onload() {
		await this.loadSettings();

		// Register the timing data view
		this.registerView(
			TIMING_DATA_VIEW_TYPE,
			(leaf) => new TimingDataView(leaf, this.settings),
		);

		// Register the timeline view
		this.registerView(
			TIMING_TIMELINE_VIEW_TYPE,
			(leaf) => new TimingTimelineView(leaf, this.settings, this),
		);

		// Initialize core components
		this.cacheManager = new CacheManager(localStorage);
		this.timingDataCache = new TimingDataCache(this.cacheManager);
		this.timingIntegration = new TimingIntegration();
		this.dailyNoteManager = new DailyNoteManager(this.app, this.settings);
		this.timingSectionManager = new TimingSectionManager(
			this.app,
			this.settings,
		);
		this.weeklyNoteManager = new WeeklyNoteManager(this.app, this.settings);
		this.weeklySectionManager = new WeeklySectionManager(this.app, this.settings);
		this.dataTransformer = new DataTransformer();

		// Setup UI elements
		this.setupRibbonIcon();
		this.setupStatusBar();
		this.setupCommands();

		// Add settings tab
		this.addSettingTab(new TimingSettingTab(this.app, this));

		// Check if this is first run and show setup wizard
		await this.checkFirstRun();

		// Start background updates if enabled
		if (this.settings.enableTimeTracking) {
			await this.startBackgroundUpdates();
		}

		console.log("Timing Plugin loaded");
	}

	onunload() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}

		// Clean up views
		this.app.workspace.detachLeavesOfType(TIMING_DATA_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(TIMING_TIMELINE_VIEW_TYPE);

		console.log("Timing Plugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Update managers with new settings
		this.dailyNoteManager?.updateSettings(this.settings);
		this.timingSectionManager?.updateSettings(this.settings);
		this.weeklyNoteManager?.updateSettings(this.settings);
		this.weeklySectionManager?.updateSettings(this.settings);

		// Update timing data views with new settings
		const timingViews = this.app.workspace.getLeavesOfType(
			TIMING_DATA_VIEW_TYPE,
		);
		timingViews.forEach((leaf) => {
			const view = leaf.view as TimingDataView;
			view.updateSettings(this.settings);
		});

		// Restart background updates with new settings
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}

		if (this.settings.enableTimeTracking) {
			await this.startBackgroundUpdates();
		}
	}

	private setupRibbonIcon(): void {
		this.ribbonIconEl = this.addRibbonIcon(
			"clock",
			"Timing Plugin",
			async (evt: MouseEvent) => {
				await this.handleRibbonClick(evt);
			},
		);

		this.updateRibbonIcon(RibbonIconState.DISABLED);

		// Add timeline ribbon icon
		this.timelineRibbonIconEl = this.addRibbonIcon(
			"activity",
			"Open Timing Timeline",
			async (evt: MouseEvent) => {
				await this.openTimelineView();
			},
		);
	}

	private setupStatusBar(): void {
		this.statusBarItemEl = this.addStatusBarItem();
		this.updateStatusBar("Timing: Initializing...");
	}

	private setupCommands(): void {
		// Sync data now command
		this.addCommand({
			id: "timing-sync-now",
			name: "Sync timing data now",
			callback: async () => {
				await this.syncDataNow();
			},
		});

		// Update current Daily Note command
		this.addCommand({
			id: "timing-update-current-note",
			name: "Update current Daily Note with timing data",
			callback: async () => {
				await this.updateCurrentDailyNote();
			},
		});

		// Create Daily Note with timing section command
		this.addCommand({
			id: "timing-create-daily-note",
			name: "Create Daily Note with timing section",
			callback: async () => {
				await this.createDailyNoteWithTiming();
			},
		});

		// Open today's Daily Note command
		this.addCommand({
			id: "timing-open-today",
			name: "Open today's Daily Note",
			callback: async () => {
				await this.openTodaysDailyNote();
			},
		});

		// Preview timing data command
		this.addCommand({
			id: "timing-preview-data",
			name: "Open timing data view",
			callback: async () => {
				await this.previewTimingData();
			},
		});

		// Setup wizard command
		this.addCommand({
			id: "timing-setup-wizard",
			name: "Open setup wizard",
			callback: async () => {
				await this.openSetupWizard();
			},
		});

		// Test connection command
		this.addCommand({
			id: "timing-test-connection",
			name: "Test Timing app connection",
			callback: async () => {
				await this.testConnection();
			},
		});

		// Clear cache command
		this.addCommand({
			id: "timing-clear-cache",
			name: "Clear timing data cache",
			callback: async () => {
				await this.clearCache();
			},
		});

		// Sync specific date command
		this.addCommand({
			id: "timing-sync-specific-date",
			name: "Sync timing data for specific date",
			callback: async () => {
				await this.openDatePickerForSync();
			},
		});

		// Open timeline view command
		this.addCommand({
			id: "timing-open-timeline",
			name: "Open timing timeline",
			callback: async () => {
				await this.openTimelineView();
			},
		});

		// Open timing view command (for ribbon)
		this.addCommand({
			id: "timing-open-view",
			name: "Open timing data view",
			callback: async () => {
				// Open view without specific data (empty state)
				await this.openTimingDataView(null);
			},
		});

		// Weekly Notes commands
		this.addCommand({
			id: "timing-update-weekly-note",
			name: "Update current Weekly Note with timing data",
			callback: async () => {
				await this.updateCurrentWeeklyNote();
			},
		});

		this.addCommand({
			id: "timing-create-weekly-note",
			name: "Create Weekly Note with timing section",
			callback: async () => {
				await this.createWeeklyNoteWithTiming();
			},
		});

		this.addCommand({
			id: "timing-open-current-week",
			name: "Open this week's Weekly Note",
			callback: async () => {
				await this.openCurrentWeeklyNote();
			},
		});

		this.addCommand({
			id: "timing-sync-weekly-data",
			name: "Sync weekly timing data",
			callback: async () => {
				await this.syncWeeklyData();
			},
		});
	}

	private async handleRibbonClick(evt: MouseEvent): Promise<void> {
		if (evt.shiftKey) {
			// Shift+click for quick sync
			await this.syncDataNow();
		} else {
			// Regular click opens settings
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById("timing-plugin");
		}
	}

	private async startBackgroundUpdates(): Promise<void> {
		// Test connection first
		const connectionResult = await this.timingIntegration.testConnection();
		if (!connectionResult.success) {
			this.updateRibbonIcon(RibbonIconState.ERROR);
			this.updateStatusBar("Timing: Connection failed");
			new Notice(`Timing Plugin: ${connectionResult.message}`);
			return;
		}

		this.updateRibbonIcon(RibbonIconState.ACTIVE);
		this.updateStatusBar("Timing: Active");

		// Start periodic updates
		this.updateInterval = setInterval(async () => {
			await this.syncDataNow();
		}, this.settings.updateInterval);

		// Initial sync
		await this.syncDataNow();
	}

	async syncDataNow(): Promise<void> {
		try {
			this.updateRibbonIcon(RibbonIconState.SYNCING);
			this.updateStatusBar("Timing: Syncing...");

			const today = new Date();
			console.log("=== SYNC DEBUG START ===");
			console.log(
				"Syncing data for date:",
				today.toISOString().split("T")[0],
			);

			const data = await this.timingIntegration.getTimeDataForDate(today);
			console.log(
				"Retrieved timing data:",
				JSON.stringify(data, null, 2),
			);
			console.log("Entries count:", data.entries.length);
			console.log("Total time:", data.summary.totalTime);

			await this.timingDataCache.setDailyData(data.date, data, true);
			console.log("Data cached successfully");

			// Update today's Daily Note if auto-update is enabled
			if (this.settings.enableTimeTracking) {
				console.log("Auto-update enabled, updating Daily Note...");
				await this.updateTodaysDailyNote(data);
				console.log("Daily Note update completed");
			} else {
				console.log("Auto-update disabled, skipping Daily Note update");
			}

			// Update timeline view if open
			await this.updateTimelineView(data);

			this.updateRibbonIcon(RibbonIconState.ACTIVE);
			this.updateStatusBar(
				`Timing: ✅ (${new Date().toLocaleTimeString()})`,
			);
			console.log("=== SYNC DEBUG END ===");

			new Notice(
				`Sync completed: ${data.entries.length} entries, ${this.dataTransformer.formatDuration(data.summary.totalTime)} total`,
			);
		} catch (error) {
			console.error("Sync failed:", error);
			this.updateRibbonIcon(RibbonIconState.ERROR);
			this.updateStatusBar("Timing: ❌ Sync failed");
			new Notice(`Timing sync failed: ${error.message}`);
		}
	}

	private async updateTodaysDailyNote(data?: any): Promise<void> {
		try {
			console.log("=== DAILY NOTE UPDATE DEBUG START ===");
			const today = new Date();
			const dateStr = today.toISOString().split("T")[0];
			console.log("Updating Daily Note for date:", dateStr);

			let timingData = data;

			if (!timingData) {
				console.log("No data provided, fetching from cache...");
				// Get data from cache or fetch fresh
				timingData = await this.timingDataCache.getDailyData(dateStr);
				if (!timingData) {
					console.log("No cached data, fetching fresh data...");
					timingData =
						await this.timingIntegration.getTimeDataForDate(today);
				} else {
					console.log("Using cached data");
				}
			} else {
				console.log("Using provided data");
			}

			console.log("Final timing data for Daily Note:", {
				date: timingData.date,
				entriesCount: timingData.entries.length,
				totalTime: timingData.summary.totalTime,
			});

			// Find or create today's Daily Note
			console.log("Looking for existing Daily Note...");
			let dailyNote = await this.dailyNoteManager.findDailyNote(today);

			if (!dailyNote) {
				console.log("Daily Note not found");
				if (this.settings.autoCreateDailyNotes) {
					console.log(
						"Auto-create enabled, creating new Daily Note...",
					);
					dailyNote =
						await this.dailyNoteManager.createDailyNote(today);
					new Notice(
						"Created today's Daily Note with timing section",
					);
					console.log("Daily Note created:", dailyNote.path);
				} else {
					console.log(
						"Auto-create disabled, cannot update Daily Note",
					);
					return;
				}
			} else {
				console.log("Found existing Daily Note:", dailyNote.path);
			}

			if (dailyNote) {
				console.log("Updating timing section in Daily Note...");
				await this.timingSectionManager.updateTimingSection(
					dailyNote,
					timingData,
				);
				console.log("Successfully updated Daily Note with timing data");
			} else {
				console.log("No Daily Note available for update");
			}
			console.log("=== DAILY NOTE UPDATE DEBUG END ===");
		} catch (error) {
			console.error("Failed to update Daily Note:", error);
			console.error("Error details:", error.stack);
		}
	}

	async updateCurrentDailyNote(): Promise<void> {
		try {
			await this.updateTodaysDailyNote();
			new Notice("Updated current Daily Note with timing data");
		} catch (error) {
			new Notice(`Failed to update Daily Note: ${error.message}`);
		}
	}

	async createDailyNoteWithTiming(): Promise<void> {
		try {
			const today = new Date();

			// Check if note already exists
			const existingNote =
				await this.dailyNoteManager.findDailyNote(today);
			if (existingNote) {
				new Notice(
					'Daily Note already exists. Use "Update current Daily Note" instead.',
				);
				return;
			}

			// Create new Daily Note
			const dailyNote =
				await this.dailyNoteManager.createDailyNote(today);

			// Get timing data and update the note
			const timingData = await this.timingDataCache.getDailyData(
				today.toISOString().split("T")[0],
			);
			if (timingData) {
				await this.timingSectionManager.updateTimingSection(
					dailyNote,
					timingData,
				);
			}

			// Open the new note
			await this.app.workspace.getLeaf().openFile(dailyNote);

			new Notice("Created Daily Note with timing section");
		} catch (error) {
			new Notice(`Failed to create Daily Note: ${error.message}`);
		}
	}

	async openTodaysDailyNote(): Promise<void> {
		try {
			const today = new Date();
			let dailyNote = await this.dailyNoteManager.findDailyNote(today);

			if (!dailyNote && this.settings.autoCreateDailyNotes) {
				dailyNote = await this.dailyNoteManager.createDailyNote(today);
			}

			if (dailyNote) {
				await this.app.workspace.getLeaf().openFile(dailyNote);
			} else {
				new Notice(
					"Today's Daily Note not found. Enable auto-creation or create manually.",
				);
			}
		} catch (error) {
			new Notice(`Failed to open Daily Note: ${error.message}`);
		}
	}

	async previewTimingData(): Promise<void> {
		try {
			const today = new Date();
			const dateStr = today.toISOString().split("T")[0];

			// Get timing data from cache or fetch fresh
			let timingData = await this.timingDataCache.getDailyData(dateStr);
			if (!timingData) {
				this.updateStatusBar("Timing: Fetching data...");
				timingData =
					await this.timingIntegration.getTimeDataForDate(today);
				await this.timingDataCache.setDailyData(
					dateStr,
					timingData,
					true,
				);
			}

			// Open timing data view
			await this.openTimingDataView(timingData, async (confirmedData) => {
				// User confirmed, update Daily Note
				await this.updateTodaysDailyNote(confirmedData);
				new Notice("Timing data added to Daily Note");
			});
		} catch (error) {
			new Notice(`Failed to preview timing data: ${error.message}`);
		}
	}

	async testConnection(): Promise<void> {
		const result = await this.timingIntegration.testConnection();

		if (result.success) {
			new Notice(`✅ ${result.message}`);
			if (result.details) {
				console.log("Connection test details:", result.details);
			}
		} else {
			new Notice(`❌ ${result.message}`);
		}
	}

	async clearCache(): Promise<void> {
		await this.timingDataCache.clearAll();
		new Notice("Timing data cache cleared");
	}

	async openDatePickerForSync(): Promise<void> {
		const modal = new DatePickerModal(this.app, async (selectedDate: Date) => {
			await this.syncDataForSpecificDate(selectedDate);
		});
		modal.open();
	}

	async syncDataForSpecificDate(date: Date): Promise<void> {
		try {
			this.updateRibbonIcon(RibbonIconState.SYNCING);
			this.updateStatusBar("Timing: Syncing specific date...");

			const dateStr = date.toISOString().split("T")[0];
			console.log("=== SPECIFIC DATE SYNC DEBUG START ===");
			console.log("Syncing data for date:", dateStr);

			const data = await this.timingIntegration.getTimeDataForDate(date);
			console.log("Retrieved timing data for", dateStr, ":", {
				entries: data.entries.length,
				totalTime: data.summary.totalTime
			});

			await this.timingDataCache.setDailyData(data.date, data, true);
			console.log("Data cached successfully for", dateStr);

			// Update the specific date's Daily Note
			await this.updateDailyNoteForDate(date, data);

			this.updateRibbonIcon(RibbonIconState.ACTIVE);
			this.updateStatusBar(
				`Timing: ✅ Synced ${dateStr} (${new Date().toLocaleTimeString()})`,
			);
			console.log("=== SPECIFIC DATE SYNC DEBUG END ===");

			new Notice(
				`Sync completed for ${dateStr}: ${data.entries.length} entries, ${this.dataTransformer.formatDuration(data.summary.totalTime)} total`,
			);
		} catch (error) {
			console.error("Specific date sync failed:", error);
			this.updateRibbonIcon(RibbonIconState.ERROR);
			this.updateStatusBar("Timing: ❌ Sync failed");
			new Notice(`Timing sync failed for ${date.toISOString().split("T")[0]}: ${error.message}`);
		}
	}

	private async updateDailyNoteForDate(date: Date, data?: any): Promise<void> {
		try {
			console.log("=== DAILY NOTE UPDATE FOR SPECIFIC DATE DEBUG START ===");
			const dateStr = date.toISOString().split("T")[0];
			console.log("Updating Daily Note for date:", dateStr);

			let timingData = data;

			if (!timingData) {
				console.log("No data provided, fetching from cache...");
				timingData = await this.timingDataCache.getDailyData(dateStr);
				if (!timingData) {
					console.log("No cached data, fetching fresh data...");
					timingData = await this.timingIntegration.getTimeDataForDate(date);
				} else {
					console.log("Using cached data");
				}
			} else {
				console.log("Using provided data");
			}

			console.log("Final timing data for Daily Note:", {
				date: timingData.date,
				entriesCount: timingData.entries.length,
				totalTime: timingData.summary.totalTime,
			});

			// Find or create the Daily Note for the specific date
			console.log("Looking for existing Daily Note for", dateStr);
			let dailyNote = await this.dailyNoteManager.findDailyNote(date);

			if (!dailyNote) {
				console.log("Daily Note not found for", dateStr);
				if (this.settings.autoCreateDailyNotes) {
					console.log("Auto-create enabled, creating new Daily Note...");
					dailyNote = await this.dailyNoteManager.createDailyNote(date);
					new Notice(`Created Daily Note for ${dateStr} with timing section`);
					console.log("Daily Note created:", dailyNote.path);
				} else {
					console.log("Auto-create disabled, cannot update Daily Note");
					new Notice(`Daily Note for ${dateStr} not found. Enable auto-creation or create manually.`);
					return;
				}
			} else {
				console.log("Found existing Daily Note:", dailyNote.path);
			}

			if (dailyNote) {
				console.log("Updating timing section in Daily Note...");
				await this.timingSectionManager.updateTimingSection(dailyNote, timingData);
				console.log("Successfully updated Daily Note with timing data");
				new Notice(`Updated Daily Note for ${dateStr} with timing data`);
			} else {
				console.log("No Daily Note available for update");
			}
			console.log("=== DAILY NOTE UPDATE FOR SPECIFIC DATE DEBUG END ===");
		} catch (error) {
			console.error("Failed to update Daily Note for specific date:", error);
			console.error("Error details:", error.stack);
			new Notice(`Failed to update Daily Note for ${date.toISOString().split("T")[0]}: ${error.message}`);
		}
	}

	async openTimelineView(): Promise<void> {
		try {
			// Check if timeline view already exists
			const existingLeaf = this.app.workspace.getLeavesOfType(TIMING_TIMELINE_VIEW_TYPE)[0];

			if (existingLeaf) {
				// Activate existing view
				this.app.workspace.revealLeaf(existingLeaf);
				const view = existingLeaf.view as TimingTimelineView;
				this.timelineView = view;
			} else {
				// Create new view in right sidebar
				const leaf = this.app.workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: TIMING_TIMELINE_VIEW_TYPE,
						active: true,
					});

					const view = leaf.view as TimingTimelineView;
					this.timelineView = view;
				} else {
					throw new Error("Could not create timeline view leaf");
				}
			}

			// Load today's data into the timeline view
			const today = new Date();
			const dateStr = today.toISOString().split("T")[0];
			let timingData = await this.timingDataCache.getDailyData(dateStr);
			
			if (!timingData) {
				timingData = await this.timingIntegration.getTimeDataForDate(today);
				await this.timingDataCache.setDailyData(dateStr, timingData, true);
			}

			this.timelineView.setData(timingData);
			this.timelineView.setDate(today);

		} catch (error) {
			new Notice(`Failed to open timeline view: ${error.message}`);
		}
	}

	private async updateTimelineView(data?: any): Promise<void> {
		if (!this.timelineView) return;

		try {
			const today = new Date();
			let timingData = data;

			if (!timingData) {
				const dateStr = today.toISOString().split("T")[0];
				timingData = await this.timingDataCache.getDailyData(dateStr);
			}

			if (timingData) {
				this.timelineView.setData(timingData);
				this.timelineView.setDate(today);
			}
		} catch (error) {
			console.error("Failed to update timeline view:", error);
		}
	}

	private async checkFirstRun(): Promise<void> {
		const data = (await this.loadData()) || {};
		const hasShownWizard = data.hasShownSetupWizard;

		if (!hasShownWizard) {
			// Delay showing wizard to let Obsidian finish loading
			setTimeout(async () => {
				await this.openSetupWizard();
			}, 2000);
		}
	}

	async openSetupWizard(): Promise<void> {
		const wizard = new SetupWizardModal(
			this.app,
			this.settings,
			this.timingIntegration,
			async (newSettings) => {
				// Update settings with wizard results
				this.settings = newSettings;
				await this.saveSettings();

				// Mark wizard as completed
				const data = (await this.loadData()) || {};
				data.hasShownSetupWizard = true;
				await this.saveData(data);

				new Notice("Timing Plugin setup completed successfully!");

				// Restart background updates with new settings
				if (this.settings.enableTimeTracking) {
					await this.startBackgroundUpdates();
				}
			},
		);
		wizard.open();
	}

	private updateRibbonIcon(state: RibbonIconState): void {
		if (!this.ribbonIconEl) return;

		// Remove all state classes
		this.ribbonIconEl.removeClass(
			"timing-active",
			"timing-warning",
			"timing-error",
			"timing-syncing",
			"timing-disabled",
		);

		// Add current state class
		this.ribbonIconEl.addClass(state);

		// Update tooltip
		const tooltips = {
			[RibbonIconState.ACTIVE]:
				"Timing: Active - Click to open settings, Shift+click to sync",
			[RibbonIconState.WARNING]: "Timing: Warning - Check settings",
			[RibbonIconState.ERROR]: "Timing: Error - Not connected",
			[RibbonIconState.SYNCING]: "Timing: Syncing data...",
			[RibbonIconState.DISABLED]: "Timing: Disabled",
		};

		this.ribbonIconEl.setAttribute("aria-label", tooltips[state]);
		this.ribbonIconEl.setAttribute("title", tooltips[state]);
	}

	private updateStatusBar(text: string): void {
		if (this.statusBarItemEl) {
			this.statusBarItemEl.setText(text);
		}
	}

	private async openTimingDataView(
		timingData: any,
		onConfirm?: (data: any) => void,
	): Promise<void> {
		// Check if view already exists
		const existingLeaf = this.app.workspace.getLeavesOfType(
			TIMING_DATA_VIEW_TYPE,
		)[0];

		if (existingLeaf) {
			// Activate existing view and update data
			this.app.workspace.revealLeaf(existingLeaf);
			const view = existingLeaf.view as TimingDataView;
			view.setData(timingData, onConfirm);
			view.updateSettings(this.settings);
		} else {
			// Create new view
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({
				type: TIMING_DATA_VIEW_TYPE,
				active: true,
			});

			const view = leaf.view as TimingDataView;
			view.setData(timingData, onConfirm);
			view.updateSettings(this.settings);
		}
	}

	// Weekly Notes methods
	async updateCurrentWeeklyNote(): Promise<void> {
		if (!this.settings.enableWeeklyNotes) {
			new Notice("Weekly Notes integration is disabled");
			return;
		}

		try {
			await this.updateWeeklyNote(new Date());
			new Notice("Updated current Weekly Note with timing data");
		} catch (error) {
			new Notice(`Failed to update Weekly Note: ${error.message}`);
		}
	}

	async createWeeklyNoteWithTiming(): Promise<void> {
		if (!this.settings.enableWeeklyNotes) {
			new Notice("Weekly Notes integration is disabled");
			return;
		}

		try {
			const today = new Date();
			const existingNote = await this.weeklyNoteManager.findWeeklyNote(today);
			
			if (existingNote) {
				new Notice('Weekly Note already exists. Use "Update current Weekly Note" instead.');
				return;
			}

			const weeklyNote = await this.weeklyNoteManager.createWeeklyNote(today);
			await this.updateWeeklyNote(today);
			await this.app.workspace.getLeaf().openFile(weeklyNote);

			new Notice("Created Weekly Note with timing section");
		} catch (error) {
			new Notice(`Failed to create Weekly Note: ${error.message}`);
		}
	}

	async openCurrentWeeklyNote(): Promise<void> {
		if (!this.settings.enableWeeklyNotes) {
			new Notice("Weekly Notes integration is disabled");
			return;
		}

		try {
			const today = new Date();
			let weeklyNote = await this.weeklyNoteManager.findWeeklyNote(today);

			if (!weeklyNote && this.settings.autoCreateWeeklyNotes) {
				weeklyNote = await this.weeklyNoteManager.createWeeklyNote(today);
			}

			if (weeklyNote) {
				await this.app.workspace.getLeaf().openFile(weeklyNote);
			} else {
				new Notice("Weekly Note not found. Enable auto-creation or create manually.");
			}
		} catch (error) {
			new Notice(`Failed to open Weekly Note: ${error.message}`);
		}
	}

	async syncWeeklyData(): Promise<void> {
		if (!this.settings.enableWeeklyNotes) {
			new Notice("Weekly Notes integration is disabled");
			return;
		}

		try {
			this.updateStatusBar("Timing: Syncing weekly data...");
			await this.updateWeeklyNote(new Date());
			this.updateStatusBar("Timing: ✅ Weekly data synced");
			new Notice("Weekly timing data synced successfully");
		} catch (error) {
			console.error("Weekly sync failed:", error);
			this.updateStatusBar("Timing: ❌ Weekly sync failed");
			new Notice(`Weekly sync failed: ${error.message}`);
		}
	}

	private async updateWeeklyNote(date: Date): Promise<void> {
		const weekInfo = this.weeklyNoteManager.getWeekInfo(date);
		const dailyDataMap = new Map();

		// Collect daily data for the week
		const currentDate = new Date(weekInfo.weekStart);
		for (let i = 0; i < 7; i++) {
			const dateStr = currentDate.toISOString().split('T')[0];
			
			try {
				let dailyData = await this.timingDataCache.getDailyData(dateStr);
				if (!dailyData) {
					dailyData = await this.timingIntegration.getTimeDataForDate(currentDate);
					await this.timingDataCache.setDailyData(dateStr, dailyData, true);
				}
				dailyDataMap.set(dateStr, dailyData);
			} catch (error) {
				console.warn(`Failed to get data for ${dateStr}:`, error);
				// Continue with empty data for this day
			}
			
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Aggregate weekly data
		const weeklyData = this.weeklyNoteManager.aggregateWeeklyData(dailyDataMap, weekInfo);

		// Find or create Weekly Note
		let weeklyNote = await this.weeklyNoteManager.findWeeklyNote(date);
		if (!weeklyNote && this.settings.autoCreateWeeklyNotes) {
			weeklyNote = await this.weeklyNoteManager.createWeeklyNote(date);
		}

		if (weeklyNote) {
			await this.weeklySectionManager.updateWeeklyTimingSection(weeklyNote, weeklyData);
		} else {
			throw new Error("Weekly Note not found and auto-creation is disabled");
		}
	}
}

class TimingSettingTab extends PluginSettingTab {
	plugin: TimingPlugin;

	constructor(app: App, plugin: TimingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Header
		containerEl.createEl("h2", { text: "Timing Plugin Settings" });

		// Connection Status Section
		this.addConnectionStatusSection(containerEl);

		// Basic Settings Section
		this.addBasicSettingsSection(containerEl);

		// Daily Notes Integration Section
		this.addDailyNotesSection(containerEl);

		// Display Settings Section
		this.addDisplaySettingsSection(containerEl);

		// Weekly Notes Section
		this.addWeeklyNotesSection(containerEl);

		// Advanced Settings Section
		this.addAdvancedSettingsSection(containerEl);

		// Actions Section
		this.addActionsSection(containerEl);
	}

	private addConnectionStatusSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Connection Status" });

		const statusDiv = containerEl.createDiv("timing-connection-status");
		statusDiv.createEl("p", {
			text: 'Click "Test Connection" to verify Timing app integration.',
		});
	}

	private addBasicSettingsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Basic Settings" });

		new Setting(containerEl)
			.setName("Enable Time Tracking")
			.setDesc("Enable automatic time tracking with Timing app")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTimeTracking)
					.onChange(async (value) => {
						this.plugin.settings.enableTimeTracking = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Update Interval")
			.setDesc("How often to sync data from Timing app (in minutes)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 60, 1)
					.setValue(this.plugin.settings.updateInterval / (60 * 1000))
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.updateInterval = value * 60 * 1000;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Timing App Path")
			.setDesc("Path to the Timing application")
			.addText((text) =>
				text
					.setPlaceholder("/Applications/Timing.app")
					.setValue(this.plugin.settings.timingAppPath)
					.onChange(async (value) => {
						this.plugin.settings.timingAppPath = value;
						await this.plugin.saveSettings();
					}),
			);
	}

	private addDailyNotesSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Daily Notes Integration" });

		new Setting(containerEl)
			.setName("Date Format")
			.setDesc("Date format for Daily Notes")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("YYYY-MM-DD", "YYYY-MM-DD (2025-06-18)")
					.addOption("YYYY/MM/DD", "YYYY/MM/DD (2025/06/18)")
					.addOption("DD-MM-YYYY", "DD-MM-YYYY (18-06-2025)")
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Daily Notes Folder")
			.setDesc("Folder for Daily Notes (leave empty for root)")
			.addText((text) =>
				text
					.setPlaceholder("Daily")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-create Daily Notes")
			.setDesc("Automatically create Daily Notes if they don't exist")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateDailyNotes)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateDailyNotes = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Timing Section Location")
			.setDesc("Where to place the timing section in Daily Notes")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("top", "Top of note")
					.addOption("bottom", "Bottom of note")
					.addOption("after-header", "After specific header")
					.setValue(this.plugin.settings.timingSectionLocation)
					.onChange(async (value) => {
						this.plugin.settings.timingSectionLocation =
							value as any;
						await this.plugin.saveSettings();
					}),
			);
	}

	private addDisplaySettingsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Display Settings" });

		new Setting(containerEl)
			.setName("Include Timeline")
			.setDesc("Show detailed activity timeline")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeTimeline)
					.onChange(async (value) => {
						this.plugin.settings.includeTimeline = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include Reflection Section")
			.setDesc("Add a section for daily time usage reflection")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeReflection)
					.onChange(async (value) => {
						this.plugin.settings.includeReflection = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Group By")
			.setDesc("How to group time tracking data")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("application", "Application only")
					.addOption("category", "Category only")
					.addOption("both", "Both application and category")
					.setValue(this.plugin.settings.groupBy)
					.onChange(async (value) => {
						this.plugin.settings.groupBy = value as any;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Time Format")
			.setDesc("Time display format")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("24h", "24-hour (14:30)")
					.addOption("12h", "12-hour (2:30 PM)")
					.setValue(this.plugin.settings.timeFormat)
					.onChange(async (value) => {
						this.plugin.settings.timeFormat = value as any;
						await this.plugin.saveSettings();
					}),
			);
	}

	private addWeeklyNotesSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Weekly Notes Integration" });

		new Setting(containerEl)
			.setName("Enable Weekly Notes")
			.setDesc("Enable automatic Weekly Notes integration")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableWeeklyNotes)
					.onChange(async (value) => {
						this.plugin.settings.enableWeeklyNotes = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Weekly Notes Folder")
			.setDesc("Folder for Weekly Notes (leave empty for root)")
			.addText((text) =>
				text
					.setPlaceholder("Weekly")
					.setValue(this.plugin.settings.weeklyNotesFolder)
					.onChange(async (value) => {
						this.plugin.settings.weeklyNotesFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Weekly Date Format")
			.setDesc("Format for Weekly Note filenames")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("YYYY-[W]WW", "2025-W25 (ISO week)")
					.addOption("YYYY-MM-DD", "2025-06-16 (week start date)")
					.addOption("GGGG-[W]WW", "2025-W25 (ISO year-week)")
					.setValue(this.plugin.settings.weeklyDateFormat)
					.onChange(async (value) => {
						this.plugin.settings.weeklyDateFormat = value as any;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Week Starts On")
			.setDesc("First day of the week")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("monday", "Monday")
					.addOption("sunday", "Sunday")
					.setValue(this.plugin.settings.weekStartsOn)
					.onChange(async (value) => {
						this.plugin.settings.weekStartsOn = value as any;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-create Weekly Notes")
			.setDesc("Automatically create Weekly Notes if they don't exist")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateWeeklyNotes)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateWeeklyNotes = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include Weekly Summary")
			.setDesc("Include detailed weekly productivity summary")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeWeeklySummary)
					.onChange(async (value) => {
						this.plugin.settings.includeWeeklySummary = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include Weekly Reflection")
			.setDesc("Add a section for weekly time management reflection")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeWeeklyReflection)
					.onChange(async (value) => {
						this.plugin.settings.includeWeeklyReflection = value;
						await this.plugin.saveSettings();
					}),
			);
	}

	private addAdvancedSettingsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Advanced Settings" });

		new Setting(containerEl)
			.setName("Minimum Duration")
			.setDesc("Minimum duration (in seconds) to include in tracking")
			.addText((text) =>
				text
					.setPlaceholder("60")
					.setValue(String(this.plugin.settings.minimumDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.minimumDuration = num;
							await this.plugin.saveSettings();
						}
					}),
			);
	}

	private addActionsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Actions" });

		new Setting(containerEl)
			.setName("Test Connection")
			.setDesc("Test connection to Timing app")
			.addButton((button) =>
				button.setButtonText("Test Connection").onClick(async () => {
					await this.plugin.testConnection();
				}),
			);

		new Setting(containerEl)
			.setName("Preview Data")
			.setDesc(
				"Open timing data in dedicated view with detailed visualization",
			)
			.addButton((button) =>
				button.setButtonText("Open Data View").onClick(async () => {
					await this.plugin.previewTimingData();
				}),
			);

		new Setting(containerEl)
			.setName("Timeline View")
			.setDesc(
				"Open timeline view in sidebar with visual timeline representation",
			)
			.addButton((button) =>
				button.setButtonText("Open Timeline").onClick(async () => {
					await this.plugin.openTimelineView();
				}),
			);

		new Setting(containerEl)
			.setName("Sync Now")
			.setDesc("Manually sync timing data")
			.addButton((button) =>
				button.setButtonText("Sync Now").onClick(async () => {
					await this.plugin.syncDataNow();
				}),
			);

		new Setting(containerEl)
			.setName("Sync Specific Date")
			.setDesc("Sync timing data for a specific date")
			.addButton((button) =>
				button.setButtonText("Select Date").onClick(async () => {
					await this.plugin.openDatePickerForSync();
				}),
			);

		new Setting(containerEl)
			.setName("Setup Wizard")
			.setDesc(
				"Re-run the initial setup wizard to reconfigure the plugin",
			)
			.addButton((button) =>
				button.setButtonText("Open Setup Wizard").onClick(async () => {
					await this.plugin.openSetupWizard();
				}),
			);

		new Setting(containerEl)
			.setName("Clear Cache")
			.setDesc("Clear all cached timing data")
			.addButton((button) =>
				button
					.setButtonText("Clear Cache")
					.setWarning()
					.onClick(async () => {
						await this.plugin.clearCache();
					}),
			);
	}
}

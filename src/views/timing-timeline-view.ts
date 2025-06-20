import { ItemView, WorkspaceLeaf } from "obsidian";
import { TimingPluginSettings, DailyTimeData, TimeEntry } from "../types";
import { TimeBlockGrouper, TimeBlock } from "../utils/time-block-grouper";

export const TIMING_TIMELINE_VIEW_TYPE = "timing-timeline-view";

export class TimingTimelineView extends ItemView {
	private settings: TimingPluginSettings;
	private currentData: DailyTimeData | null = null;
	private selectedDate: Date = new Date();
	private zoomLevel: number = 1.5; // 1.5 = normal, 1.0 = compact, 2.5 = detailed
	private readonly zoomPresets = {
		compact: { level: 1.0, name: "Compact" },
		normal: { level: 1.5, name: "Normal" },
		detailed: { level: 3.0, name: "Detailed" },
		"ultra-detailed": { level: 6.0, name: "Ultra" }
	};

	constructor(leaf: WorkspaceLeaf, settings: TimingPluginSettings) {
		super(leaf);
		this.settings = settings;
		this.loadZoomSettings();
	}

	getViewType(): string {
		return TIMING_TIMELINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Timing Timeline";
	}

	getIcon(): string {
		return "clock";
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		this.renderTimelineView(container);
	}

	async onClose() {
		// Cleanup if needed
	}

	setData(data: DailyTimeData | null) {
		this.currentData = data;
		this.refreshView();
	}

	setDate(date: Date) {
		this.selectedDate = date;
		this.refreshView();
	}

	updateSettings(settings: TimingPluginSettings) {
		this.settings = settings;
		this.refreshView();
	}

	private refreshView() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		this.renderTimelineView(container);
	}

	private renderTimelineView(container: HTMLElement) {
		container.createEl("div", { cls: "timing-timeline-container" }, (containerEl) => {
			// Header with date selector
			this.renderHeader(containerEl);
			
			// Timeline content
			this.renderTimeline(containerEl);
			
			// Summary footer
			this.renderSummary(containerEl);
		});

		// Add custom styles
		this.addStyles();
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createEl("div", { cls: "timing-timeline-header" });
		
		// Top row: Date navigation and zoom controls
		const topRow = header.createEl("div", { cls: "timing-header-top-row" });
		
		// Date navigation
		const dateNav = topRow.createEl("div", { cls: "timing-date-nav" });
		
		const prevBtn = dateNav.createEl("button", { 
			text: "←", 
			cls: "timing-nav-btn" 
		});
		prevBtn.onclick = () => {
			this.selectedDate.setDate(this.selectedDate.getDate() - 1);
			this.refreshView();
		};

		const dateDisplay = dateNav.createEl("span", { 
			text: this.formatDate(this.selectedDate),
			cls: "timing-date-display"
		});

		const nextBtn = dateNav.createEl("button", { 
			text: "→", 
			cls: "timing-nav-btn" 
		});
		nextBtn.onclick = () => {
			this.selectedDate.setDate(this.selectedDate.getDate() + 1);
			this.refreshView();
		};


		// Bottom row: Status
		const bottomRow = header.createEl("div", { cls: "timing-header-bottom-row" });
		const status = bottomRow.createEl("div", { cls: "timing-status" });
		
		if (this.currentData && this.currentData.entries.length > 0) {
			status.createEl("span", { 
				text: "●", 
				cls: "timing-status-active" 
			});
			status.createEl("span", { 
				text: ` ${this.currentData.entries.length} activities`,
				cls: "timing-status-text"
			});
		} else {
			status.createEl("span", { 
				text: "○", 
				cls: "timing-status-inactive" 
			});
			status.createEl("span", { 
				text: " No data",
				cls: "timing-status-text"
			});
		}
	}

	private renderTimeline(container: HTMLElement) {
		const timelineContainer = container.createEl("div", { cls: "timing-timeline-content" });

		// Add mouse wheel zoom support
		timelineContainer.addEventListener('wheel', (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				// Adjust zoom sensitivity based on current zoom level
				const baseDelta = e.deltaY > 0 ? -0.1 : 0.1;
				const sensitivity = this.zoomLevel > 5 ? 0.5 : (this.zoomLevel > 3 ? 0.3 : 1);
				const delta = baseDelta * sensitivity;
				this.adjustZoom(delta);
			}
		});

		if (!this.currentData || this.currentData.entries.length === 0) {
			timelineContainer.createEl("div", { 
				text: "No timing data available for this date",
				cls: "timing-no-data"
			});
			return;
		}

		// Create timeline scale (24 hours)
		this.renderTimeScale(timelineContainer);
		
		// Create timeline entries
		this.renderTimelineEntries(timelineContainer);
	}

	private renderTimeScale(container: HTMLElement) {
		const scale = container.createEl("div", { cls: "timing-time-scale" });
		
		// Set height to match the entries container
		const baseHeight = 800;
		const scaledHeight = baseHeight * this.zoomLevel;
		scale.style.height = `${scaledHeight}px`;
		
		// Adjust time scale interval based on zoom level
		let interval = 3; // Default: every 3 hours
		if (this.zoomLevel < 1.2) {
			interval = 6; // Compact: every 6 hours
		} else if (this.zoomLevel > 4) {
			interval = 0.5; // Ultra detailed: every 30 minutes
		} else if (this.zoomLevel > 2) {
			interval = 1; // Detailed: every hour
		}
		
		for (let time = 0; time < 24; time += interval) {
			const timeMarker = scale.createEl("div", { cls: "timing-time-marker" });
			
			// Format time display for fractional hours (30-minute intervals)
			const hours = Math.floor(time);
			const minutes = Math.round((time - hours) * 60);
			const timeText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
			
			timeMarker.createEl("span", { 
				text: timeText,
				cls: "timing-time-label"
			});
			timeMarker.style.position = 'absolute';
			timeMarker.style.top = `${(time / 24) * 100}%`;
		}
	}

	private renderTimelineEntries(container: HTMLElement) {
		const entriesContainer = container.createEl("div", { cls: "timing-entries-container" });
		
		// Set height based on zoom level for proper scaling
		const baseHeight = 800; // Base height for 24 hours (increased for better visibility)
		const scaledHeight = baseHeight * this.zoomLevel;
		entriesContainer.style.height = `${scaledHeight}px`;
		entriesContainer.style.position = 'relative';
		
		// Group entries into time blocks
		const timeBlocks = TimeBlockGrouper.groupIntoTimeBlocks(this.currentData!.entries, {
			mergeThreshold: 5, // 5 minutes gap
			minimumBlockDuration: this.settings.minimumDuration,
			groupBy: this.settings.groupBy === 'both' ? 'application' : this.settings.groupBy as any
		});

		// Render each time block at its precise time position
		timeBlocks.forEach(timeBlock => {
			this.renderPositionedTimeBlock(entriesContainer, timeBlock);
		});
	}

	private renderPositionedTimeBlock(container: HTMLElement, timeBlock: TimeBlock) {
		const blockEl = container.createEl("div", { cls: "timing-time-block timing-positioned-block" });
		
		// Calculate position and height based on actual time
		const startMinutes = this.timeToMinutes(timeBlock.startTime);
		const endMinutes = this.timeToMinutes(timeBlock.endTime);
		const totalMinutes = 24 * 60;
		
		const topPercentage = (startMinutes / totalMinutes) * 100;
		const heightPercentage = ((endMinutes - startMinutes) / totalMinutes) * 100;
		
		blockEl.style.position = 'absolute';
		blockEl.style.top = `${topPercentage}%`;
		blockEl.style.height = `${Math.max(heightPercentage, 0.1)}%`; // Minimum height
		blockEl.style.left = '0';
		blockEl.style.right = '0';
		blockEl.style.margin = '0 4px';
		
		// Full background color like Timing app - use solid colors
		const appColor = this.getAppColor(timeBlock.application);
		blockEl.style.backgroundColor = appColor;
		blockEl.style.border = 'none';
		blockEl.style.opacity = '1';
		blockEl.style.minHeight = '3px';
		
		// Hover event for showing detailed dialog
		let hoverTimeout: NodeJS.Timeout;
		
		blockEl.addEventListener('mouseenter', () => {
			hoverTimeout = setTimeout(() => {
				this.showBlockDialog(timeBlock, blockEl);
			}, 500); // Show dialog after 500ms hover
		});
		
		blockEl.addEventListener('mouseleave', () => {
			if (hoverTimeout) {
				clearTimeout(hoverTimeout);
			}
			this.hideBlockDialog();
		});

		// Click handler for block details
		blockEl.onclick = () => {
			this.showBlockDetails(timeBlock);
		};
	}

	private timeToMinutes(timeString: string): number {
		const [hours, minutes] = timeString.split(':').map(Number);
		return hours * 60 + minutes;
	}

	private renderHourBlock(container: HTMLElement, hour: number, timeBlocks: TimeBlock[]) {
		const hourBlock = container.createEl("div", { cls: "timing-hour-block" });
		
		// Calculate position based on actual time
		const startMinutes = hour * 60;
		const totalMinutes = 24 * 60;
		const topPercentage = (startMinutes / totalMinutes) * 100;
		hourBlock.style.top = `${topPercentage}%`;
		hourBlock.style.position = 'absolute';
		hourBlock.style.width = '100%';
		
		// Time blocks for this hour
		const blocksList = hourBlock.createEl("div", { cls: "timing-hour-blocks" });
		
		timeBlocks.forEach(timeBlock => {
			this.renderTimeBlock(blocksList, timeBlock);
		});
	}

	private renderTimeBlock(container: HTMLElement, timeBlock: TimeBlock) {
		const blockEl = container.createEl("div", { cls: "timing-time-block" });
		
		// Calculate visual height based on duration and zoom level
		let basePixelsPerMinute = 2; // Default
		if (this.zoomLevel < 1.2) {
			basePixelsPerMinute = 1; // Compact
		} else if (this.zoomLevel > 6) {
			basePixelsPerMinute = 8; // Ultra detailed
		} else if (this.zoomLevel > 3) {
			basePixelsPerMinute = 6; // Very detailed
		} else if (this.zoomLevel > 2) {
			basePixelsPerMinute = 4; // Detailed
		}
		
		const blockHeight = TimeBlockGrouper.calculateBlockHeight(timeBlock, {
			minHeight: Math.max(20, 30 * this.zoomLevel), // Scale relative to zoom level
			maxHeight: 500 * this.zoomLevel, // Increased max height for ultra zoom
			pixelsPerMinute: basePixelsPerMinute * this.zoomLevel
		});
		blockEl.style.minHeight = `${blockHeight}px`;
		
		// Color bar on the left
		const colorBar = blockEl.createEl("div", { cls: "timing-block-color-bar" });
		colorBar.style.backgroundColor = this.getAppColor(timeBlock.application);
		
		// Main content area
		const content = blockEl.createEl("div", { cls: "timing-block-content" });
		
		// Header with main info
		const header = content.createEl("div", { cls: "timing-block-header" });
		const isCompact = this.getCompactDisplay();
		
		if (isCompact) {
			// Compact mode: single line with essential info
			const compactInfo = header.createEl("div", { cls: "timing-block-compact" });
			compactInfo.createEl("span", { 
				text: `${timeBlock.startTime}`,
				cls: "timing-compact-time"
			});
			compactInfo.createEl("span", { 
				text: timeBlock.application,
				cls: "timing-compact-app"
			});
			compactInfo.createEl("span", { 
				text: TimeBlockGrouper.formatBlockDuration(timeBlock),
				cls: "timing-compact-duration"
			});
		} else {
			// Normal/detailed mode
			const timeRange = header.createEl("div", { 
				text: `${timeBlock.startTime} - ${timeBlock.endTime}`,
				cls: "timing-block-time-range"
			});
			
			const title = header.createEl("div", { 
				text: timeBlock.title,
				cls: "timing-block-title"
			});
			
			const duration = header.createEl("div", { 
				text: TimeBlockGrouper.formatBlockDuration(timeBlock),
				cls: "timing-block-duration"
			});
		}

		// Expandable section for multiple entries (only in normal/detailed mode)
		if (timeBlock.entries.length > 1 && !isCompact) {
			const expandBtn = header.createEl("button", { 
				text: timeBlock.isExpanded ? "▼" : "▶",
				cls: "timing-expand-btn"
			});
			
			const entriesContainer = content.createEl("div", { 
				cls: "timing-block-entries" 
			});
			entriesContainer.style.display = timeBlock.isExpanded ? "block" : "none";
			
			// Render individual entries
			timeBlock.entries.forEach(entry => {
				this.renderBlockEntry(entriesContainer, entry);
			});
			
			// Toggle expand/collapse
			expandBtn.onclick = (e) => {
				e.stopPropagation();
				timeBlock.isExpanded = !timeBlock.isExpanded;
				expandBtn.textContent = timeBlock.isExpanded ? "▼" : "▶";
				entriesContainer.style.display = timeBlock.isExpanded ? "block" : "none";
			};
		}

		// Click handler for block details
		blockEl.onclick = () => {
			this.showBlockDetails(timeBlock);
		};
	}

	private renderBlockEntry(container: HTMLElement, entry: TimeEntry) {
		const entryEl = container.createEl("div", { cls: "timing-block-entry" });
		
		const entryTime = entryEl.createEl("span", { 
			text: `${entry.startTime} - ${entry.endTime}`,
			cls: "timing-entry-time"
		});
		
		const entryDuration = entryEl.createEl("span", { 
			text: this.formatDuration(entry.duration),
			cls: "timing-entry-duration"
		});

		if (entry.title && entry.title !== `${entry.application} - ${entry.category}`) {
			const entryTitle = entryEl.createEl("div", { 
				text: entry.title,
				cls: "timing-entry-title"
			});
		}
	}

	private renderSummary(container: HTMLElement) {
		if (!this.currentData) return;

		const summary = container.createEl("div", { cls: "timing-timeline-summary" });
		
		const totalTime = summary.createEl("div", { cls: "timing-summary-item" });
		totalTime.createEl("span", { text: "Total: ", cls: "timing-summary-label" });
		totalTime.createEl("span", { 
			text: this.formatDuration(this.currentData.summary.totalTime),
			cls: "timing-summary-value"
		});

		// Top 3 applications
		const topApps = Array.from(this.currentData.summary.byApplication.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);

		if (topApps.length > 0) {
			const topAppsEl = summary.createEl("div", { cls: "timing-top-apps" });
			topAppsEl.createEl("div", { text: "Top Apps:", cls: "timing-summary-label" });
			
			topApps.forEach(([app, time]) => {
				const appItem = topAppsEl.createEl("div", { cls: "timing-top-app-item" });
				appItem.createEl("span", { text: app, cls: "timing-app-name-small" });
				appItem.createEl("span", { 
					text: this.formatDuration(time),
					cls: "timing-app-time-small"
				});
			});
		}
	}

	private showBlockDetails(timeBlock: TimeBlock) {
		console.log("Time block details:", timeBlock);
		// TODO: Show detailed modal or expand inline
	}

	private currentDialog: HTMLElement | null = null;

	private showBlockDialog(timeBlock: TimeBlock, blockEl: HTMLElement) {
		// Remove any existing dialog
		this.hideBlockDialog();
		
		// Create dialog
		const dialog = document.createElement('div');
		dialog.className = 'timing-block-dialog';
		
		// Dialog content
		const content = dialog.createEl('div', { cls: 'timing-dialog-content' });
		
		// Header with time and duration
		const header = content.createEl('div', { cls: 'timing-dialog-header' });
		
		const timeDisplay = header.createEl('div', { cls: 'timing-dialog-time' });
		timeDisplay.createEl('div', { 
			text: `${timeBlock.startTime} - ${timeBlock.endTime}`,
			cls: 'timing-dialog-time-range'
		});
		timeDisplay.createEl('div', { 
			text: TimeBlockGrouper.formatBlockDuration(timeBlock),
			cls: 'timing-dialog-duration'
		});
		
		// App info
		const appInfo = content.createEl('div', { cls: 'timing-dialog-app' });
		const appIcon = appInfo.createEl('div', { cls: 'timing-dialog-app-icon' });
		appIcon.style.backgroundColor = this.getAppColor(timeBlock.application);
		appIcon.textContent = timeBlock.application.charAt(0).toUpperCase();
		
		const appDetails = appInfo.createEl('div', { cls: 'timing-dialog-app-details' });
		appDetails.createEl('div', { 
			text: timeBlock.application,
			cls: 'timing-dialog-app-name'
		});
		if (timeBlock.category) {
			appDetails.createEl('div', { 
				text: timeBlock.category,
				cls: 'timing-dialog-category'
			});
		}
		
		// Title if different from app name
		if (timeBlock.title && timeBlock.title !== timeBlock.application) {
			content.createEl('div', { 
				text: timeBlock.title,
				cls: 'timing-dialog-title'
			});
		}
		
		// Multiple entries section
		if (timeBlock.entries.length > 1) {
			const entriesHeader = content.createEl('div', { 
				text: `${timeBlock.entries.length} Activities`,
				cls: 'timing-dialog-entries-header'
			});
			
			const entriesList = content.createEl('div', { cls: 'timing-dialog-entries-list' });
			timeBlock.entries.forEach(entry => {
				const entryEl = entriesList.createEl('div', { cls: 'timing-dialog-entry' });
				entryEl.createEl('span', { 
					text: `${entry.startTime} - ${entry.endTime}`,
					cls: 'timing-dialog-entry-time'
				});
				entryEl.createEl('span', { 
					text: this.formatDuration(entry.duration),
					cls: 'timing-dialog-entry-duration'
				});
				if (entry.title && entry.title !== timeBlock.title) {
					entryEl.createEl('div', { 
						text: entry.title,
						cls: 'timing-dialog-entry-title'
					});
				}
			});
		}
		
		// Position dialog near the block
		const blockRect = blockEl.getBoundingClientRect();
		const containerRect = this.containerEl.getBoundingClientRect();
		
		dialog.style.position = 'fixed';
		dialog.style.left = `${blockRect.right + 10}px`;
		dialog.style.top = `${blockRect.top}px`;
		dialog.style.zIndex = '1000';
		
		// Adjust position if dialog would go off screen
		const dialogWidth = 300; // Estimated width
		if (blockRect.right + dialogWidth + 20 > window.innerWidth) {
			dialog.style.left = `${blockRect.left - dialogWidth - 10}px`;
		}
		
		document.body.appendChild(dialog);
		this.currentDialog = dialog;
		
		// Animate in
		setTimeout(() => {
			dialog.style.opacity = '1';
			dialog.style.transform = 'translateY(0)';
		}, 10);
	}

	private hideBlockDialog() {
		if (this.currentDialog) {
			this.currentDialog.style.opacity = '0';
			this.currentDialog.style.transform = 'translateY(-10px)';
			setTimeout(() => {
				if (this.currentDialog) {
					document.body.removeChild(this.currentDialog);
					this.currentDialog = null;
				}
			}, 200);
		}
	}

	private adjustZoom(delta: number) {
		const newZoom = Math.max(0.3, Math.min(10, this.zoomLevel + delta));
		this.setZoom(newZoom);
	}

	private setZoom(zoomLevel: number) {
		this.zoomLevel = zoomLevel;
		this.saveZoomSettings();
		this.refreshView();
	}

	private loadZoomSettings() {
		const saved = localStorage.getItem('timing-timeline-zoom');
		if (saved) {
			try {
				const savedZoom = parseFloat(saved);
				// Convert old zoom values to new range if needed
				if (savedZoom > 3) {
					this.zoomLevel = savedZoom * 0.6; // Convert old large values to new range
				} else {
					this.zoomLevel = savedZoom;
				}
			} catch (e) {
				this.zoomLevel = 1.5;
			}
		} else {
			this.zoomLevel = 1.5; // Default to normal
		}
	}

	private saveZoomSettings() {
		localStorage.setItem('timing-timeline-zoom', this.zoomLevel.toString());
	}

	private getCompactDisplay(): boolean {
		return this.zoomLevel < 1.2; // Below 1.2 is compact
	}

	private getAppColor(appName: string): string {
		// Predefined solid colors for better visibility
		const colors = [
			'#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
			'#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
			'#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD',
			'#5DADE2', '#58D68D', '#F4D03F', '#EB984E', '#85C1E9'
		];
		
		// Hash app name to get consistent color
		let hash = 0;
		for (let i = 0; i < appName.length; i++) {
			hash = appName.charCodeAt(i) + ((hash << 5) - hash);
		}
		
		return colors[Math.abs(hash) % colors.length];
	}

	private darkenColor(color: string, amount: number): string {
		// Parse RGB color and darken it
		const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (rgbMatch) {
			const [, r, g, b] = rgbMatch;
			const newR = Math.max(0, Math.round(parseInt(r) * (1 - amount)));
			const newG = Math.max(0, Math.round(parseInt(g) * (1 - amount)));
			const newB = Math.max(0, Math.round(parseInt(b) * (1 - amount)));
			return `rgb(${newR}, ${newG}, ${newB})`;
		}
		return color;
	}

	private formatDuration(seconds: number): string {
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

	private formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { 
			weekday: 'short', 
			month: 'short', 
			day: 'numeric' 
		});
	}


	private addStyles() {
		if (document.getElementById('timing-timeline-styles')) return;

		const style = document.createElement('style');
		style.id = 'timing-timeline-styles';
		style.textContent = `
			.timing-timeline-container {
				padding: 10px;
				height: 100%;
				display: flex;
				flex-direction: column;
			}

			.timing-timeline-header {
				padding: 10px 0;
				border-bottom: 1px solid var(--background-modifier-border);
				margin-bottom: 10px;
			}

			.timing-header-top-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 8px;
			}

			.timing-header-bottom-row {
				display: flex;
				justify-content: center;
			}

			.timing-date-nav {
				display: flex;
				align-items: center;
				gap: 10px;
			}

			.timing-nav-btn {
				background: var(--interactive-normal);
				border: none;
				border-radius: 3px;
				padding: 5px 8px;
				cursor: pointer;
				color: var(--text-normal);
			}

			.timing-nav-btn:hover {
				background: var(--interactive-hover);
			}

			.timing-date-display {
				font-weight: bold;
				color: var(--text-normal);
			}

			.timing-zoom-controls {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.timing-zoom-btn {
				background: var(--interactive-normal);
				border: none;
				border-radius: 3px;
				padding: 4px 8px;
				cursor: pointer;
				color: var(--text-normal);
				font-weight: bold;
			}

			.timing-zoom-btn:hover {
				background: var(--interactive-hover);
			}

			.timing-zoom-display {
				font-size: 0.9em;
				color: var(--text-muted);
				min-width: 40px;
				text-align: center;
			}

			.timing-zoom-presets {
				display: flex;
				gap: 4px;
				margin-left: 8px;
			}

			.timing-preset-btn {
				background: var(--background-secondary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 3px;
				padding: 3px 8px;
				cursor: pointer;
				color: var(--text-muted);
				font-size: 0.8em;
				transition: all 0.2s;
			}

			.timing-preset-btn:hover {
				background: var(--interactive-hover);
				color: var(--text-normal);
			}

			.timing-preset-btn.active {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border-color: var(--interactive-accent);
			}

			.timing-status {
				display: flex;
				align-items: center;
				gap: 5px;
			}

			.timing-status-active {
				color: var(--text-success);
			}

			.timing-status-inactive {
				color: var(--text-muted);
			}

			.timing-status-text {
				font-size: 0.9em;
				color: var(--text-muted);
			}

			.timing-timeline-content {
				flex: 1;
				position: relative;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 5px;
				background: var(--background-secondary);
			}

			.timing-time-scale {
				position: absolute;
				left: 0;
				top: 0;
				width: 60px;
				border-right: 1px solid var(--background-modifier-border);
				background: var(--background-primary);
			}

			.timing-time-marker {
				position: absolute;
				left: 0;
				width: 100%;
				height: 1px;
				border-top: 1px dashed var(--background-modifier-border);
			}

			.timing-time-label {
				position: absolute;
				top: -8px;
				left: 5px;
				font-size: 0.8em;
				color: var(--text-muted);
			}

			.timing-entries-container {
				margin-left: 60px;
				padding: 10px;
			}

			.timing-hour-block {
				position: relative;
				margin-bottom: 20px;
			}

			.timing-hour-label {
				font-weight: bold;
				color: var(--text-normal);
				margin-bottom: 5px;
			}

			.timing-hour-blocks {
				margin-left: 10px;
			}

			.timing-time-block {
				display: block;
				margin: 2px 0;
				border-radius: 4px;
				overflow: hidden;
				cursor: pointer;
				transition: all 0.2s;
				position: relative;
				opacity: 1 !important;
				min-height: 2px;
			}

			.timing-time-block:hover {
				transform: translateY(-1px);
				box-shadow: 0 2px 8px rgba(0,0,0,0.15);
			}

			.timing-block-color-bar {
				width: 6px;
				flex-shrink: 0;
			}

			.timing-block-content {
				flex: 1;
				padding: 12px 16px;
			}

			.timing-block-dialog {
				background: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 8px;
				box-shadow: 0 8px 24px rgba(0,0,0,0.15);
				padding: 16px;
				min-width: 280px;
				max-width: 400px;
				opacity: 0;
				transform: translateY(-10px);
				transition: all 0.2s ease-out;
			}

			.timing-dialog-content {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}

			.timing-dialog-header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
			}

			.timing-dialog-time {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.timing-dialog-time-range {
				font-family: var(--font-monospace);
				font-size: 1.1em;
				font-weight: 600;
				color: var(--text-normal);
			}

			.timing-dialog-duration {
				font-size: 0.9em;
				color: var(--text-accent);
				font-weight: 500;
			}

			.timing-dialog-app {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 8px 0;
			}

			.timing-dialog-app-icon {
				width: 40px;
				height: 40px;
				border-radius: 8px;
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				font-weight: bold;
				font-size: 18px;
				text-shadow: 0 1px 2px rgba(0,0,0,0.3);
			}

			.timing-dialog-app-details {
				flex: 1;
			}

			.timing-dialog-app-name {
				font-size: 1.1em;
				font-weight: 600;
				color: var(--text-normal);
				margin-bottom: 2px;
			}

			.timing-dialog-category {
				font-size: 0.9em;
				color: var(--text-muted);
			}

			.timing-dialog-title {
				font-size: 0.95em;
				color: var(--text-normal);
				font-style: italic;
				padding: 8px 12px;
				background: var(--background-secondary);
				border-radius: 4px;
				border-left: 3px solid var(--text-accent);
			}

			.timing-dialog-entries-header {
				font-size: 0.9em;
				font-weight: 600;
				color: var(--text-muted);
				margin-top: 8px;
				margin-bottom: 6px;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.timing-dialog-entries-list {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}

			.timing-dialog-entry {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 6px 8px;
				background: var(--background-secondary);
				border-radius: 4px;
				font-size: 0.85em;
			}

			.timing-dialog-entry-time {
				font-family: var(--font-monospace);
				color: var(--text-muted);
			}

			.timing-dialog-entry-duration {
				color: var(--text-accent);
				font-weight: 500;
			}

			.timing-dialog-entry-title {
				font-size: 0.8em;
				color: var(--text-muted);
				margin-top: 2px;
				font-style: italic;
			}

			.timing-block-header {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.timing-block-time-range {
				font-size: 0.9em;
				color: rgba(255, 255, 255, 0.9);
				font-weight: 500;
				text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			}

			.timing-block-title {
				font-weight: bold;
				color: white;
				line-height: 1.3;
				text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			}

			.timing-block-duration {
				font-size: 0.85em;
				color: rgba(255, 255, 255, 0.95);
				font-weight: 600;
				text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			}

			.timing-expand-btn {
				background: none;
				border: none;
				color: var(--text-muted);
				cursor: pointer;
				padding: 2px 4px;
				margin-left: auto;
				align-self: flex-start;
				font-size: 0.8em;
			}

			.timing-expand-btn:hover {
				color: var(--text-normal);
			}

			.timing-block-entries {
				margin-top: 12px;
				padding-top: 8px;
				border-top: 1px solid var(--background-modifier-border);
			}

			.timing-block-entry {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 6px 0;
				font-size: 0.9em;
				color: var(--text-muted);
			}

			.timing-entry-time {
				color: var(--text-muted);
				font-family: var(--font-monospace);
			}

			.timing-entry-duration {
				color: var(--text-accent);
				font-weight: 500;
			}

			.timing-entry-title {
				color: var(--text-normal);
				font-style: italic;
				margin-top: 2px;
			}

			/* Compact mode styles */
			.timing-block-compact {
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.9em;
			}

			.timing-compact-time {
				color: rgba(255, 255, 255, 0.9);
				font-family: var(--font-monospace);
				font-size: 0.85em;
				min-width: 40px;
				text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			}

			.timing-compact-app {
				color: white;
				font-weight: 500;
				flex: 1;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			}

			.timing-compact-duration {
				color: rgba(255, 255, 255, 0.95);
				font-weight: 600;
				font-size: 0.8em;
				text-shadow: 0 1px 2px rgba(0,0,0,0.5);
			}

			.timing-app-icon {
				width: 30px;
				height: 30px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				font-weight: bold;
				font-size: 14px;
			}

			.timing-entry-details {
				flex: 1;
			}

			.timing-app-name {
				font-weight: bold;
				color: var(--text-normal);
			}

			.timing-time-range {
				font-size: 0.9em;
				color: var(--text-muted);
			}

			.timing-duration {
				font-size: 0.9em;
				color: var(--text-accent);
				font-weight: bold;
			}

			.timing-category {
				font-size: 0.8em;
				color: var(--text-muted);
				font-style: italic;
			}

			.timing-timeline-summary {
				padding: 10px 0;
				border-top: 1px solid var(--background-modifier-border);
				margin-top: 10px;
			}

			.timing-summary-item {
				margin: 5px 0;
			}

			.timing-summary-label {
				color: var(--text-muted);
			}

			.timing-summary-value {
				color: var(--text-normal);
				font-weight: bold;
			}

			.timing-top-apps {
				margin-top: 10px;
			}

			.timing-top-app-item {
				display: flex;
				justify-content: space-between;
				margin: 3px 0;
				padding: 2px 5px;
				background: var(--background-modifier-border);
				border-radius: 3px;
			}

			.timing-app-name-small {
				font-size: 0.9em;
				color: var(--text-normal);
			}

			.timing-app-time-small {
				font-size: 0.9em;
				color: var(--text-accent);
			}

			.timing-no-data {
				text-align: center;
				color: var(--text-muted);
				padding: 50px 20px;
				font-style: italic;
			}
		`;
		document.head.appendChild(style);
	}
}
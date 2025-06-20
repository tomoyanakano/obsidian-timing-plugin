import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { DailyTimeData, TimingPluginSettings } from '../types';
import { DataTransformer } from '../data-transformer';

export const TIMING_DATA_VIEW_TYPE = 'timing-data-view';

export class TimingDataView extends ItemView {
	private data: DailyTimeData | null = null;
	private settings: TimingPluginSettings;
	private dataTransformer: DataTransformer;
	private onConfirm?: (data: DailyTimeData) => void;

	constructor(
		leaf: WorkspaceLeaf,
		settings: TimingPluginSettings
	) {
		super(leaf);
		this.settings = settings;
		this.dataTransformer = new DataTransformer();
	}

	getViewType(): string {
		return TIMING_DATA_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Timing Data Preview';
	}

	getIcon(): string {
		return 'clock';
	}

	async onOpen(): Promise<void> {
		this.renderEmptyState();
	}

	async onClose(): Promise<void> {
		// Cleanup if needed
	}

	setData(data: DailyTimeData, onConfirm?: (data: DailyTimeData) => void): void {
		this.data = data;
		this.onConfirm = onConfirm;
		this.render();
	}

	private renderEmptyState(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('timing-data-view');

		const emptyState = container.createDiv('timing-empty-state');
		emptyState.createEl('div', { 
			text: '📊', 
			cls: 'empty-state-icon' 
		});
		emptyState.createEl('h3', { 
			text: 'No Timing Data Loaded' 
		});
		emptyState.createEl('p', { 
			text: 'Use "Preview Data" to load today\'s timing information here.' 
		});
	}

	private render(): void {
		if (!this.data) {
			this.renderEmptyState();
			return;
		}

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('timing-data-view');

		// Header
		this.renderHeader(container);

		// Main content area
		const contentArea = container.createDiv('timing-view-content');

		// Summary cards
		this.renderSummaryCards(contentArea);

		// Navigation tabs
		this.renderTabbedContent(contentArea);

		// Action buttons
		this.renderActions(contentArea);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv('timing-view-header');
		
		const titleSection = header.createDiv('timing-view-title-section');
		titleSection.createEl('h2', { 
			text: `Timing Data - ${this.data?.date}`,
			cls: 'timing-view-title'
		});
		
		if (this.data) {
			const subtitle = titleSection.createEl('p', { cls: 'timing-view-subtitle' });
			const totalTime = this.dataTransformer.formatDuration(this.data.summary.totalTime);
			const entryCount = this.data.entries.length;
			subtitle.textContent = `${totalTime} tracked across ${entryCount} activities`;
		}

		// Refresh button
		const actions = header.createDiv('timing-view-header-actions');
		const refreshBtn = actions.createEl('button', {
			text: 'Refresh',
			cls: 'mod-secondary timing-refresh-btn'
		});
		refreshBtn.addEventListener('click', () => {
			new Notice('Refresh functionality would reload current data');
		});
	}

	private renderSummaryCards(container: HTMLElement): void {
		if (!this.data) return;

		const summarySection = container.createDiv('timing-view-summary');
		summarySection.createEl('h3', { text: 'Overview' });

		const cardsGrid = summarySection.createDiv('timing-summary-grid');

		// Total time card
		this.createSummaryCard(
			cardsGrid,
			'Total Time',
			this.dataTransformer.formatDuration(this.data.summary.totalTime),
			'⏱️',
			'primary'
		);

		// Activities count
		this.createSummaryCard(
			cardsGrid,
			'Activities',
			`${this.data.entries.length}`,
			'📊',
			'secondary'
		);

		// Most used app
		const mostUsedApp = this.dataTransformer.getMostUsedApplication(this.data.summary);
		if (mostUsedApp) {
			this.createSummaryCard(
				cardsGrid,
				'Top Application',
				`${mostUsedApp.name}`,
				'💻',
				'success'
			);
		}

		// Most productive hour
		const mostProductiveHour = this.dataTransformer.getMostProductiveHour(this.data.summary);
		if (mostProductiveHour) {
			const hourStr = this.dataTransformer.formatTime(
				`${mostProductiveHour.hour.toString().padStart(2, '0')}:00:00`,
				this.settings.timeFormat
			);
			this.createSummaryCard(
				cardsGrid,
				'Peak Hour',
				hourStr,
				'🚀',
				'accent'
			);
		}
	}

	private createSummaryCard(
		container: HTMLElement,
		title: string,
		value: string,
		icon: string,
		variant: 'primary' | 'secondary' | 'success' | 'accent'
	): void {
		const card = container.createDiv(`timing-summary-card timing-summary-card-${variant}`);
		
		const cardIcon = card.createDiv('timing-summary-card-icon');
		cardIcon.textContent = icon;
		
		const cardContent = card.createDiv('timing-summary-card-content');
		cardContent.createEl('div', { text: title, cls: 'timing-summary-card-title' });
		cardContent.createEl('div', { text: value, cls: 'timing-summary-card-value' });
	}

	private renderTabbedContent(container: HTMLElement): void {
		if (!this.data) return;

		const tabbedSection = container.createDiv('timing-view-tabbed-section');
		
		// Tab navigation
		const tabNav = tabbedSection.createDiv('timing-tab-nav');
		const tabContent = tabbedSection.createDiv('timing-tab-content');

		const tabs: Array<{
			id: string;
			label: string;
			render: () => HTMLElement;
			condition?: boolean;
		}> = [
			{
				id: 'applications',
				label: 'Applications',
				render: () => this.renderApplicationsTab(),
				condition: this.settings.groupBy === 'application' || this.settings.groupBy === 'both'
			},
			{
				id: 'categories',
				label: 'Categories',
				render: () => this.renderCategoriesTab(),
				condition: this.settings.groupBy === 'category' || this.settings.groupBy === 'both'
			},
			{
				id: 'timeline',
				label: 'Timeline',
				render: () => this.renderTimelineTab(),
				condition: this.settings.includeTimeline
			},
			{
				id: 'visual',
				label: 'Visual Timeline',
				render: () => this.renderVisualTimelineTab()
			}
		];

		// Filter tabs based on conditions
		const enabledTabs = tabs.filter(tab => tab.condition !== false);

		// Create tab buttons
		enabledTabs.forEach((tab, index) => {
			const tabBtn = tabNav.createEl('button', {
				text: tab.label,
				cls: 'timing-tab-btn'
			});
			
			if (index === 0) {
				tabBtn.addClass('active');
			}

			tabBtn.addEventListener('click', () => {
				// Remove active class from all tabs
				tabNav.querySelectorAll('.timing-tab-btn').forEach(btn => 
					btn.removeClass('active')
				);
				tabBtn.addClass('active');

				// Clear and render new content
				tabContent.empty();
				const content = tab.render();
				tabContent.appendChild(content);
			});
		});

		// Render first tab by default
		if (enabledTabs.length > 0) {
			const firstTabContent = enabledTabs[0].render();
			tabContent.appendChild(firstTabContent);
		}
	}

	private renderApplicationsTab(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'timing-applications-tab';

		if (!this.data || this.data.summary.byApplication.size === 0) {
			container.createEl('p', { text: 'No application data available', cls: 'no-data' });
			return container;
		}

		const table = container.createEl('table', { cls: 'timing-data-table' });
		
		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Application' });
		headerRow.createEl('th', { text: 'Time' });
		headerRow.createEl('th', { text: 'Percentage' });
		headerRow.createEl('th', { text: 'Sessions' });

		// Body
		const tbody = table.createEl('tbody');
		const sortedApps = Array.from(this.data.summary.byApplication.entries())
			.sort((a, b) => b[1] - a[1]);

		for (const [app, time] of sortedApps) {
			if (time >= this.settings.minimumDuration) {
				const row = tbody.createEl('tr');
				
				row.createEl('td', { text: app, cls: 'app-name' });
				row.createEl('td', { 
					text: this.dataTransformer.formatDuration(time),
					cls: 'time-value'
				});
				
				const percentage = this.dataTransformer.calculatePercentage(time, this.data.summary.totalTime);
				row.createEl('td', { 
					text: `${percentage}%`,
					cls: 'percentage-value'
				});

				const sessions = this.data.entries.filter(entry => entry.application === app).length;
				row.createEl('td', { 
					text: sessions.toString(),
					cls: 'sessions-count'
				});
			}
		}

		return container;
	}

	private renderCategoriesTab(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'timing-categories-tab';

		if (!this.data || this.data.summary.byCategory.size === 0) {
			container.createEl('p', { text: 'No category data available', cls: 'no-data' });
			return container;
		}

		const table = container.createEl('table', { cls: 'timing-data-table' });
		
		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Category' });
		headerRow.createEl('th', { text: 'Time' });
		headerRow.createEl('th', { text: 'Percentage' });
		headerRow.createEl('th', { text: 'Activities' });

		// Body
		const tbody = table.createEl('tbody');
		const sortedCategories = Array.from(this.data.summary.byCategory.entries())
			.sort((a, b) => b[1] - a[1]);

		for (const [category, time] of sortedCategories) {
			if (time >= this.settings.minimumDuration) {
				const row = tbody.createEl('tr');
				
				row.createEl('td', { text: category, cls: 'category-name' });
				row.createEl('td', { 
					text: this.dataTransformer.formatDuration(time),
					cls: 'time-value'
				});
				
				const percentage = this.dataTransformer.calculatePercentage(time, this.data.summary.totalTime);
				row.createEl('td', { 
					text: `${percentage}%`,
					cls: 'percentage-value'
				});

				const activities = this.data.entries.filter(entry => entry.category === category).length;
				row.createEl('td', { 
					text: activities.toString(),
					cls: 'activities-count'
				});
			}
		}

		return container;
	}

	private renderTimelineTab(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'timing-timeline-tab';

		if (!this.data) {
			container.createEl('p', { text: 'No timeline data available', cls: 'no-data' });
			return container;
		}

		const filteredEntries = this.dataTransformer.filterEntriesByMinimumDuration(
			this.data.entries,
			this.settings.minimumDuration
		);

		if (filteredEntries.length === 0) {
			container.createEl('p', { text: 'No activities meet minimum duration', cls: 'no-data' });
			return container;
		}

		const timelineList = container.createDiv('timeline-list');

		for (const entry of filteredEntries) {
			const timelineItem = timelineList.createDiv('timeline-item');
			
			const timeRange = timelineItem.createDiv('timeline-time');
			const startTime = this.dataTransformer.formatTime(entry.startTime, this.settings.timeFormat);
			const endTime = this.dataTransformer.formatTime(entry.endTime, this.settings.timeFormat);
			const duration = this.dataTransformer.formatDuration(entry.duration);
			timeRange.textContent = `${startTime} - ${endTime} (${duration})`;

			const details = timelineItem.createDiv('timeline-details');
			const appName = details.createSpan('timeline-app');
			appName.textContent = entry.application;

			if (entry.category) {
				const category = details.createSpan('timeline-category');
				category.textContent = entry.category;
			}

			if (entry.title) {
				const title = timelineItem.createDiv('timeline-title');
				title.textContent = entry.title;
			}
		}

		return container;
	}

	private renderVisualTimelineTab(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'timing-visual-timeline-tab';

		if (!this.data) {
			container.createEl('p', { text: 'No data available', cls: 'no-data' });
			return container;
		}

		// Hour-by-hour timeline
		const timelineBar = container.createDiv('visual-timeline-bar');
		
		for (let hour = 0; hour < 24; hour++) {
			const hourBlock = timelineBar.createDiv('timeline-hour-block');
			hourBlock.setAttribute('data-hour', hour.toString());
			
			const hourLabel = hourBlock.createDiv('hour-label');
			hourLabel.textContent = hour.toString().padStart(2, '0');
			
			const hourData = this.data.summary.byHour.get(hour) || 0;
			if (hourData > 0) {
				hourBlock.addClass('has-activity');
				const intensity = Math.min(hourData / (60 * 60), 1);
				hourBlock.style.setProperty('--intensity', intensity.toString());
				
				hourBlock.setAttribute('title', 
					`${hour}:00 - ${this.dataTransformer.formatDuration(hourData)}`
				);
			}
		}

		return container;
	}

	private renderActions(container: HTMLElement): void {
		if (!this.data || !this.onConfirm) return;

		const actionsSection = container.createDiv('timing-view-actions');
		
		const confirmBtn = actionsSection.createEl('button', {
			text: 'Add to Daily Note',
			cls: 'mod-cta'
		});
		confirmBtn.addEventListener('click', () => {
			if (this.data && this.onConfirm) {
				this.onConfirm(this.data);
				new Notice('Timing data added to Daily Note');
			}
		});

		const exportBtn = actionsSection.createEl('button', {
			text: 'Export Data',
			cls: 'mod-secondary'
		});
		exportBtn.addEventListener('click', () => {
			new Notice('Export functionality coming soon');
		});
	}

	updateSettings(settings: TimingPluginSettings): void {
		this.settings = settings;
		if (this.data) {
			this.render();
		}
	}
}
import { App, Modal, Setting } from 'obsidian';
import { DailyTimeData, TimingPluginSettings } from '../types';
import { DataTransformer } from '../data-transformer';

export class DataPreviewModal extends Modal {
	private data: DailyTimeData;
	private settings: TimingPluginSettings;
	private dataTransformer: DataTransformer;
	private onConfirm: (data: DailyTimeData) => void;

	constructor(
		app: App, 
		data: DailyTimeData, 
		settings: TimingPluginSettings,
		onConfirm: (data: DailyTimeData) => void
	) {
		super(app);
		this.data = data;
		this.settings = settings;
		this.dataTransformer = new DataTransformer();
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('timing-data-preview-modal');

		// Header
		const headerEl = contentEl.createDiv('modal-header');
		headerEl.createEl('h2', { text: `Timing Data Preview - ${this.data.date}` });
		headerEl.createEl('p', { 
			text: 'Review your timing data before adding to Daily Note',
			cls: 'modal-subtitle'
		});

		// Summary cards
		this.renderSummaryCards(contentEl);

		// Detailed breakdown
		this.renderDetailedBreakdown(contentEl);

		// Interactive timeline
		this.renderInteractiveTimeline(contentEl);

		// Actions
		this.renderActions(contentEl);
	}

	private renderSummaryCards(container: HTMLElement): void {
		const summaryContainer = container.createDiv('timing-summary-cards');
		summaryContainer.createEl('h3', { text: 'Overview' });

		const cardsGrid = summaryContainer.createDiv('summary-cards-grid');

		// Total time card
		this.createSummaryCard(
			cardsGrid,
			'Total Time',
			this.dataTransformer.formatDuration(this.data.summary.totalTime),
			'⏱️',
			'primary'
		);

		// Entries count
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
				'Top App',
				`${mostUsedApp.name} (${this.dataTransformer.formatDuration(mostUsedApp.time)})`,
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
				`${hourStr} (${this.dataTransformer.formatDuration(mostProductiveHour.time)})`,
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
		const card = container.createDiv(`summary-card summary-card-${variant}`);
		
		const cardHeader = card.createDiv('summary-card-header');
		cardHeader.createSpan('summary-card-icon').textContent = icon;
		cardHeader.createSpan('summary-card-title').textContent = title;
		
		card.createDiv('summary-card-value').textContent = value;
	}

	private renderDetailedBreakdown(container: HTMLElement): void {
		const breakdownContainer = container.createDiv('timing-breakdown');
		breakdownContainer.createEl('h3', { text: 'Detailed Breakdown' });

		// Create tabs for different views
		const tabsContainer = breakdownContainer.createDiv('breakdown-tabs');
		const tabButtons = tabsContainer.createDiv('tab-buttons');
		const tabContents = breakdownContainer.createDiv('tab-contents');

		// Applications tab
		if (this.settings.groupBy === 'application' || this.settings.groupBy === 'both') {
			this.createTab(tabButtons, tabContents, 'applications', 'Applications', () => {
				return this.renderApplicationsTable();
			});
		}

		// Categories tab
		if (this.settings.groupBy === 'category' || this.settings.groupBy === 'both') {
			this.createTab(tabButtons, tabContents, 'categories', 'Categories', () => {
				return this.renderCategoriesTable();
			});
		}

		// Timeline tab
		if (this.settings.includeTimeline) {
			this.createTab(tabButtons, tabContents, 'timeline', 'Timeline', () => {
				return this.renderTimelineList();
			});
		}

		// Activate first tab
		const firstButton = tabButtons.querySelector('.tab-button') as HTMLElement;
		if (firstButton) {
			firstButton.click();
		}
	}

	private createTab(
		tabButtons: HTMLElement, 
		tabContents: HTMLElement, 
		id: string, 
		label: string,
		renderContent: () => HTMLElement
	): void {
		// Button
		const button = tabButtons.createEl('button', {
			text: label,
			cls: 'tab-button',
			attr: { 'data-tab': id }
		});

		// Content
		const content = tabContents.createDiv(`tab-content tab-content-${id}`);
		content.style.display = 'none';

		button.addEventListener('click', () => {
			// Deactivate all tabs
			tabButtons.querySelectorAll('.tab-button').forEach(btn => btn.removeClass('active'));
			tabContents.querySelectorAll('.tab-content').forEach(cnt => (cnt as HTMLElement).style.display = 'none');

			// Activate current tab
			button.addClass('active');
			content.style.display = 'block';

			// Render content if not already rendered
			if (content.children.length === 0) {
				const contentEl = renderContent();
				content.appendChild(contentEl);
			}
		});
	}

	private renderApplicationsTable(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'applications-table-container';

		if (this.data.summary.byApplication.size === 0) {
			container.createEl('p', { text: 'No application data available', cls: 'no-data-message' });
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
				
				// Application name
				row.createEl('td', { text: app, cls: 'app-name' });
				
				// Time
				row.createEl('td', { 
					text: this.dataTransformer.formatDuration(time),
					cls: 'time-value'
				});
				
				// Percentage
				const percentage = this.dataTransformer.calculatePercentage(time, this.data.summary.totalTime);
				row.createEl('td', { 
					text: `${percentage}%`,
					cls: 'percentage-value'
				});

				// Sessions count
				const sessions = this.data.entries.filter(entry => entry.application === app).length;
				row.createEl('td', { 
					text: sessions.toString(),
					cls: 'sessions-count'
				});
			}
		}

		return container;
	}

	private renderCategoriesTable(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'categories-table-container';

		if (this.data.summary.byCategory.size === 0) {
			container.createEl('p', { text: 'No category data available', cls: 'no-data-message' });
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

	private renderTimelineList(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'timeline-container';

		const filteredEntries = this.dataTransformer.filterEntriesByMinimumDuration(
			this.data.entries,
			this.settings.minimumDuration
		);

		if (filteredEntries.length === 0) {
			container.createEl('p', { text: 'No timeline data available', cls: 'no-data-message' });
			return container;
		}

		const timelineList = container.createEl('div', { cls: 'timeline-list' });

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

	private renderInteractiveTimeline(container: HTMLElement): void {
		if (!this.settings.includeTimeline) return;

		const timelineContainer = container.createDiv('interactive-timeline');
		timelineContainer.createEl('h3', { text: 'Visual Timeline' });

		// Create hour-by-hour visual timeline
		const timelineBar = timelineContainer.createDiv('timeline-bar');
		
		for (let hour = 0; hour < 24; hour++) {
			const hourBlock = timelineBar.createDiv('timeline-hour-block');
			hourBlock.setAttribute('data-hour', hour.toString());
			
			const hourLabel = hourBlock.createDiv('hour-label');
			hourLabel.textContent = hour.toString().padStart(2, '0');
			
			const hourData = this.data.summary.byHour.get(hour) || 0;
			if (hourData > 0) {
				hourBlock.addClass('has-activity');
				const intensity = Math.min(hourData / (60 * 60), 1); // Normalize to max 1 hour
				hourBlock.style.setProperty('--intensity', intensity.toString());
				
				// Tooltip
				hourBlock.setAttribute('title', 
					`${hour}:00 - ${this.dataTransformer.formatDuration(hourData)}`
				);
			}
		}
	}

	private renderActions(container: HTMLElement): void {
		const actionsContainer = container.createDiv('modal-actions');

		// Cancel button
		const cancelButton = actionsContainer.createEl('button', {
			text: 'Cancel',
			cls: 'mod-cancel'
		});
		cancelButton.addEventListener('click', () => this.close());

		// Confirm button
		const confirmButton = actionsContainer.createEl('button', {
			text: 'Add to Daily Note',
			cls: 'mod-cta'
		});
		confirmButton.addEventListener('click', () => {
			this.onConfirm(this.data);
			this.close();
		});

		// Preview button
		const previewButton = actionsContainer.createEl('button', {
			text: 'Preview Markdown',
			cls: 'mod-secondary'
		});
		previewButton.addEventListener('click', () => {
			this.showMarkdownPreview();
		});
	}

	private showMarkdownPreview(): void {
		// This would open another modal with the generated markdown preview
		// For now, we'll just log it to console
		console.log('Markdown preview functionality would be implemented here');
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
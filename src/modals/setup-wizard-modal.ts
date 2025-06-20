import { App, Modal, Setting, Notice } from 'obsidian';
import { TimingPluginSettings } from '../types';
import { TimingIntegration } from '../timing-integration';

interface SetupStep {
	id: string;
	title: string;
	description: string;
	isComplete: boolean;
	isOptional: boolean;
}

export class SetupWizardModal extends Modal {
	private settings: TimingPluginSettings;
	private timingIntegration: TimingIntegration;
	private onComplete: (settings: TimingPluginSettings) => void;
	private currentStep: number = 0;
	private steps: SetupStep[] = [];
	private stepContainer: HTMLElement;

	constructor(
		app: App,
		settings: TimingPluginSettings,
		timingIntegration: TimingIntegration,
		onComplete: (settings: TimingPluginSettings) => void
	) {
		super(app);
		this.settings = { ...settings };
		this.timingIntegration = timingIntegration;
		this.onComplete = onComplete;
		this.initializeSteps();
	}

	private initializeSteps(): void {
		this.steps = [
			{
				id: 'welcome',
				title: 'Welcome to Timing Plugin',
				description: 'Let\'s set up your time tracking integration',
				isComplete: false,
				isOptional: false
			},
			{
				id: 'timing-detection',
				title: 'Timing App Detection',
				description: 'Verify that Timing app is installed and accessible',
				isComplete: false,
				isOptional: false
			},
			{
				id: 'permissions',
				title: 'Permissions Setup',
				description: 'Grant necessary permissions for AppleScript automation',
				isComplete: false,
				isOptional: false
			},
			{
				id: 'daily-notes',
				title: 'Daily Notes Configuration',
				description: 'Configure how timing data integrates with your Daily Notes',
				isComplete: false,
				isOptional: true
			},
			{
				id: 'preferences',
				title: 'Display Preferences',
				description: 'Customize how timing data is displayed',
				isComplete: false,
				isOptional: true
			},
			{
				id: 'complete',
				title: 'Setup Complete',
				description: 'Your Timing Plugin is ready to use!',
				isComplete: false,
				isOptional: false
			}
		];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('timing-setup-wizard');

		// Header
		this.renderHeader(contentEl);

		// Progress indicator
		this.renderProgress(contentEl);

		// Step container
		this.stepContainer = contentEl.createDiv('wizard-step-container');

		// Navigation
		this.renderNavigation(contentEl);

		// Render first step
		this.renderCurrentStep();
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv('wizard-header');
		header.createEl('h1', { text: 'Timing Plugin Setup Wizard' });
		header.createEl('p', { 
			text: 'This wizard will guide you through setting up the Timing Plugin for seamless time tracking integration.',
			cls: 'wizard-subtitle'
		});
	}

	private renderProgress(container: HTMLElement): void {
		const progressContainer = container.createDiv('wizard-progress');
		
		const progressBar = progressContainer.createDiv('progress-bar');
		const progressFill = progressBar.createDiv('progress-fill');
		const progressPercent = (this.currentStep / (this.steps.length - 1)) * 100;
		progressFill.style.width = `${progressPercent}%`;

		const stepIndicators = progressContainer.createDiv('step-indicators');
		
		this.steps.forEach((step, index) => {
			const indicator = stepIndicators.createDiv('step-indicator');
			indicator.setAttribute('data-step', index.toString());
			
			if (index < this.currentStep) {
				indicator.addClass('completed');
				indicator.createSpan('step-icon').textContent = '✓';
			} else if (index === this.currentStep) {
				indicator.addClass('current');
				indicator.createSpan('step-number').textContent = (index + 1).toString();
			} else {
				indicator.createSpan('step-number').textContent = (index + 1).toString();
			}
			
			const label = indicator.createDiv('step-label');
			label.textContent = step.title;
			
			if (step.isOptional) {
				label.createSpan('optional-badge').textContent = 'Optional';
			}
		});
	}

	private renderNavigation(container: HTMLElement): void {
		const navigation = container.createDiv('wizard-navigation');

		// Back button
		const backButton = navigation.createEl('button', {
			text: 'Back',
			cls: 'mod-secondary'
		});
		backButton.addEventListener('click', () => this.goToPreviousStep());
		backButton.disabled = this.currentStep === 0;

		// Skip button (for optional steps)
		const skipButton = navigation.createEl('button', {
			text: 'Skip',
			cls: 'mod-secondary'
		});
		skipButton.addEventListener('click', () => this.skipCurrentStep());
		skipButton.style.display = this.steps[this.currentStep]?.isOptional ? 'block' : 'none';

		// Next/Finish button
		const nextButton = navigation.createEl('button', {
			text: this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next',
			cls: 'mod-cta'
		});
		nextButton.addEventListener('click', () => this.goToNextStep());

		// Store references for updates
		this.backButton = backButton;
		this.skipButton = skipButton;
		this.nextButton = nextButton;
	}

	private backButton: HTMLButtonElement;
	private skipButton: HTMLButtonElement;
	private nextButton: HTMLButtonElement;

	private renderCurrentStep(): void {
		this.stepContainer.empty();
		
		const step = this.steps[this.currentStep];
		const stepEl = this.stepContainer.createDiv('wizard-step');
		stepEl.setAttribute('data-step-id', step.id);

		// Step header
		const stepHeader = stepEl.createDiv('step-header');
		stepHeader.createEl('h2', { text: step.title });
		stepHeader.createEl('p', { text: step.description, cls: 'step-description' });

		// Step content
		const stepContent = stepEl.createDiv('step-content');
		this.renderStepContent(step.id, stepContent);

		// Update navigation
		this.updateNavigation();
	}

	private renderStepContent(stepId: string, container: HTMLElement): void {
		switch (stepId) {
			case 'welcome':
				this.renderWelcomeStep(container);
				break;
			case 'timing-detection':
				this.renderTimingDetectionStep(container);
				break;
			case 'permissions':
				this.renderPermissionsStep(container);
				break;
			case 'daily-notes':
				this.renderDailyNotesStep(container);
				break;
			case 'preferences':
				this.renderPreferencesStep(container);
				break;
			case 'complete':
				this.renderCompleteStep(container);
				break;
		}
	}

	private renderWelcomeStep(container: HTMLElement): void {
		const welcome = container.createDiv('welcome-step');
		
		welcome.createEl('div', {
			text: '🎯',
			cls: 'welcome-icon'
		});

		const benefits = welcome.createDiv('benefits-list');
		benefits.createEl('h3', { text: 'What you\'ll get:' });
		
		const benefitsList = benefits.createEl('ul');
		[
			'Automatic time tracking integration with Timing app',
			'Detailed daily reports in your Daily Notes',
			'Visual timeline and productivity insights',
			'Seamless background synchronization',
			'Customizable data display and formatting'
		].forEach(benefit => {
			benefitsList.createEl('li').textContent = benefit;
		});

		const requirements = welcome.createDiv('requirements');
		requirements.createEl('h3', { text: 'Requirements:' });
		
		const reqList = requirements.createEl('ul');
		[
			'Timing app for macOS (Expert or Connect subscription recommended)',
			'macOS with AppleScript support',
			'Obsidian with Daily Notes (optional but recommended)'
		].forEach(req => {
			reqList.createEl('li').textContent = req;
		});

		this.steps[0].isComplete = true;
	}

	private renderTimingDetectionStep(container: HTMLElement): void {
		const detection = container.createDiv('timing-detection-step');
		
		const statusCard = detection.createDiv('status-card');
		const statusIcon = statusCard.createDiv('status-icon');
		const statusText = statusCard.createDiv('status-text');
		
		statusText.createEl('h3', { text: 'Detecting Timing App...' });
		const statusDescription = statusText.createEl('p');

		// Test Timing availability
		this.testTimingAvailability(statusIcon, statusDescription);

		// Manual path setting
		const manualConfig = detection.createDiv('manual-config');
		manualConfig.createEl('h3', { text: 'Manual Configuration' });
		
		new Setting(manualConfig)
			.setName('Timing App Path')
			.setDesc('If auto-detection fails, specify the path to Timing.app')
			.addText(text => text
				.setPlaceholder('/Applications/Timing.app')
				.setValue(this.settings.timingAppPath)
				.onChange(value => {
					this.settings.timingAppPath = value;
				}));

		const testButton = manualConfig.createEl('button', {
			text: 'Test Connection',
			cls: 'mod-secondary'
		});
		testButton.addEventListener('click', () => {
			this.testTimingAvailability(statusIcon, statusDescription);
		});
	}

	private async testTimingAvailability(statusIcon: HTMLElement, statusDescription: HTMLElement): Promise<void> {
		statusIcon.empty();
		statusDescription.textContent = 'Testing connection...';
		statusIcon.textContent = '🔄';

		try {
			const result = await this.timingIntegration.testConnection();
			
			if (result.success) {
				statusIcon.textContent = '✅';
				statusDescription.textContent = 'Timing app detected and accessible!';
				this.steps[1].isComplete = true;
			} else {
				statusIcon.textContent = '❌';
				statusDescription.textContent = `Connection failed: ${result.message}`;
				this.steps[1].isComplete = false;
			}
		} catch (error) {
			statusIcon.textContent = '❌';
			statusDescription.textContent = `Error: ${error.message}`;
			this.steps[1].isComplete = false;
		}

		this.updateNavigation();
	}

	private renderPermissionsStep(container: HTMLElement): void {
		const permissions = container.createDiv('permissions-step');
		
		permissions.createEl('div', {
			text: '🔐',
			cls: 'step-icon'
		});

		const instructions = permissions.createDiv('permissions-instructions');
		instructions.createEl('h3', { text: 'Grant AppleScript Permissions' });
		
		const steps = instructions.createEl('ol', { cls: 'instruction-list' });
		[
			'Open System Preferences → Security & Privacy → Privacy',
			'Select "Automation" from the left sidebar',
			'Find "Obsidian" in the list',
			'Check the box next to "TimingHelper" or "Timing"',
			'If Obsidian is not listed, you may need to trigger a permission request first'
		].forEach(step => {
			steps.createEl('li').textContent = step;
		});

		const helpButton = instructions.createEl('button', {
			text: 'Open System Preferences',
			cls: 'mod-secondary'
		});
		helpButton.addEventListener('click', () => {
			// This would open System Preferences on macOS
			new Notice('Please manually open System Preferences → Security & Privacy → Privacy → Automation');
		});

		const testPermissions = permissions.createDiv('test-permissions');
		testPermissions.createEl('h3', { text: 'Test Permissions' });
		
		const testButton = testPermissions.createEl('button', {
			text: 'Test AppleScript Access',
			cls: 'mod-cta'
		});
		testButton.addEventListener('click', async () => {
			const result = await this.timingIntegration.testConnection();
			if (result.success) {
				new Notice('✅ Permissions granted successfully!');
				this.steps[2].isComplete = true;
				this.updateNavigation();
			} else {
				new Notice('❌ Permission test failed. Please check your settings.');
			}
		});
	}

	private renderDailyNotesStep(container: HTMLElement): void {
		const dailyNotes = container.createDiv('daily-notes-step');
		
		dailyNotes.createEl('h3', { text: 'Daily Notes Integration' });
		dailyNotes.createEl('p', { 
			text: 'Configure how timing data will be integrated with your Daily Notes.',
			cls: 'step-description'
		});

		new Setting(dailyNotes)
			.setName('Date Format')
			.setDesc('Choose the date format for your Daily Notes')
			.addDropdown(dropdown => dropdown
				.addOption('YYYY-MM-DD', 'YYYY-MM-DD (2025-06-18)')
				.addOption('YYYY/MM/DD', 'YYYY/MM/DD (2025/06/18)')
				.addOption('DD-MM-YYYY', 'DD-MM-YYYY (18-06-2025)')
				.setValue(this.settings.dateFormat)
				.onChange(value => {
					this.settings.dateFormat = value;
				}));

		new Setting(dailyNotes)
			.setName('Daily Notes Folder')
			.setDesc('Folder where your Daily Notes are stored (leave empty for root)')
			.addText(text => text
				.setPlaceholder('Daily')
				.setValue(this.settings.folder)
				.onChange(value => {
					this.settings.folder = value;
				}));

		new Setting(dailyNotes)
			.setName('Auto-create Daily Notes')
			.setDesc('Automatically create Daily Notes if they don\'t exist')
			.addToggle(toggle => toggle
				.setValue(this.settings.autoCreateDailyNotes)
				.onChange(value => {
					this.settings.autoCreateDailyNotes = value;
				}));

		new Setting(dailyNotes)
			.setName('Section Location')
			.setDesc('Where to place the timing section in Daily Notes')
			.addDropdown(dropdown => dropdown
				.addOption('top', 'Top of note')
				.addOption('bottom', 'Bottom of note')
				.addOption('after-header', 'After specific header')
				.setValue(this.settings.timingSectionLocation)
				.onChange(value => {
					this.settings.timingSectionLocation = value as any;
				}));

		this.steps[3].isComplete = true;
	}

	private renderPreferencesStep(container: HTMLElement): void {
		const preferences = container.createDiv('preferences-step');
		
		preferences.createEl('h3', { text: 'Display Preferences' });

		new Setting(preferences)
			.setName('Include Timeline')
			.setDesc('Show detailed activity timeline in reports')
			.addToggle(toggle => toggle
				.setValue(this.settings.includeTimeline)
				.onChange(value => {
					this.settings.includeTimeline = value;
				}));

		new Setting(preferences)
			.setName('Include Reflection Section')
			.setDesc('Add a section for daily time usage reflection')
			.addToggle(toggle => toggle
				.setValue(this.settings.includeReflection)
				.onChange(value => {
					this.settings.includeReflection = value;
				}));

		new Setting(preferences)
			.setName('Group By')
			.setDesc('How to group time tracking data')
			.addDropdown(dropdown => dropdown
				.addOption('application', 'Application only')
				.addOption('category', 'Category only')
				.addOption('both', 'Both application and category')
				.setValue(this.settings.groupBy)
				.onChange(value => {
					this.settings.groupBy = value as any;
				}));

		new Setting(preferences)
			.setName('Update Interval')
			.setDesc('How often to sync data (in minutes)')
			.addSlider(slider => slider
				.setLimits(1, 60, 1)
				.setValue(this.settings.updateInterval / (60 * 1000))
				.setDynamicTooltip()
				.onChange(value => {
					this.settings.updateInterval = value * 60 * 1000;
				}));

		this.steps[4].isComplete = true;
	}

	private renderCompleteStep(container: HTMLElement): void {
		const complete = container.createDiv('complete-step');
		
		complete.createEl('div', {
			text: '🎉',
			cls: 'completion-icon'
		});

		complete.createEl('h3', { text: 'Setup Complete!' });
		complete.createEl('p', { 
			text: 'Your Timing Plugin is now configured and ready to use.',
			cls: 'completion-message'
		});

		const nextSteps = complete.createDiv('next-steps');
		nextSteps.createEl('h4', { text: 'What\'s next?' });
		
		const stepsList = nextSteps.createEl('ul');
		[
			'The plugin will automatically start syncing timing data',
			'Use "Timing: Preview data" to see your timing statistics',
			'Check your Daily Notes for automatic timing updates',
			'Customize settings anytime from the plugin settings page'
		].forEach(step => {
			stepsList.createEl('li').textContent = step;
		});

		this.steps[5].isComplete = true;
	}

	private updateNavigation(): void {
		const step = this.steps[this.currentStep];
		
		// Update back button
		this.backButton.disabled = this.currentStep === 0;
		
		// Update skip button
		this.skipButton.style.display = step.isOptional ? 'block' : 'none';
		
		// Update next button
		this.nextButton.textContent = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next';
		this.nextButton.disabled = !step.isComplete && !step.isOptional;
	}

	private goToPreviousStep(): void {
		if (this.currentStep > 0) {
			this.currentStep--;
			this.renderCurrentStep();
			this.renderProgress(this.contentEl.querySelector('.wizard-progress') as HTMLElement);
		}
	}

	private goToNextStep(): void {
		if (this.currentStep < this.steps.length - 1) {
			this.currentStep++;
			this.renderCurrentStep();
			this.renderProgress(this.contentEl.querySelector('.wizard-progress') as HTMLElement);
		} else {
			// Finish setup
			this.onComplete(this.settings);
			this.close();
		}
	}

	private skipCurrentStep(): void {
		const step = this.steps[this.currentStep];
		if (step.isOptional) {
			step.isComplete = true;
			this.goToNextStep();
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
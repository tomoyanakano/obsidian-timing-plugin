# User Interface & Command Design

## Overview

This document outlines the comprehensive user interface and command design for the Timing Plugin, focusing on intuitive user experience, accessibility, and seamless integration with Obsidian's existing interface patterns.

## Plugin Interface Components

### 1. Settings Tab

#### Main Settings Panel
```typescript
interface SettingsTabSections {
  connection: ConnectionSettings;
  dailyNotes: DailyNoteSettings;
  display: DisplaySettings;
  advanced: AdvancedSettings;
  help: HelpSection;
}
```

#### Connection Settings Section
```markdown
## Timing Integration

### Connection Status
🟢 **Connected** - Timing app detected (v2024.1)
   ✅ AppleScript permissions granted
   ✅ Expert subscription active
   Last sync: 5 minutes ago

### Timing App Configuration
- **App Path**: /Applications/Timing.app
  [Browse...] [Test Connection]
- **Subscription Level**: Expert ✅ | Connect upgrade available
  [Check Subscription] [Upgrade Info]
- **Auto-launch Timing**: ☑️ Launch Timing app if not running
```

#### Daily Notes Integration Section
```markdown
## Daily Notes Integration

### File Settings
- **Daily Note Format**: YYYY-MM-DD ▼
  Preview: 2025-06-18.md
- **Daily Notes Folder**: Daily/ 
  [Browse...] Uses: Daily Notes plugin settings
- **Auto-create Notes**: ☑️ Create Daily Notes automatically
- **Section Location**: Bottom ▼ | After Header ▼ | Custom

### Content Settings
- **Include Timeline**: ☑️ Show detailed activity timeline
- **Include Reflection**: ☑️ Add reflection section for reviews
- **Group By**: Both ▼ (Application & Category)
- **Minimum Duration**: 5 minutes
- **Time Format**: 24-hour ▼
```

#### Display Settings Section
```markdown
## Display & Formatting

### Update Frequency
- **Real-time Updates**: ☑️ Update every 5 minutes
- **Background Sync**: ☑️ Sync when Obsidian is not active
- **Manual Updates Only**: ☐ Disable automatic updates

### Visual Indicators
- **Ribbon Icon**: ☑️ Show timing status in ribbon
- **Status Bar**: ☑️ Display sync status in status bar
- **Notifications**: ☑️ Show sync notifications
  - Success notifications: ☐
  - Error notifications: ☑️
  - Warning notifications: ☑️
```

### 2. Status Indicators

#### Ribbon Icon States
```typescript
interface RibbonIconConfig {
  active: {
    icon: 'clock',
    color: '#22c55e',        // Green
    tooltip: 'Timing: Active - Last sync: 2 min ago'
  };
  syncing: {
    icon: 'clock',
    color: '#3b82f6',        // Blue
    tooltip: 'Timing: Syncing data...'
  };
  warning: {
    icon: 'clock',
    color: '#f59e0b',        // Yellow
    tooltip: 'Timing: Warning - Check settings'
  };
  error: {
    icon: 'clock',
    color: '#ef4444',        // Red
    tooltip: 'Timing: Error - Not connected'
  };
  disabled: {
    icon: 'clock',
    color: '#6b7280',        // Gray
    tooltip: 'Timing: Disabled'
  };
}
```

#### Status Bar Display
```typescript
interface StatusBarStates {
  normal: "Timing: ✅ (2m ago)";
  syncing: "Timing: 🔄 Syncing...";
  warning: "Timing: ⚠️ Check connection";
  error: "Timing: ❌ Not connected";
  disabled: "Timing: ⏸️ Disabled";
}
```

### 3. Command Palette Integration

#### Primary Commands
```typescript
interface PluginCommands {
  // Data Operations
  'timing-sync-now': {
    id: 'timing-sync-now',
    name: 'Timing: Sync data now',
    icon: 'refresh-cw',
    callback: () => this.syncDataNow()
  };
  
  'timing-update-current-note': {
    id: 'timing-update-current-note',
    name: 'Timing: Update current Daily Note',
    icon: 'clock',
    callback: () => this.updateCurrentDailyNote()
  };
  
  // Note Management
  'timing-create-daily-note': {
    id: 'timing-create-daily-note',
    name: 'Timing: Create Daily Note with timing section',
    icon: 'file-plus',
    callback: () => this.createDailyNoteWithTiming()
  };
  
  'timing-open-today': {
    id: 'timing-open-today',
    name: 'Timing: Open today\'s tracking data',
    icon: 'calendar-days',
    callback: () => this.openTodaysDailyNote()
  };
  
  // Configuration
  'timing-open-settings': {
    id: 'timing-open-settings',
    name: 'Timing: Open plugin settings',
    icon: 'settings',
    callback: () => this.openSettings()
  };
  
  'timing-test-connection': {
    id: 'timing-test-connection',
    name: 'Timing: Test Timing app connection',
    icon: 'wifi',
    callback: () => this.testConnection()
  };
  
  // Data Management
  'timing-clear-cache': {
    id: 'timing-clear-cache',
    name: 'Timing: Clear data cache',
    icon: 'trash-2',
    callback: () => this.clearCache()
  };
  
  'timing-export-data': {
    id: 'timing-export-data',
    name: 'Timing: Export timing data',
    icon: 'download',
    callback: () => this.exportData()
  };
}
```

### 4. Context Menus

#### File Context Menu
```typescript
// Add to Daily Note context menu
interface FileContextMenuItems {
  'add-timing-section': {
    title: 'Add Timing Tracking section',
    icon: 'clock',
    condition: (file: TFile) => this.isDailyNote(file) && !this.hasTimingSection(file),
    callback: (file: TFile) => this.addTimingSection(file)
  };
  
  'update-timing-data': {
    title: 'Update Timing data',
    icon: 'refresh-cw',
    condition: (file: TFile) => this.isDailyNote(file) && this.hasTimingSection(file),
    callback: (file: TFile) => this.updateTimingData(file)
  };
}
```

## Modal Dialogs

### 1. Connection Setup Wizard

```typescript
class ConnectionSetupModal extends Modal {
  steps = [
    'welcome',
    'timing-detection',
    'permissions',
    'subscription-check',
    'test-connection',
    'complete'
  ];
  
  // Step 1: Welcome
  renderWelcomeStep(): void {
    const content = `
    # Welcome to Timing Plugin Setup
    
    This wizard will help you connect Obsidian to your Timing app for automatic time tracking integration.
    
    ## What you'll need:
    - Timing app installed (Expert or Connect subscription recommended)
    - AppleScript permissions for Obsidian
    - Daily Notes plugin (optional but recommended)
    
    [Continue] [Cancel]
    `;
  }
  
  // Step 2: Timing Detection
  renderTimingDetectionStep(): void {
    // Auto-detect Timing app
    // Show detection results
    // Allow manual path selection
  }
  
  // Step 3: Permissions
  renderPermissionsStep(): void {
    // Request AppleScript permissions
    // Provide instructions for manual setup
    // Test permission status
  }
}
```

### 2. Data Preview Modal

```typescript
class TimingDataPreviewModal extends Modal {
  constructor(app: App, private data: DailyTimeData) {
    super(app);
  }
  
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    
    // Header
    contentEl.createEl('h2', { text: `Timing Data - ${this.data.date}` });
    
    // Summary cards
    this.renderSummaryCards(contentEl);
    
    // Interactive timeline
    this.renderTimeline(contentEl);
    
    // Actions
    this.renderActions(contentEl);
  }
  
  private renderSummaryCards(container: HTMLElement): void {
    const summaryDiv = container.createDiv('timing-summary-cards');
    
    // Total time card
    const totalCard = summaryDiv.createDiv('summary-card');
    totalCard.createEl('h3', { text: 'Total Time' });
    totalCard.createEl('div', { 
      text: this.formatDuration(this.data.summary.totalTime),
      cls: 'summary-value'
    });
    
    // Top app card
    const topApp = this.getTopApplication();
    const appCard = summaryDiv.createDiv('summary-card');
    appCard.createEl('h3', { text: 'Most Used App' });
    appCard.createEl('div', { text: topApp.name, cls: 'summary-value' });
    appCard.createEl('div', { text: this.formatDuration(topApp.time), cls: 'summary-detail' });
  }
}
```

### 3. Error Resolution Modal

```typescript
class ErrorResolutionModal extends Modal {
  constructor(app: App, private error: TimingPluginError) {
    super(app);
  }
  
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    
    // Error icon and title
    const header = contentEl.createDiv('error-header');
    header.createEl('div', { cls: 'error-icon', text: '⚠️' });
    header.createEl('h2', { text: this.error.title });
    
    // Error description
    contentEl.createEl('p', { text: this.error.description });
    
    // Solution steps
    this.renderSolutionSteps(contentEl);
    
    // Action buttons
    this.renderActionButtons(contentEl);
  }
  
  private renderSolutionSteps(container: HTMLElement): void {
    const stepsDiv = container.createDiv('solution-steps');
    stepsDiv.createEl('h3', { text: 'How to fix this:' });
    
    const ol = stepsDiv.createEl('ol');
    for (const step of this.error.solutionSteps) {
      const li = ol.createEl('li');
      li.createEl('span', { text: step.description });
      
      if (step.action) {
        const button = li.createEl('button', { text: step.action.label });
        button.onclick = step.action.callback;
      }
    }
  }
}
```

## Visual Design Elements

### 1. Color Scheme

```css
:root {
  --timing-primary: #3b82f6;      /* Blue */
  --timing-success: #22c55e;      /* Green */
  --timing-warning: #f59e0b;      /* Yellow */
  --timing-error: #ef4444;        /* Red */
  --timing-neutral: #6b7280;      /* Gray */
  
  --timing-bg-primary: #f8fafc;
  --timing-bg-secondary: #f1f5f9;
  --timing-border: #e2e8f0;
  --timing-text: #1e293b;
  --timing-text-muted: #64748b;
}
```

### 2. Component Styles

```css
/* Summary Cards */
.timing-summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.summary-card {
  background: var(--timing-bg-primary);
  border: 1px solid var(--timing-border);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--timing-primary);
}

/* Status Indicators */
.timing-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.timing-status-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.timing-status-icon.active { background: var(--timing-success); }
.timing-status-icon.warning { background: var(--timing-warning); }
.timing-status-icon.error { background: var(--timing-error); }
.timing-status-icon.disabled { background: var(--timing-neutral); }

/* Timeline Visualization */
.timing-timeline {
  margin: 1rem 0;
  border: 1px solid var(--timing-border);
  border-radius: 8px;
  overflow: hidden;
}

.timeline-hour {
  display: flex;
  height: 40px;
  border-bottom: 1px solid var(--timing-border);
}

.timeline-block {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: white;
  cursor: pointer;
}
```

## Accessibility Features

### 1. Keyboard Navigation

```typescript
class KeyboardNavigationManager {
  private keyBindings = {
    'Ctrl+Shift+T': 'timing-sync-now',
    'Ctrl+Shift+D': 'timing-open-today',
    'Ctrl+Shift+S': 'timing-open-settings'
  };
  
  setupKeyboardShortcuts(): void {
    for (const [combo, commandId] of Object.entries(this.keyBindings)) {
      this.addCommand({
        id: commandId,
        name: this.getCommandName(commandId),
        hotkeys: [{ modifiers: this.parseModifiers(combo), key: this.parseKey(combo) }],
        callback: () => this.executeCommand(commandId)
      });
    }
  }
}
```

### 2. Screen Reader Support

```typescript
interface AccessibilityAttributes {
  'aria-label': string;
  'aria-describedby'?: string;
  'role'?: string;
  'tabindex'?: number;
}

class AccessibilityManager {
  addA11yAttributes(element: HTMLElement, attrs: AccessibilityAttributes): void {
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        element.setAttribute(key, value.toString());
      }
    }
  }
  
  announceStatusChange(status: string, importance: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', importance);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = status;
    
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }
}
```

## User Experience Patterns

### 1. Progressive Disclosure

```typescript
class ProgressiveDisclosure {
  // Show basic settings first
  renderBasicSettings(): void {
    // Essential connection and sync settings
  }
  
  // Advanced settings behind "Advanced" toggle
  renderAdvancedSettings(): void {
    // Cache settings, debug options, etc.
  }
  
  // Expert mode for power users
  renderExpertSettings(): void {
    // Raw data access, API endpoints, etc.
  }
}
```

### 2. Smart Defaults

```typescript
const SMART_DEFAULTS = {
  // Detect user's existing Daily Notes setup
  dailyNoteFormat: () => this.detectExistingDailyNoteFormat(),
  
  // Adjust update frequency based on usage
  updateInterval: () => this.calculateOptimalUpdateInterval(),
  
  // Configure features based on Timing subscription
  enabledFeatures: () => this.detectTimingSubscriptionFeatures()
};
```

### 3. Contextual Help

```typescript
class ContextualHelp {
  showTooltip(element: HTMLElement, content: string): void {
    // Show helpful tooltips on demand
  }
  
  showInlineHelp(setting: string): void {
    // Show contextual help for specific settings
  }
  
  showGettingStarted(): void {
    // Interactive getting started guide
  }
}
```

This comprehensive UI design ensures an intuitive, accessible, and powerful user experience while maintaining consistency with Obsidian's design patterns.
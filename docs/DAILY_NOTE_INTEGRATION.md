# Daily Note Detection & Creation Logic

## Overview

This document outlines the comprehensive strategy for detecting, creating, and updating Daily Notes with Timing data integration. The system must be flexible enough to work with various Daily Note configurations while maintaining compatibility with existing workflows.

## Daily Note Detection Strategy

### 1. Supported Date Formats

#### Primary Formats
- `2025-06-18` (ISO 8601 format)
- `2025/06/18` (Alternative slash format)
- `2025.06.18` (Dot separator format)
- `June 18, 2025` (Long format)  
- `18-06-2025` (European format)

#### Format Detection Algorithm
```typescript
interface DateFormat {
  pattern: RegExp;
  formatString: string;
  parser: (filename: string) => Date | null;
}

const SUPPORTED_DATE_FORMATS: DateFormat[] = [
  {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    formatString: 'YYYY-MM-DD',
    parser: (filename) => moment(filename, 'YYYY-MM-DD').toDate()
  },
  {
    pattern: /^\d{4}\/\d{2}\/\d{2}$/,
    formatString: 'YYYY/MM/DD',
    parser: (filename) => moment(filename, 'YYYY/MM/DD').toDate()
  },
  // Additional formats...
];
```

### 2. File Location Detection

#### Search Strategy (Priority Order)
1. **Daily Notes Plugin Integration**
   - Check if Daily Notes core plugin is enabled
   - Use plugin settings for folder and format
   - Respect user's configured date format

2. **Common Locations**
   - Root directory: `2025-06-18.md`
   - Daily folder: `Daily/2025-06-18.md`
   - Year/Month structure: `2025/06/2025-06-18.md`
   - Custom folders from user settings

3. **Template-based Detection**
   - Scan for files matching date patterns
   - Check file metadata for creation date correlation
   - Validate content structure for Daily Note characteristics

#### Detection Implementation
```typescript
class DailyNoteDetector {
  async findDailyNote(date: Date): Promise<TFile | null> {
    // 1. Check Daily Notes plugin settings
    const dailyNotesSettings = this.getDailyNotesPluginSettings();
    if (dailyNotesSettings?.enabled) {
      const expectedPath = this.buildDailyNotePath(date, dailyNotesSettings);
      const file = this.app.vault.getAbstractFileByPath(expectedPath);
      if (file instanceof TFile) return file;
    }

    // 2. Search common locations
    const searchPaths = this.generateSearchPaths(date);
    for (const path of searchPaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) return file;
    }

    // 3. Fuzzy search by content
    return await this.fuzzySearchDailyNote(date);
  }

  private generateSearchPaths(date: Date): string[] {
    const dateStrings = this.formatDateMultiple(date);
    const commonFolders = ['', 'Daily', 'Notes', 'Journal'];
    
    const paths: string[] = [];
    for (const folder of commonFolders) {
      for (const dateStr of dateStrings) {
        paths.push(folder ? `${folder}/${dateStr}.md` : `${dateStr}.md`);
      }
    }
    return paths;
  }
}
```

### 3. Content Structure Detection

#### Timing Section Identification
```typescript
interface TimingSectionInfo {
  exists: boolean;
  startLine: number;
  endLine: number;
  content: string;
  headerLevel: number;
}

class TimingSectionParser {
  findTimingSection(content: string): TimingSectionInfo {
    const lines = content.split('\n');
    const timingHeaderRegex = /^#{1,6}\s*timing\s*tracking/i;
    
    let startLine = -1;
    let headerLevel = 0;
    
    // Find timing section header
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(timingHeaderRegex);
      if (match) {
        startLine = i;
        headerLevel = (lines[i].match(/^#+/) || [''])[0].length;
        break;
      }
    }
    
    if (startLine === -1) {
      return { exists: false, startLine: -1, endLine: -1, content: '', headerLevel: 0 };
    }
    
    // Find section end
    let endLine = lines.length;
    for (let i = startLine + 1; i < lines.length; i++) {
      const lineHeaderMatch = lines[i].match(/^#+/);
      if (lineHeaderMatch && lineHeaderMatch[0].length <= headerLevel) {
        endLine = i;
        break;
      }
    }
    
    return {
      exists: true,
      startLine,
      endLine,
      content: lines.slice(startLine, endLine).join('\n'),
      headerLevel
    };
  }
}
```

## Daily Note Creation Logic

### 1. Auto-Creation Strategy

#### Creation Decision Matrix
| Scenario | Daily Notes Plugin | User Setting | Action |
|----------|-------------------|--------------|---------|
| File not found | Enabled | Auto-create ON | Create using plugin template |
| File not found | Enabled | Auto-create OFF | Prompt user |
| File not found | Disabled | Auto-create ON | Create basic template |
| File not found | Disabled | Auto-create OFF | Show error, offer manual creation |

#### Template Generation
```typescript
interface DailyNoteTemplate {
  title: string;
  content: string;
  timingSectionLocation: 'top' | 'bottom' | 'after-header' | 'custom';
}

class DailyNoteCreator {
  async createDailyNote(date: Date): Promise<TFile> {
    const template = await this.generateTemplate(date);
    const filePath = this.generateFilePath(date);
    
    // Ensure parent directory exists
    await this.ensureDirectoryExists(path.dirname(filePath));
    
    // Create file with template content
    const file = await this.app.vault.create(filePath, template.content);
    
    return file;
  }

  private async generateTemplate(date: Date): Promise<DailyNoteTemplate> {
    const dateStr = this.formatDate(date);
    
    // Check for existing template from Daily Notes plugin or Templates plugin
    const existingTemplate = await this.getExistingTemplate();
    if (existingTemplate) {
      return this.injectTimingSection(existingTemplate, dateStr);
    }
    
    // Generate default template
    return {
      title: dateStr,
      content: this.generateDefaultTemplate(dateStr),
      timingSectionLocation: 'bottom'
    };
  }

  private generateDefaultTemplate(dateStr: string): string {
    return `# ${dateStr}

## Daily Overview

## Tasks

## Timing Tracking
<!-- Timing data will be automatically updated here -->

## Reflection
`;
  }
}
```

### 2. Section Management

#### Timing Section Insertion Logic
```typescript
class TimingSectionManager {
  async updateTimingSection(file: TFile, timingData: DailyTimeData): Promise<void> {
    const content = await this.app.vault.read(file);
    const sectionInfo = this.parser.findTimingSection(content);
    
    if (sectionInfo.exists) {
      await this.replaceExistingSection(file, sectionInfo, timingData);
    } else {
      await this.insertNewSection(file, timingData);
    }
  }

  private async replaceExistingSection(
    file: TFile, 
    sectionInfo: TimingSectionInfo, 
    timingData: DailyTimeData
  ): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    
    // Preserve user's reflection content
    const reflectionContent = this.extractReflectionContent(sectionInfo.content);
    
    // Generate new timing content
    const newTimingContent = this.generateTimingContent(timingData, reflectionContent);
    
    // Replace section content
    const newLines = [
      ...lines.slice(0, sectionInfo.startLine),
      newTimingContent,
      ...lines.slice(sectionInfo.endLine)
    ];
    
    await this.app.vault.modify(file, newLines.join('\n'));
  }

  private async insertNewSection(file: TFile, timingData: DailyTimeData): Promise<void> {
    const content = await this.app.vault.read(file);
    const insertionPoint = this.findInsertionPoint(content);
    
    const timingContent = this.generateTimingContent(timingData);
    const newContent = this.insertAtPosition(content, insertionPoint, timingContent);
    
    await this.app.vault.modify(file, newContent);
  }

  private findInsertionPoint(content: string): number {
    const settings = this.plugin.settings;
    
    switch (settings.timingSectionLocation) {
      case 'top':
        return this.findAfterTitle(content);
      case 'bottom':
        return content.length;
      case 'after-header':
        return this.findAfterSpecificHeader(content, settings.afterHeaderName);
      default:
        return content.length;
    }
  }
}
```

## Compatibility & Integration

### 1. Daily Notes Plugin Compatibility

#### Settings Integration
```typescript
interface DailyNotesPluginSettings {
  format: string;          // Date format string
  folder: string;          // Target folder
  template: string;        // Template file path
}

class DailyNotesIntegration {
  getDailyNotesPluginSettings(): DailyNotesPluginSettings | null {
    const dailyNotesPlugin = this.app.plugins.getPlugin('daily-notes');
    if (!dailyNotesPlugin?.settings) return null;
    
    return {
      format: dailyNotesPlugin.settings.format || 'YYYY-MM-DD',
      folder: dailyNotesPlugin.settings.folder || '',
      template: dailyNotesPlugin.settings.template || ''
    };
  }
}
```

### 2. Templates Plugin Integration

#### Template Enhancement
- Detect if Templates plugin is active
- Add Timing section to existing templates
- Provide template variables for timing data

### 3. Calendar Plugin Integration

#### Navigation Support
- Support calendar-based Daily Note navigation
- Update timing data when date changes in calendar
- Maintain data consistency across date switches

## User Configuration Options

### 1. File Location Settings
```typescript
interface DailyNoteSettings {
  dateFormat: string;              // 'YYYY-MM-DD' | 'YYYY/MM/DD' | custom
  folder: string;                  // Target folder path
  autoCreate: boolean;             // Auto-create missing Daily Notes
  timingSectionLocation: 'top' | 'bottom' | 'after-header' | 'custom';
  afterHeaderName?: string;        // For 'after-header' option
  customTemplate?: string;         // Custom template content
}
```

### 2. Content Settings
```typescript
interface TimingContentSettings {
  includeTimeline: boolean;        // Show detailed timeline
  includeReflection: boolean;      // Include reflection section
  groupBy: 'application' | 'category' | 'both';
  timeFormat: '12h' | '24h';       // Time display format
  minimumDuration: number;         // Minimum minutes to include in report
}
```

## Performance Considerations

### 1. File System Optimization
- Cache Daily Note file references
- Minimize file system scans
- Use Obsidian's file watching for updates

### 2. Content Processing
- Lazy loading of content parsing
- Efficient section replacement algorithms
- Minimal file modifications

### 3. Memory Management
- Limit cached Daily Note data
- Clean up old file references
- Optimize regular expression usage

## Testing Strategy

### 1. File Detection Tests
- Various date formats and folder structures
- Different Daily Notes plugin configurations
- Edge cases (missing folders, invalid dates)

### 2. Content Manipulation Tests
- Section insertion and replacement
- Template preservation
- User content protection

### 3. Integration Tests
- Daily Notes plugin compatibility
- Templates plugin interaction
- Calendar plugin synchronization

This comprehensive Daily Note integration design ensures seamless operation with existing Obsidian workflows while providing flexible configuration options for diverse user needs.
# Timing Plugin Design Document

## Overview

The Timing Plugin integrates Obsidian with the Timing app for macOS to automatically track and record time usage data in Daily Notes and Weekly Notes. This plugin aims to help users review and improve their time management by providing structured time tracking data directly within their notes.

## Core Features

### 1. Time Data Integration
- Retrieve time tracking data from Timing app via AppleScript
- Automatically insert time usage statistics into Daily Notes and Weekly Notes
- Support for both application-level and category-level time tracking

### 2. Note Integration
- Seamless integration with Daily Notes plugin
- Support for Weekly Notes (if Weekly Notes plugin is installed)
- Customizable data insertion format and templates

### 3. Time Analysis & Review
- Structured format for time usage review in Daily Notes
- Template sections for reflection and improvement planning
- Historical data comparison capabilities

## Technical Architecture

### 1. Data Source
- **Primary**: Timing app for macOS
- **Interface**: AppleScript integration
- **Fallback**: Manual data input (for non-macOS users)

### 2. Data Processing
- Parse time tracking data from Timing app
- Categorize and structure data for note insertion
- Calculate daily/weekly summaries and trends

### 3. Note Integration
- Detect Daily Notes and Weekly Notes
- Insert formatted time data at specified locations
- Respect existing note structure and user templates

## Detailed Requirements

Based on user requirements, the following specifications have been defined:

### Data Requirements
- **Granularity**: Both application-level and category-level data required
- **Time Detail**: Maximum granularity available from Timing app (minute-by-minute activity tracking)
- **Data Scope**: Current day data for Daily Notes, with historical comparison capabilities
- **Real-time Updates**: Live data synchronization preferred

### Note Integration Specifications
- **Daily Note Format**: 
  - Date formats: `2025/06/18` or `2025-06-18`
  - No existing template requirements
- **Integration Point**: Data inserted into `## Timing Tracking` section
- **Update Strategy**: Real-time updates with section replacement

### Data Structure Design

#### Time Entry Format
```typescript
interface TimeEntry {
  startTime: string;     // "09:15:30"
  endTime: string;       // "09:45:15"
  duration: number;      // seconds
  application: string;   // "Obsidian"
  category?: string;     // "Writing", "Research"
  title?: string;        // Window/document title if available
}

interface DailyTimeData {
  date: string;          // "2025-06-18"
  entries: TimeEntry[];
  summary: {
    totalTime: number;
    byApplication: Map<string, number>;
    byCategory: Map<string, number>;
    byHour: Map<number, number>;
  };
}
```

#### Daily Note Format
```markdown
# 2025-06-18

## Timing Tracking

### Summary
- Total tracked time: 8h 32m
- Most used app: Obsidian (3h 15m)
- Most productive hour: 10:00-11:00 (1h 45m)

### By Application
| Application | Time | Percentage |
|-------------|------|------------|
| Obsidian    | 3h 15m | 38.1% |
| VS Code     | 2h 30m | 29.2% |
| Safari      | 1h 45m | 20.5% |
| Slack       | 1h 02m | 12.2% |

### By Category
| Category | Time | Percentage |
|----------|------|------------|
| Writing  | 2h 45m | 32.2% |
| Development | 2h 30m | 29.2% |
| Research | 1h 30m | 17.6% |
| Communication | 1h 47m | 21.0% |

### Timeline
- 09:00-09:30: Obsidian (Writing)
- 09:30-10:15: VS Code (Development)
- 10:15-10:30: Break
- 10:30-12:00: Obsidian (Writing)
- ...

### Reflection
<!-- Space for daily time usage review and insights -->
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **AppleScript Integration**
   - Create AppleScript wrapper for Timing app data extraction
   - Implement data parsing and validation
   - Handle error cases and app availability

2. **Data Management**
   - Implement TimeEntry and DailyTimeData interfaces
   - Create data aggregation and summary functions
   - Build efficient data storage and retrieval

3. **Daily Note Integration**
   - Detect Daily Notes (support both date formats)
   - Find or create `## Timing Tracking` sections
   - Implement section content replacement

### Phase 2: Real-time Updates
1. **Background Monitoring**
   - Implement periodic data fetching (every 5-10 minutes)
   - Optimize for minimal performance impact
   - Handle Timing app state changes

2. **Smart Updates**
   - Only update when new data is available
   - Preserve user modifications in reflection sections
   - Batch updates to avoid excessive file writes

### Phase 3: Advanced Features
1. **Data Visualization**
   - Enhanced timeline view
   - Productivity patterns analysis
   - Weekly/monthly trend comparison

2. **Customization**
   - Configurable data formats and sections
   - Custom category mapping
   - Template customization options

## Technical Considerations

### AppleScript Requirements
- Timing app must be running and accessible
- Require user permission for AppleScript automation
- Handle cases where Timing app is not available

### Performance Optimization
- Cache recent data to minimize AppleScript calls
- Implement incremental updates for large datasets
- Background processing to avoid UI blocking

### Error Handling
- Graceful degradation when Timing app is unavailable
- Data validation and corruption recovery
- User feedback for configuration issues
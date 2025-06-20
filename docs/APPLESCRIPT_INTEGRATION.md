# AppleScript Integration Specification

## Overview

This document outlines the technical specification for integrating with the Timing app using AppleScript to retrieve time tracking data.

## Timing App Requirements

### Subscription Levels
- **Basic Plan**: Limited AppleScript functionality
- **Expert Plan**: Basic scripting capabilities
- **Timing Connect Plan**: Full AppleScript API access with advanced features

### Key Integration Points
- **Application Target**: `TimingHelper` (not the main Timing app)
- **Data Export Formats**: JSON, CSV, HTML, Excel
- **Granularity**: Minute-level time tracking data
- **Date Range Support**: Configurable time periods for data retrieval

## AppleScript Commands

### Basic Data Retrieval
```applescript
tell application "TimingHelper"
    -- Get time summary for today
    set todayData to get time summary for date (current date)
    
    -- Get detailed time entries for specific date
    set timeEntries to get time entries for date "2025-06-18"
    
    -- Export data in JSON format
    set jsonData to export data as JSON for date range from "2025-06-18" to "2025-06-18"
end tell
```

### Advanced Features (Timing Connect Required)
```applescript
tell application "TimingHelper"
    -- Get project-based time tracking
    set projectData to get projects with time data for date "2025-06-18"
    
    -- Get productivity ratings
    set productivityData to get productivity ratings for date "2025-06-18"
    
    -- Generate detailed reports
    set reportData to generate report for date range from "2025-06-18" to "2025-06-18" with categories
end tell
```

## Data Structure Mapping

### Expected Timing Data Format
```json
{
  "date": "2025-06-18",
  "entries": [
    {
      "startTime": "09:15:30",
      "endTime": "09:45:15",
      "duration": 1785,
      "application": "Obsidian",
      "category": "Writing",
      "title": "Daily Note - 2025-06-18.md",
      "productivity": 4
    }
  ],
  "summary": {
    "totalTime": 30870,
    "applications": {
      "Obsidian": 11700,
      "VS Code": 9000,
      "Safari": 6300,
      "Slack": 3870
    },
    "categories": {
      "Writing": 9900,
      "Development": 9000,
      "Research": 5400,
      "Communication": 6570
    }
  }
}
```

### Plugin Data Interface Mapping
```typescript
// Convert Timing data to plugin format
interface TimingRawData {
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

// Transform to plugin TimeEntry format
function transformTimingData(rawData: TimingRawData): DailyTimeData {
  return {
    date: rawData.date,
    entries: rawData.entries.map(entry => ({
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
      application: entry.application,
      category: entry.category,
      title: entry.title
    })),
    summary: {
      totalTime: rawData.summary.totalTime,
      byApplication: new Map(Object.entries(rawData.summary.applications)),
      byCategory: new Map(Object.entries(rawData.summary.categories)),
      byHour: calculateHourlyBreakdown(rawData.entries)
    }
  };
}
```

## Implementation Strategy

### Phase 1: Basic Integration
1. **AppleScript Wrapper**
   - Create TypeScript wrapper for AppleScript execution
   - Handle Expert plan features (basic time summaries)
   - Implement error handling for missing Timing app

2. **Data Parsing**
   - Parse JSON export from Timing
   - Validate data structure and handle missing fields
   - Convert to internal plugin data format

### Phase 2: Advanced Features (Timing Connect)
1. **Enhanced Data Retrieval**
   - Project-based time tracking
   - Productivity ratings integration
   - Category-based reporting

2. **Performance Optimization**
   - Incremental data updates
   - Caching mechanism for recent data
   - Background data synchronization

### Error Handling Strategy

```typescript
enum TimingIntegrationError {
  APP_NOT_FOUND = 'Timing app not found',
  INSUFFICIENT_PERMISSIONS = 'AppleScript permissions required',
  SUBSCRIPTION_REQUIRED = 'Timing Connect subscription required',
  DATA_PARSING_ERROR = 'Failed to parse Timing data',
  APPLESCRIPT_EXECUTION_ERROR = 'AppleScript execution failed'
}

class TimingIntegration {
  async checkTimingAvailability(): Promise<boolean> {
    // Check if TimingHelper is available
    // Verify subscription level
    // Test AppleScript permissions
  }
  
  async getTimeDataForDate(date: string): Promise<DailyTimeData> {
    try {
      // Execute AppleScript command
      // Parse returned data
      // Transform to plugin format
    } catch (error) {
      // Handle specific error types
      // Provide user-friendly error messages
      // Implement fallback mechanisms
    }
  }
}
```

## Testing Strategy

### Unit Tests
- AppleScript command generation
- Data parsing and transformation
- Error handling scenarios

### Integration Tests
- Timing app communication
- Data accuracy validation
- Performance benchmarking

### User Acceptance Tests
- Different Timing subscription levels
- Various date formats and ranges
- Real-world usage scenarios

## Security Considerations

### AppleScript Permissions
- Request appropriate system permissions
- Handle permission denial gracefully
- Provide clear user instructions for setup

### Data Privacy
- Process data locally only
- No external data transmission
- Respect user's time tracking privacy

## Future Enhancements

### Advanced Analytics
- Weekly/monthly trend analysis
- Productivity pattern recognition
- Goal tracking and progress monitoring

### Customization Options
- Configurable data filters
- Custom category mapping
- Template-based output formatting
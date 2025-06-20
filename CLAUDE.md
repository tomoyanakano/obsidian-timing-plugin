# Claude Development Context

## Project Overview
This is an Obsidian plugin that integrates with the Timing app for macOS to provide automatic time tracking data in Daily Notes and Weekly Notes.

## Key Requirements
- Real-time time tracking data integration
- Support for both application-level and category-level data
- Maximum granularity (minute-by-minute tracking)
- Integration with `## Timing Tracking` sections in Daily Notes
- Daily Note formats: `2025/06/18` or `2025-06-18`

## Technical References
- **Timing App AppleScript Documentation**: https://timingapp.com/help/applescript
- **Key Integration Points**:
  - Use `tell application "TimingHelper"` for AppleScript commands
  - Basic scripting available in "Expert" plan
  - Advanced features require "Timing Connect" subscription
  - Supports time summaries, project details, and detailed reports
  - Export formats: Excel, CSV, HTML, JSON

## Development Commands
- `npm run dev` - Start development with watch mode
- `npm run build` - Build for production

## Architecture Notes
- Plugin targets Community Plugin publication
- Documentation in English for international audience
- Real-time updates preferred (5-10 minute intervals)
- Preserve user modifications in reflection sections
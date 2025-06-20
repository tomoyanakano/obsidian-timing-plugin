# Timing Integration for Obsidian

[![Release](https://img.shields.io/github/v/release/obsidian-timing-plugin/obsidian-timing-plugin)](https://github.com/obsidian-timing-plugin/obsidian-timing-plugin/releases)
[![Downloads](https://img.shields.io/badge/downloads-0-blue)](https://obsidian.md/plugins?id=obsidian-timing-plugin)
[![License](https://img.shields.io/github/license/obsidian-timing-plugin/obsidian-timing-plugin)](LICENSE)

**Seamlessly integrate macOS [Timing app](https://timingapp.com/) with Obsidian for automatic time tracking in your Daily and Weekly Notes.**

Transform your productivity workflow with real-time time tracking data, beautiful timeline visualizations, and insightful analytics directly in your knowledge base.

## ✨ Features

### 🕐 Automatic Time Tracking
- **Real-time Integration**: Automatically sync time tracking data from Timing app
- **Daily Notes Integration**: Add timing sections to your daily notes
- **Weekly Notes Support**: Generate comprehensive weekly productivity reports
- **Flexible Scheduling**: Configurable sync intervals (1-60 minutes)

### 📊 Rich Visualizations
- **Interactive Timeline**: Visual timeline with hover details and zoom controls
- **Color-coded Activities**: Distinct colors for different applications
- **Productivity Analytics**: Focus time, meeting time, and break time breakdown
- **Weekly Summaries**: Comprehensive weekly productivity insights

### 🔧 Powerful Customization
- **Flexible Note Formats**: Support for multiple date formats (`YYYY-MM-DD`, `YYYY/MM/DD`, etc.)
- **Smart Section Placement**: Top, bottom, or after custom headers
- **Auto-creation**: Automatically create Daily/Weekly Notes if needed
- **Minimum Duration Filtering**: Filter out short activities for cleaner data

### 🎯 Productivity Insights
- **Application Breakdown**: Detailed analysis of time spent in each app
- **Category Tracking**: Project and category-based time organization
- **Most Productive Days**: Identify your peak performance patterns
- **Weekly Trends**: Track productivity changes over time

## 🚀 Quick Start

### Prerequisites
- **macOS**: This plugin requires macOS and the Timing app
- **Timing App**: Install [Timing](https://timingapp.com/) (Expert plan recommended)
- **Timing Connect**: Advanced features require Timing Connect subscription
- **Obsidian**: Version 0.15.0 or later

### Installation

#### Method 1: Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to **Community plugins** → **Browse**
3. Search for "**Timing Integration**"
4. Click **Install** → **Enable**

#### Method 2: Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/obsidian-timing-plugin/obsidian-timing-plugin/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-timing-plugin/` folder
3. Reload Obsidian and enable the plugin

### Setup Wizard
1. After installation, the **Setup Wizard** will guide you through:
   - Testing Timing app connection
   - Configuring AppleScript permissions
   - Setting up Daily/Weekly Notes integration
   - Choosing your preferred settings

## 📖 Usage Guide

### Daily Notes Integration

The plugin automatically adds a **Timing Tracking** section to your daily notes:

```markdown
## Timing Tracking

### Overview
- **Total Time**: 8h 24m
- **Most Used App**: VS Code (3h 45m)
- **Most Productive Hour**: 10:00 AM

### Application Breakdown
- **VS Code**: 3h 45m (44.6%)
- **Chrome**: 2h 30m (29.8%)
- **Slack**: 1h 15m (14.9%)
- **Zoom**: 54m (10.7%)

### Timeline
- 09:00 - 10:30: VS Code (Coding)
- 10:30 - 11:00: Chrome (Research)
- 11:00 - 12:00: Zoom (Team Meeting)
...
```

### Weekly Notes Integration

Generate comprehensive weekly reports with:

```markdown
## Weekly Timing Summary

### Overview
- **Week**: 2025-06-16 — 2025-06-22
- **Total Time**: 42h 30m
- **Average Daily**: 6h 4m
- **Most Productive Day**: Tuesday

### Productivity Breakdown
- **Focus Time**: 28h 15m (66.5%)
- **Meeting Time**: 8h 30m (20.0%)
- **Break Time**: 5h 45m (13.5%)

### Daily Breakdown
- **Tuesday**: 8h 30m
- **Monday**: 7h 45m
- **Wednesday**: 6h 30m
...
```

### Timeline Visualization

Open the **Timeline View** to see your day at a glance:
- **Colorful blocks** representing different applications
- **Zoom controls** for detailed or overview perspectives
- **Hover details** showing activity information
- **Date navigation** to explore different days

### Available Commands

Access these commands via Command Palette (`Cmd+P`):

#### Daily Notes
- `Timing: Sync timing data now`
- `Timing: Update current Daily Note with timing data`
- `Timing: Create Daily Note with timing section`
- `Timing: Open today's Daily Note`

#### Weekly Notes
- `Timing: Update current Weekly Note with timing data`
- `Timing: Create Weekly Note with timing section`
- `Timing: Open this week's Weekly Note`
- `Timing: Sync weekly timing data`

#### Views & Tools
- `Timing: Open timing data view`
- `Timing: Open timing timeline`
- `Timing: Test Timing app connection`
- `Timing: Sync timing data for specific date`

## ⚙️ Configuration

### Basic Settings
- **Enable Time Tracking**: Turn automatic tracking on/off
- **Update Interval**: How often to sync (1-60 minutes)
- **Timing App Path**: Path to Timing.app

### Daily Notes Settings
- **Date Format**: Choose from `YYYY-MM-DD`, `YYYY/MM/DD`, `DD-MM-YYYY`
- **Folder**: Specify folder for Daily Notes
- **Auto-create**: Automatically create notes if missing
- **Section Location**: Top, bottom, or after specific header

### Weekly Notes Settings
- **Enable Weekly Notes**: Turn weekly integration on/off
- **Weekly Folder**: Folder for Weekly Notes
- **Date Format**: `2025-W25`, `2025-06-16`, or `2025-W25` (ISO)
- **Week Starts On**: Monday or Sunday
- **Include Summary**: Detailed productivity breakdown
- **Include Reflection**: Weekly reflection section

### Display Settings
- **Include Timeline**: Show detailed activity timeline
- **Include Reflection**: Add reflection sections
- **Group By**: Application, category, or both
- **Time Format**: 12-hour or 24-hour
- **Minimum Duration**: Filter out short activities

## 🔍 Troubleshooting

### Common Issues

#### "Timing app not found"
1. Ensure Timing app is installed and running
2. Check the app path in settings
3. Verify TimingHelper is enabled in Timing preferences

#### "AppleScript permissions required"
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Automation** from the left sidebar
3. Find **Obsidian** and check the box for **Timing**

#### "Timing Connect subscription required"
- Advanced features require a Timing Connect subscription
- Basic time summaries work with the Expert plan
- Detailed reports need Timing Connect

#### No data appearing
1. Check if Timing is actively tracking
2. Verify the date range in Timing has data
3. Test connection using "Test Timing app connection" command
4. Check console for error messages

### Getting Help

1. **Test Connection**: Use the built-in connection test
2. **Check Logs**: Open Developer Console (`Cmd+Opt+I`) for errors
3. **Reset Settings**: Try disabling and re-enabling the plugin
4. **Report Issues**: [GitHub Issues](https://github.com/obsidian-timing-plugin/obsidian-timing-plugin/issues)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/obsidian-timing-plugin/obsidian-timing-plugin.git

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📋 Requirements

- **macOS**: Required for AppleScript integration
- **Timing App**: [Download from timingapp.com](https://timingapp.com/)
- **Timing Plan**: Expert plan (basic) or Timing Connect (advanced features)
- **Obsidian**: Version 0.15.0 or later

## 🔒 Privacy & Security

- **Local Processing**: All data processing happens locally on your device
- **No Cloud Storage**: Timing data never leaves your computer
- **AppleScript Only**: Uses standard macOS AppleScript for Timing integration
- **Obsidian Vault**: Data is stored only in your Obsidian vault

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Timing App](https://timingapp.com/)** - For the excellent time tracking application
- **[Obsidian](https://obsidian.md/)** - For the amazing knowledge management platform
- **Community** - For feedback, testing, and contributions

## 🔗 Links

- **[Timing App](https://timingapp.com/)** - Official Timing website
- **[Timing AppleScript Documentation](https://timingapp.com/help/applescript)** - AppleScript reference
- **[Obsidian Community](https://obsidian.md/community)** - Join the Obsidian community
- **[GitHub Repository](https://github.com/obsidian-timing-plugin/obsidian-timing-plugin)** - Source code and issues

---

**Made with ❤️ for the Obsidian and Timing communities**

*Transform your productivity insights into actionable knowledge.*
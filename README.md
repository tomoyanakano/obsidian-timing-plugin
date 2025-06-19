# Obsidian Timing Plugin

An Obsidian plugin that integrates with [Timing app](https://timingapp.com/) for automatic time tracking.

## Features

- Automatic time tracking when working in Obsidian
- Integration with Timing app for macOS
- Track time spent on specific notes or projects
- Seamless background operation

## Installation

### Manual Installation

1. Download the latest release from GitHub releases
2. Extract the files to your vault's `.obsidian/plugins/timing-plugin/` folder
3. Reload Obsidian
4. Enable the plugin in Settings > Community plugins

### Development Installation

1. Clone this repository
2. Run `npm install` to install dependencies  
3. Run `npm run dev` to start compilation in watch mode
4. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/timing-plugin/` folder

## Requirements

- Obsidian v0.15.0 or higher
- Timing app for macOS (for full functionality)

## Usage

Once installed and enabled, the plugin will automatically track your time spent in Obsidian and integrate with your Timing app data.

## Development

This plugin is built with TypeScript and uses the Obsidian Plugin API.

### Building

- `npm run dev` - Start development with watch mode
- `npm run build` - Build for production

### Project Structure

- `main.ts` - Main plugin code
- `manifest.json` - Plugin manifest
- `styles.css` - Plugin styles

## License

MIT License - see LICENSE file for details.
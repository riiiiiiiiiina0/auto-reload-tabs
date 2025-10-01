# Reloader Bear 🐻

Automatically reloads tabs based on URL patterns with customizable intervals.

## Features

- **URL Pattern Matching**: Define URL patterns (simple string matching) to automatically reload matching tabs
- **Custom Reload Intervals**: Set reload intervals in minutes for each URL pattern
- **Live Countdown Badge**: Shows remaining time on the extension icon (e.g., "5m" or "45s") for the active tab
- **Beautiful UI**: Modern interface built with TailwindCSS and DaisyUI

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select the extension directory
5. The Reloader Bear icon should appear in your extensions toolbar

## Usage

### Adding URL Patterns

1. Right-click the extension icon and select "Options" (or go to `chrome://extensions/` and click "Details" → "Extension options")
2. Enter a URL pattern (e.g., `example.com`, `/dashboard`, `localhost:3000`)
3. Set the reload interval in minutes
4. Click "Add Pattern"

### How It Works

- The extension checks if the current tab's URL **includes** the pattern string (case-sensitive)
- If multiple patterns match a URL, the **last matching pattern** is used
- The badge shows the countdown timer for the currently active tab:
  - More than 1 minute: displays minutes (e.g., "5m")
  - Less than 1 minute: displays seconds (e.g., "45s")
- Tabs automatically reload when the timer reaches zero

### Managing Patterns

- View all configured patterns in the Options page
- Delete patterns by clicking the "Delete" button
- Patterns are synced across your Chrome profile

## Examples

| URL Pattern      | Matches                     | Doesn't Match           |
| ---------------- | --------------------------- | ----------------------- |
| `example.com`    | `https://example.com/page`  | `https://test.com`      |
| `localhost:3000` | `http://localhost:3000/app` | `http://localhost:8080` |
| `/dashboard`     | `https://app.com/dashboard` | `https://app.com/home`  |

## Tech Stack

- Vanilla JavaScript (no build steps)
- Chrome Extension Manifest V3
- TailwindCSS + DaisyUI for styling
- Chrome Storage Sync API
- Chrome Alarms API for reliable timers

## Development

See [AGENTS.md](AGENTS.md) for development guidelines and code style.

<a href="https://buymeacoffee.com/riiiiiiiiiina" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

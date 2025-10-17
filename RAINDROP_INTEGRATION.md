# Raindrop.io Integration - Implementation Summary

This document summarizes the Raindrop.io integration features implemented for the Reloader Bear extension.

## Features Implemented

### 1. OAuth Login to Raindrop (Options Page)

- **UI**: Added "Raindrop.io Sync" section at the top of the options page
- **Login Button**: Opens OAuth flow via `https://ohauth.vercel.app`
- **Status Display**: Shows connection status (connected/not connected)
- **Logout Button**: Clears OAuth tokens and disables auto backup

### 2. Manual Backup to Raindrop

- **Backup Button**: Manually backs up all patterns to Raindrop
- **Collection**: Creates/uses "Reloader Bear" collection
- **Operations**:
  - Creates new items for new patterns
  - Updates existing items when patterns change
  - Deletes items for removed patterns
- **Data Mapping**:
  - Pattern URL → Raindrop link (custom protocol: `reloader-bear://patterns/{urlPattern}`)
  - Pattern data → Stored in Raindrop excerpt field as JSON

### 3. Auto Backup

- **Toggle**: Enable/disable in options page when logged in
- **Triggers**: Automatically backs up when:
  - A pattern is added
  - A pattern is updated
  - A pattern is deleted
- **Debouncing**: 5-second delay to avoid excessive API calls
- **Smart Sync**: Cancels pending backups when new changes occur
- **Visual Feedback**: Badge indicators show backup status:
  - ⟳ (orange) - Backup in progress
  - ✓ (green) - Backup successful (clears after 3s)
  - ✗ (red) - Backup failed (clears after 5s)

### 4. Auto Restore from Raindrop

- **Startup**: Fetches patterns when extension starts
- **OAuth Login**: Fetches patterns after successful login
- **Silent Mode**: Runs in background without notifications
- **Conflict Prevention**: Prevents concurrent restore operations

## File Structure

```
auto-reload-tabs/
├── manifest.json                     # Updated with permissions
├── src/
│   ├── modules/
│   │   ├── oauth.js                  # OAuth token reception & storage
│   │   ├── raindropBackup.js         # Backup/restore API logic
│   │   ├── autoBackup.js             # Auto backup scheduling
│   │   └── badge.js                  # Badge status indicators
│   ├── background/
│   │   └── service-worker.js         # Coordination & event handling
│   └── options/
│       ├── options.html              # UI with Raindrop section
│       └── options.js                # Raindrop UI handlers
```

## Key Technical Details

### OAuth Flow

1. User clicks "Login to Raindrop" in options page
2. Extension opens `https://ohauth.vercel.app/oauth/raindrop`
3. User authorizes on Raindrop.io
4. OAuth service sends tokens via `postMessage` (externally_connectable)
5. Background script receives and stores tokens in `chrome.storage.sync`
6. Notification shown to user
7. Auto restore triggered after login

### Data Mapping

Each pattern is stored as a Raindrop item:

| Pattern Field     | Raindrop Field   | Notes                                                    |
| ----------------- | ---------------- | -------------------------------------------------------- |
| URL Pattern       | `link`           | Custom protocol: `reloader-bear://patterns/{urlPattern}` |
| Display Title     | `title`          | Format: `{urlPattern} ({intervalMinutes}m)`              |
| Full Pattern Data | `excerpt`        | JSON metadata with all pattern details                   |
| Collection        | `collection.$id` | "Reloader Bear" collection                               |
| Tags              | `tags`           | `['reloader-bear', 'pattern']`                           |

### Token Management

- **Storage**: Tokens stored in `chrome.storage.sync` for cross-device sync
- **Expiry Check**: Automatic check before each API call
- **Auto Refresh**: Refreshes when < 10 minutes remaining
- **Buffer**: 10-minute buffer before expiry

### Rate Limiting

- **Exponential Backoff**: Retries with 1s, 2s, 4s, 8s, 16s delays on 429 errors
- **Request Throttling**: 100ms delay between batch operations
- **Pagination**: Fetches items in batches of 50

## Configuration

### Manifest.json Changes

```json
{
  "permissions": ["notifications"],
  "host_permissions": [
    "https://api.raindrop.io/*",
    "https://ohauth.vercel.app/*"
  ],
  "externally_connectable": {
    "matches": ["https://ohauth.vercel.app/*"]
  },
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  }
}
```

## Testing Guide

### 1. Test OAuth Login

1. Open extension options page
2. Click "Login to Raindrop" button
3. Authorize on Raindrop.io
4. Verify notification appears
5. Verify UI shows "Connected to Raindrop.io"
6. Check Chrome DevTools Console for "[Raindrop] OAuth login detected"

### 2. Test Manual Backup

1. Make sure you're logged in
2. Add some patterns (e.g., "example.com", "localhost:3000")
3. Click "Backup to Raindrop" button
4. Watch the extension icon badge:
   - Should show ⟳ (orange) during backup
   - Should show ✓ (green) for 3 seconds on success
5. Verify success notification shows creation count
6. Open Raindrop.io and check "Reloader Bear" collection
7. Verify all patterns appear as items

### 3. Test Auto Backup

1. Enable "Auto Backup" toggle in options
2. Add a new pattern
3. Wait 5 seconds
4. Check DevTools Console for "[Auto Backup] Backup scheduled"
5. Watch the extension icon badge:
   - Should show ⟳ (orange) during auto backup
   - Should show ✓ (green) for 3 seconds on success
6. Verify pattern appears in Raindrop within 5 seconds
7. Update a pattern, wait 5 seconds, verify it updates
8. Delete a pattern, wait 5 seconds, verify it's removed from Raindrop

### 4. Test Auto Restore

1. Make changes to patterns in Raindrop.io directly
2. Wait up to 5 minutes for periodic restore
3. OR reload the extension to trigger restore on startup
4. Verify local patterns match Raindrop
5. Check DevTools Console for "[Raindrop] Restore completed"

### 5. Test Manual Restore

1. Delete all local patterns
2. Click "Restore from Raindrop" button
3. Confirm the dialog
4. Verify all patterns are restored from Raindrop
5. Check that tab reload timers are updated

### 6. Test Logout

1. Click "Logout" button
2. Confirm the dialog
3. Verify UI shows "Not connected"
4. Verify auto backup toggle is reset
5. Verify backup/restore buttons are hidden

## Debugging

### Chrome DevTools Console

Open background service worker console to see logs:

1. Go to `chrome://extensions/`
2. Find "Reloader Bear"
3. Click "service worker" link
4. Check console for `[Raindrop]` and `[Auto Backup]` logs

### Storage Inspection

Check stored data in DevTools:

1. Go to `chrome://extensions/`
2. Find "Reloader Bear"
3. Click "service worker" → Console
4. Run: `chrome.storage.sync.get(null, console.log)`

### Common Issues

- **"Please login to Raindrop.io first"**: OAuth token expired or not set
- **"No patterns to backup"**: Add some patterns first
- **Rate limiting**: Wait a minute and try again
- **Restore fails**: Check if "Reloader Bear" collection exists

## API Endpoints Used

### Raindrop.io API

- `GET /collections` - List collections
- `POST /collection` - Create collection
- `GET /raindrops/{collectionId}` - Fetch items (paginated)
- `POST /raindrop` - Create item
- `PUT /raindrop/{id}` - Update item
- `DELETE /raindrop/{id}` - Delete item

### OAuth Service

- `GET https://ohauth.vercel.app/oauth/raindrop` - Initiate OAuth
- `POST https://ohauth.vercel.app/oauth/raindrop/refresh` - Refresh token

## Security Considerations

1. **No Client Secrets**: Uses external OAuth service to avoid exposing secrets
2. **Externally Connectable**: Limited to `ohauth.vercel.app` domain only
3. **Token Storage**: Tokens stored in encrypted `chrome.storage.sync`
4. **HTTPS Only**: All API calls use HTTPS
5. **Message Validation**: Validates external messages before processing

## Future Enhancements

Possible improvements:

- [ ] Conflict resolution for simultaneous edits
- [ ] Backup/restore history
- [ ] Selective pattern sync
- [ ] Export/import as backup alternative
- [ ] Sync status indicator in popup
- [ ] Last sync timestamp display

## Troubleshooting

### Extension Won't Load

- Check if `"type": "module"` is in manifest background section
- Verify all module imports use `.js` extension

### OAuth Not Working

- Check `externally_connectable` in manifest
- Verify extension ID matches state parameter
- Check browser console for errors

### Auto Backup Not Triggering

- Verify auto backup toggle is enabled
- Check if user is logged in
- Look for "[Auto Backup]" logs in console

### Restore Not Working

- Check if "Reloader Bear" collection exists
- Verify OAuth token is valid
- Check console for error messages

## Support

For issues or questions:

1. Check Chrome DevTools console logs
2. Verify OAuth connection in options page
3. Try manual backup/restore first
4. Check Raindrop.io for collection and items

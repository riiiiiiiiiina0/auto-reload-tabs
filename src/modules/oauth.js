// OAuth token reception and storage module

/**
 * Sets up external message listener for OAuth tokens from ohauth.vercel.app
 */
export function setupOAuthListener() {
  chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
      // Verify message format and sender
      if (
        message?.type === 'oauth_success' &&
        message?.provider === 'raindrop' &&
        message?.tokens
      ) {
        const { access_token, refresh_token, expires_in } = message.tokens;

        if (access_token && refresh_token && expires_in) {
          // Convert expires_in (seconds) to absolute timestamp
          const expiresAt = Date.now() + expires_in * 1000;

          // Store tokens in sync storage (syncs across devices)
          chrome.storage.sync.set(
            {
              oauthAccessToken: access_token,
              oauthRefreshToken: refresh_token,
              oauthExpiresAt: expiresAt,
            },
            () => {
              // Notify user of successful login
              chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon-128x128.png'),
                title: 'Reloader Bear',
                message: '🔐 OAuth login successful!',
              });

              sendResponse({ success: true });
            },
          );
        }

        return true; // Keep message channel open for async response
      }
    },
  );
}

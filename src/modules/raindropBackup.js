// Raindrop.io backup and restore module

const RAINDROP_API_BASE = 'https://api.raindrop.io/rest/v1';
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const TOKEN_EXPIRY_BUFFER_MS = 10 * 60 * 1000; // 10 minutes
const RELOADER_BEAR_COLLECTION_NAME = 'Reloader Bear';

// Storage key for patterns
const STORAGE_KEY = 'reloadPatterns';

/**
 * Custom error class for Raindrop API errors
 */
export class RaindropApiError extends Error {
  constructor(message, status, statusText) {
    super(message);
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Sleep helper for delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if OAuth token is expiring soon
 */
function isOAuthTokenExpiringSoon(expiresAt) {
  if (!expiresAt) return true;
  return Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiresAt;
}

/**
 * Refresh OAuth token using refresh token
 */
async function refreshOAuthToken(refreshToken) {
  try {
    const response = await fetch(
      'https://ohauth.vercel.app/oauth/raindrop/refresh',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.access_token && data.refresh_token && data.expires_in) {
      const expiresAt = Date.now() + data.expires_in * 1000;

      // Update stored tokens
      await chrome.storage.sync.set({
        oauthAccessToken: data.access_token,
        oauthRefreshToken: data.refresh_token,
        oauthExpiresAt: expiresAt,
      });

      return data;
    }

    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Get active OAuth token, refreshing if needed
 */
async function getActiveToken() {
  const data = await chrome.storage.sync.get([
    'oauthAccessToken',
    'oauthRefreshToken',
    'oauthExpiresAt',
  ]);

  if (data.oauthAccessToken && data.oauthRefreshToken) {
    // Check if token is expiring soon
    if (isOAuthTokenExpiringSoon(data.oauthExpiresAt)) {
      const refreshed = await refreshOAuthToken(data.oauthRefreshToken);
      return refreshed?.access_token || data.oauthAccessToken;
    }
    return data.oauthAccessToken;
  }

  return '';
}

/**
 * Fetch with retry logic for rate limiting
 */
async function fetchWithRetry(url, options) {
  let retries = 0;

  while (true) {
    const res = await fetch(url, options);

    // If not rate limited or max retries reached, return response
    if (res.status !== 429 || retries >= MAX_RETRIES) {
      return res;
    }

    // Calculate backoff time (exponential: 1s, 2s, 4s, 8s, 16s)
    const backoffMs = INITIAL_BACKOFF_MS * 2 ** retries;
    console.log(`Rate limited. Retrying in ${backoffMs}ms...`);

    await sleep(backoffMs);
    retries++;
  }
}

/**
 * API GET request helper
 */
async function apiGET(path, token) {
  const url = `${RAINDROP_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new RaindropApiError(
      `API error ${res.status} for ${path}: ${text}`,
      res.status,
      res.statusText,
    );
  }

  return res.json();
}

/**
 * API POST request helper
 */
async function apiPOST(path, body, token) {
  const url = `${RAINDROP_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new RaindropApiError(
      `API error ${res.status} for ${path}: ${text}`,
      res.status,
      res.statusText,
    );
  }

  return res.json();
}

/**
 * API PUT request helper
 */
async function apiPUT(path, body, token) {
  const url = `${RAINDROP_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetchWithRetry(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new RaindropApiError(
      `API error ${res.status} for ${path}: ${text}`,
      res.status,
      res.statusText,
    );
  }

  return res.json();
}

/**
 * API DELETE request helper
 */
async function apiDELETE(path, token) {
  const url = `${RAINDROP_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new RaindropApiError(
      `API error ${res.status} for ${path}: ${text}`,
      res.status,
      res.statusText,
    );
  }

  // DELETE may return empty response
  try {
    return await res.json();
  } catch (_) {
    return { result: true };
  }
}

/**
 * Get or create the Reloader Bear collection
 */
async function getOrCreateCollection(token) {
  // Check if collection exists
  const collectionsRes = await apiGET('/collections', token);
  const collections = collectionsRes.items || [];

  const existing = collections.find(
    (c) => c.title === RELOADER_BEAR_COLLECTION_NAME,
  );

  if (existing) {
    return existing._id;
  }

  // Create new collection
  const createRes = await apiPOST(
    '/collection',
    {
      title: RELOADER_BEAR_COLLECTION_NAME,
      view: 'list',
    },
    token,
  );

  return createRes.item._id;
}

/**
 * Find existing collection ID
 */
async function findCollectionId(token) {
  const collectionsRes = await apiGET('/collections', token);
  const collections = collectionsRes.items || [];

  const existing = collections.find(
    (c) => c.title === RELOADER_BEAR_COLLECTION_NAME,
  );

  return existing?._id || null;
}

/**
 * Fetch all items from a collection (with pagination)
 */
async function fetchAllItemsFromCollection(collectionId, token) {
  const allItems = [];
  let page = 0;
  const perpage = 50;
  let hasMore = true;

  while (hasMore) {
    const response = await apiGET(
      `/raindrops/${collectionId}?perpage=${perpage}&page=${page}`,
      token,
    );

    if (response?.items?.length > 0) {
      allItems.push(...response.items);
      page++;
      hasMore = response.items.length === perpage;
    } else {
      hasMore = false;
    }

    if (hasMore) {
      await sleep(100); // Rate limiting between pagination requests
    }
  }

  return allItems;
}

/**
 * Extract pattern ID from link
 */
function extractPatternIdFromLink(link) {
  if (!link) return null;
  const match = link.match(/^reloader-bear:\/\/patterns\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Build existing items map for quick lookup
 */
function buildExistingItemsMap(raindropItems) {
  const map = new Map();

  for (const item of raindropItems) {
    const patternId = extractPatternIdFromLink(item.link);
    if (patternId) {
      map.set(patternId, item);
    }
  }

  return map;
}

/**
 * Prepare Raindrop data from pattern
 */
function prepareRaindropData(patternId, pattern, collectionId) {
  const title = `${pattern.urlPattern} (${pattern.intervalMinutes}m)`;

  const metadata = {
    id: patternId,
    urlPattern: pattern.urlPattern,
    intervalMinutes: pattern.intervalMinutes,
  };

  return {
    link: `reloader-bear://patterns/${patternId}`, // Custom protocol for ID
    title: title, // Display title
    excerpt: JSON.stringify(metadata, null, 2), // Metadata as JSON
    collection: { $id: collectionId }, // Target collection
    tags: ['reloader-bear', 'pattern'], // Tags for filtering
  };
}

/**
 * Parse metadata from Raindrop item
 */
function parseMetadataFromItem(item) {
  if (!item?.excerpt?.trim()) {
    return {};
  }

  try {
    return JSON.parse(item.excerpt);
  } catch (error) {
    console.warn(`Failed to parse metadata for item ${item._id}`, error);
    return {};
  }
}

/**
 * Backup patterns to Raindrop
 */
export async function backupPatternsToRaindrop() {
  try {
    // Get OAuth token
    const token = await getActiveToken();
    if (!token) {
      return {
        success: false,
        message: 'Please login to Raindrop.io first.',
      };
    }

    // Load patterns from storage
    const data = await chrome.storage.sync.get([STORAGE_KEY]);
    const patterns = data[STORAGE_KEY] || [];

    if (patterns.length === 0) {
      return {
        success: false,
        message: 'No patterns to backup.',
      };
    }

    // Get or create the collection
    const collectionId = await getOrCreateCollection(token);

    // Fetch all existing items from collection
    const existingItems = await fetchAllItemsFromCollection(
      collectionId,
      token,
    );
    const existingItemsMap = buildExistingItemsMap(existingItems);

    // Categorize operations
    const patternsToUpdate = [];
    const patternsToCreate = [];
    const itemsToDelete = [];

    // Generate IDs for patterns (using URL pattern as ID)
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const patternId = encodeURIComponent(pattern.urlPattern);
      const existingItem = existingItemsMap.get(patternId);

      if (existingItem) {
        patternsToUpdate.push({ patternId, pattern, existingItem });
        existingItemsMap.delete(patternId); // Mark as processed
      } else {
        patternsToCreate.push({ patternId, pattern });
      }
    }

    // Any remaining items in map should be deleted (no longer in local patterns)
    for (const [patternId, existingItem] of existingItemsMap) {
      itemsToDelete.push({ patternId, existingItem });
    }

    // Execute operations
    let createdCount = 0,
      updatedCount = 0,
      deletedCount = 0;

    // Delete items no longer in local patterns
    for (const { existingItem } of itemsToDelete) {
      await apiDELETE(`/raindrop/${existingItem._id}`, token);
      deletedCount++;
      await sleep(100); // Rate limiting
    }

    // Update existing items
    for (const { patternId, pattern, existingItem } of patternsToUpdate) {
      const raindropData = prepareRaindropData(
        patternId,
        pattern,
        collectionId,
      );
      await apiPUT(`/raindrop/${existingItem._id}`, raindropData, token);
      updatedCount++;
      await sleep(100);
    }

    // Create new items
    for (const { patternId, pattern } of patternsToCreate) {
      const raindropData = prepareRaindropData(
        patternId,
        pattern,
        collectionId,
      );
      await apiPOST('/raindrop', raindropData, token);
      createdCount++;
      await sleep(100);
    }

    // Return results
    return {
      success: true,
      message: `✓ ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted`,
      stats: {
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        collectionId,
      },
    };
  } catch (error) {
    console.error('Backup failed:', error);
    return {
      success: false,
      message: `Backup failed: ${error.message}`,
    };
  }
}

/**
 * Restore patterns from Raindrop
 */
export async function restorePatternsFromRaindrop() {
  try {
    // Get OAuth token
    const token = await getActiveToken();
    if (!token) {
      return {
        success: false,
        message: 'Please login to Raindrop.io first.',
      };
    }

    // Find collection
    const collectionId = await findCollectionId(token);
    if (!collectionId) {
      return {
        success: false,
        message:
          'No "Reloader Bear" collection found. Backup your patterns first.',
      };
    }

    // Fetch all items from collection
    const items = await fetchAllItemsFromCollection(collectionId, token);

    const restoredPatterns = [];

    // Convert each Raindrop item to a pattern
    for (const item of items) {
      const metadata = parseMetadataFromItem(item);

      // Extract pattern data
      const urlPattern = metadata.urlPattern || '';
      const intervalMinutes = metadata.intervalMinutes || 30;

      if (urlPattern) {
        restoredPatterns.push({
          urlPattern,
          intervalMinutes,
        });
      }
    }

    // Replace local patterns with restored patterns
    await chrome.storage.sync.set({ [STORAGE_KEY]: restoredPatterns });

    return {
      success: true,
      message: `✓ ${restoredPatterns.length} pattern(s) restored`,
      stats: {
        restored: restoredPatterns.length,
        collectionId,
      },
    };
  } catch (error) {
    console.error('Restore failed:', error);
    return {
      success: false,
      message: `Restore failed: ${error.message}`,
    };
  }
}

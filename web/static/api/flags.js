/**
 * Feature flags from backend. Fetched once on load.
 */
let cached = null;

/**
 * @returns {Promise<{ new_ratings_ui?: boolean, optimistic_notes?: boolean }>}
 */
export async function getFlags() {
    if (cached) return cached;
    try {
        const response = await fetch('/api/flags');
        if (response.ok) {
            cached = await response.json();
            return cached;
        }
    } catch (_) {}
    cached = {};
    return cached;
}

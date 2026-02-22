/**
 * Auth API: login, refresh, getMe, updateAvatar.
 */

const token = () => localStorage.getItem('access_token');

/**
 * @param {{ telegram_id: string, password: string }} body
 * @returns {Promise<{ status: number, data: { success: boolean, access_token?: string, refresh_token?: string, user?: { telegram_id: string, name: string }, error?: string } }>}
 */
export async function login(body) {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return { status: response.status, data };
}

/**
 * @returns {Promise<{ telegram_id: string, name: string, avatar?: string, ratings_count?: number }>}
 */
export async function getMe() {
    const t = token();
    if (!t) throw new Error('Not authenticated');
    const response = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${t}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

/**
 * @param {string} avatar - avatar filename
 * @returns {Promise<Response>}
 */
export async function updateAvatar(avatar) {
    const t = token();
    if (!t) throw new Error('Not authenticated');
    return fetch('/api/me/avatar', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ avatar }),
    });
}

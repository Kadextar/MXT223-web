/**
 * Schedule API: single place for schedule fetch (uses apiRequest for retry).
 */
import { apiRequest } from '../api.js';

/**
 * @returns {Promise<Array<{ id: number, day: number, pair: number, subject: string, type: string, teacher: string, room: string, weeks: number[] }>>}
 */
export async function getSchedule() {
    const response = await apiRequest('/api/schedule');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.items || []);
}

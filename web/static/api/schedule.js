/**
 * Schedule API: single place for schedule fetch (uses apiRequest for retry).
 */
import { apiRequest } from '../api.js';

/**
 * @returns {Promise<Array<{ id: number, day: number, pair: number, subject: string, type: string, teacher: string, room: string, weeks: number[] }>>}
 */
export async function getSchedule() {
    const response = await apiRequest('/api/schedule');
    if (!response.ok) {
        throw new Error(response.status === 401 ? 'Требуется вход' : `Ошибка ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.items || []);
}

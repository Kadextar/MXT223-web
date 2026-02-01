import { PAIR_TIMES, SEMESTER_START_DATE, getLessonsForDay } from './schedule_data.js';

export function generateICS() {
    console.log("Generating ICS file...");

    let calendarEvents = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    // Iterate through all 20 weeks
    for (let week = 1; week <= 20; week++) {
        // Iterate through all days of the week (Monday=1 to Saturday=6)
        for (let dayIdx = 1; dayIdx <= 6; dayIdx++) {
            const dayName = getDayNameFromIndex(dayIdx);

            // Get lessons for this specific day and week
            // Note: getLessonsForDay handles odd/even logic internally if data is set up that way
            // But since our data structure might be static per day, we need to check if getLessonsForDay
            // supports week-based filtering. 
            // Looking at app.js usage: getLessonsForDay(state.selectedDay, state.currentWeek)
            // So yes, it should support it.

            const lessons = getLessonsForDay(dayName, week);

            if (!lessons || lessons.length === 0) continue;

            // Calculate the actual date for this day of this week
            const lessonDate = getRefDateForWeekDay(week, dayIdx);

            lessons.forEach(lesson => {
                const timeRange = PAIR_TIMES[lesson.pair];
                if (!timeRange) return;

                const [startTime, endTime] = timeRange.split(' - ');
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);

                // Create Start Date
                const startDate = new Date(lessonDate);
                startDate.setHours(startHour, startMin, 0);

                // Create End Date
                const endDate = new Date(lessonDate);
                endDate.setHours(endHour, endMin, 0);

                // Format for ICS (YYYYMMDDTHHMMSS)
                const startStr = formatICSDate(startDate);
                const endStr = formatICSDate(endDate);
                const stampStr = formatICSDate(now);

                const event = [
                    'BEGIN:VEVENT',
                    `UID:${startStr}-${lesson.subject.replace(/\s/g, '')}@mxt223.com`,
                    `DTSTAMP:${stampStr}`,
                    `DTSTART:${startStr}`,
                    `DTEND:${endStr}`,
                    `SUMMARY:${lesson.subject} (${lesson.type === 'lecture' ? 'Лекция' : 'Семинар'})`,
                    `DESCRIPTION:${lesson.teacher}`,
                    `LOCATION:${lesson.room}`,
                    'END:VEVENT'
                ].join('\r\n');

                calendarEvents.push(event);
            });
        }
    }

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MXT223//Schedule//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...calendarEvents,
        'END:VCALENDAR'
    ].join('\r\n');

    downloadICS(icsContent, 'mxt223_schedule.ics');
}

function getDayNameFromIndex(idx) {
    const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
    return map[idx];
}

function getRefDateForWeekDay(weekNum, dayIdx) {
    // 1. Start Date (Monday of Week 1)
    const start = new Date(SEMESTER_START_DATE);

    // 2. Add weeks offset
    // week 1 = 0 offset
    const daysOffset = (weekNum - 1) * 7;

    // 3. Add day offset (Monday is base, so +0 for Monday, +1 for Tuesday...)
    // dayIdx: 1 (Mon) -> 0 offset
    const dayOffset = dayIdx - 1;

    const targetDate = new Date(start);
    targetDate.setDate(start.getDate() + daysOffset + dayOffset);
    return targetDate;
}

function formatICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function downloadICS(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

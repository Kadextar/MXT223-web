export const SEMESTER_START_DATE = new Date('2026-02-02');

export const PAIR_TIMES = {
    1: "08:00 - 09:20",
    2: "09:30 - 10:50",
    3: "11:00 - 12:20"
};

// Типы: 'lecture', 'seminar'
const SCHEDULE = [
    // Понедельник
    {
        day: "monday",
        pair: 1,
        subject: "Качество и безопасность в гостиничной деятельности",
        type: "seminar",
        weeks: [4, 18], // с 4 по 18
        room: "2/214",
        teacher: "Иванова А.А."
    },
    {
        day: "monday",
        pair: 2,
        subject: "Стратегический менеджмент в гостиничном хозяйстве",
        type: "lecture",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Петров Б.Б."
    },
    {
        day: "monday",
        pair: 3,
        subject: "Урок просвещения",
        type: "lecture",
        weeks: [4, 18], // Предположим, что всегда
        room: "2/214",
        teacher: ""
    },

    // Вторник
    {
        day: "tuesday",
        pair: 1,
        subject: "Мировая экономика и МЭО",
        type: "lecture",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Сидоров В.В."
    },
    {
        day: "tuesday",
        pair: 2,
        subject: "Качество и безопасность в гостиничной деятельности",
        type: "lecture",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Иванова А.А."
    },
    {
        day: "tuesday",
        pair: 3,
        subject: "Международный гостиничный бизнес",
        type: "seminar",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Козлов Г.Г."
    },

    // Среда (пример данных, нужно уточнить)
    {
        day: "wednesday",
        pair: 1,
        subject: "Стратегический менеджмент",
        type: "seminar",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Петров Б.Б."
    },

    // Четверг
    {
        day: "thursday",
        pair: 1,
        subject: "Мировая экономика и МЭО",
        type: "seminar",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Сидоров В.В."
    },

    // Пятница
    {
        day: "friday",
        pair: 2,
        subject: "Международный гостиничный бизнес",
        type: "lecture",
        weeks: [4, 18],
        room: "2/214",
        teacher: "Козлов Г.Г."
    }
];

export function getLessonsForDay(dayOfWeek, currentWeek) {
    return SCHEDULE.filter(lesson => {
        // Проверяем день
        if (lesson.day !== dayOfWeek) return false;

        // Проверяем неделю (если задан массив [start, end])
        if (Array.isArray(lesson.weeks)) {
            const [start, end] = lesson.weeks;
            if (currentWeek < start || currentWeek > end) return false;
        }

        return true;
    });
}

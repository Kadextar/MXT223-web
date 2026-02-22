import databases
from app.config import DATABASE_URL, DATABASE_CONNECT_TIMEOUT
from app.logging_config import logger

# Add connect_timeout for PostgreSQL
_url = DATABASE_URL
if "postgresql" in _url and "connect_timeout" not in _url:
    sep = "&" if "?" in _url else "?"
    _url = f"{_url}{sep}connect_timeout={DATABASE_CONNECT_TIMEOUT}"
database = databases.Database(_url)

async def init_db():
    """Initialize database tables if they don't exist"""
    is_postgres = "postgresql" in DATABASE_URL
    id_type = "SERIAL PRIMARY KEY" if is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    
    # Students table
    query = f"""
        CREATE TABLE IF NOT EXISTS students (
            id {id_type},
            telegram_id TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            avatar TEXT DEFAULT '1.png',
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    await database.execute(query)
    
    # Simple migration: check if avatar column exists (for existing dbs)
    try:
        # Try to select avatar from one user. If it fails, column likely doesn't exist.
        await database.fetch_one("SELECT avatar FROM students LIMIT 1")
    except Exception:
        logger.info("Migrating: Adding avatar column to students table...")
        try:
            await database.execute("ALTER TABLE students ADD COLUMN avatar TEXT DEFAULT '1.png'")
        except Exception as e:
            logger.warning("Migration warning: %s", e)
    
    # Teachers table
    query = f"""
        CREATE TABLE IF NOT EXISTS teachers (
            id {id_type},
            name TEXT NOT NULL,
            subject TEXT,
            average_rating FLOAT DEFAULT 0,
            total_ratings INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    await database.execute(query)
    
    # Teacher Ratings table (Legacy - keeping for now)
    query = f"""
        CREATE TABLE IF NOT EXISTS teacher_ratings (
            id {id_type},
            teacher_id INTEGER NOT NULL,
            student_hash TEXT NOT NULL,
            rating INTEGER NOT NULL,
            tags TEXT,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(teacher_id, student_hash)
        )
    """
    await database.execute(query)

    # Subject Ratings table (New - for v30+ design)
    query = f"""
        CREATE TABLE IF NOT EXISTS subject_ratings (
            id {id_type},
            subject_name TEXT NOT NULL,
            subject_type TEXT NOT NULL, 
            rating INTEGER NOT NULL,
            tags TEXT,
            comment TEXT,
            student_id TEXT NOT NULL,
            lesson_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject_name, subject_type, student_id, lesson_date)
        )
    """
    await database.execute(query)
    
    # Exams table
    query = f"""
        CREATE TABLE IF NOT EXISTS exams (
            id {id_type},
            subject TEXT NOT NULL,
            teacher TEXT,
            exam_date DATE NOT NULL,
            exam_time TEXT,
            room TEXT,
            exam_type TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    await database.execute(query)
    
    # Push subscriptions table
    query = f"""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id {id_type},
            student_id TEXT NOT NULL,
            subscription_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id)
        )
    """
    await database.execute(query)
    
    # Schedule table
    query = f"""
        CREATE TABLE IF NOT EXISTS schedule (
            id {id_type},
            day_of_week TEXT NOT NULL,
            pair_number INTEGER NOT NULL,
            subject TEXT NOT NULL,
            lesson_type TEXT NOT NULL,
            teacher TEXT,
            room TEXT,
            week_start INTEGER,
            week_end INTEGER
        )
    """
    await database.execute(query)
    
    # Announcements table
    query = f"""
        CREATE TABLE IF NOT EXISTS announcements (
            id {id_type},
            message TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    await database.execute(query)
    try:
        await database.execute("ALTER TABLE announcements ADD COLUMN schedule_context TEXT")
    except Exception:
        pass

    # User favorites (subjects) — sync across devices
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS user_favorites (
            student_id TEXT NOT NULL,
            subject_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, subject_name)
        )
    """)

    # User deadlines (coursework, exams - per student)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS user_deadlines (
            id {id_type},
            student_id TEXT NOT NULL,
            title TEXT NOT NULL,
            due_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Subject reviews (anonymous short reviews per subject)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS subject_reviews (
            id {id_type},
            subject_name TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            moderated BOOLEAN DEFAULT FALSE
        )
    """)

    # Announcement read receipts (for admin "read by N of M")
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS announcement_reads (
            id {id_type},
            announcement_id INTEGER NOT NULL,
            user_identifier TEXT NOT NULL,
            read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2FA TOTP secret per student
    try:
        await database.execute("ALTER TABLE students ADD COLUMN totp_secret TEXT")
    except Exception:
        pass

    # Password reset tokens
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id {id_type},
            token TEXT UNIQUE NOT NULL,
            telegram_id TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Visitors today (who opened schedule) — one row per day per identifier
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS visitor_log (
            id {id_type},
            visit_date DATE NOT NULL,
            visitor_identifier TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(visit_date, visitor_identifier)
        )
    """)

    # Polls (admin creates)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS polls (
            id {id_type},
            question TEXT NOT NULL,
            options_json TEXT NOT NULL,
            created_by TEXT NOT NULL,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS poll_votes (
            id {id_type},
            poll_id INTEGER NOT NULL,
            user_identifier TEXT NOT NULL,
            option_index INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(poll_id, user_identifier)
        )
    """)

    # Comments under announcement
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS announcement_comments (
            id {id_type},
            announcement_id INTEGER NOT NULL,
            user_identifier TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Materials per subject (links)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS subject_materials (
            id {id_type},
            subject_name TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Schedule change history (admin)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS schedule_change_log (
            id {id_type},
            action TEXT NOT NULL,
            payload_json TEXT,
            changed_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Achievements definition + user unlocks
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS achievements (
            id {id_type},
            achievement_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT
        )
    """)
    await database.execute(f"""
        CREATE TABLE IF NOT EXISTS user_achievements (
            id {id_type},
            user_identifier TEXT NOT NULL,
            achievement_key TEXT NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_identifier, achievement_key)
        )
    """)

    # Seed default achievements
    for ak, name, desc, icon in [
        ("streak_7", "Неделя подряд", "Заходил 7 дней подряд", "🔥"),
        ("ratings_5", "Критик", "Оценил 5 преподавателей", "⭐"),
        ("notes_3", "Заметки", "Вёл заметки к 3 предметам", "📝"),
        ("first_login", "Первый вход", "Вошел в приложение", "👋"),
    ]:
        try:
            await database.execute(
                "INSERT OR IGNORE INTO achievements (achievement_key, name, description, icon) VALUES (:k, :n, :d, :i)",
                {"k": ak, "n": name, "d": desc, "i": icon},
            )
        except Exception:
            try:
                await database.execute(
                    "INSERT INTO achievements (achievement_key, name, description, icon) VALUES (:k, :n, :d, :i) ON CONFLICT(achievement_key) DO NOTHING",
                    {"k": ak, "n": name, "d": desc, "i": icon},
                )
            except Exception:
                pass

    # Check if students exist
    count_query = "SELECT COUNT(*) FROM students"
    count = await database.fetch_val(query=count_query)
    
    if count == 0:
        logger.info("Seeding students...")
        students = [
            {"telegram_id": "1748727700", "password": "robiya2026", "name": "Робия"},
            {"telegram_id": "1427112602", "password": "sardor2026", "name": "Сардор"},
            {"telegram_id": "1937736219", "password": "khislatbek2026", "name": "Хислатбек"},
            {"telegram_id": "207103078", "password": "timur2026", "name": "Тимур"},
            {"telegram_id": "5760110758", "password": "amir2026", "name": "Амир"},
            {"telegram_id": "1362668588", "password": "muhammad2026", "name": "Мухаммад"},
            {"telegram_id": "2023499343", "password": "abdumalik2026", "name": "Абдумалик"},
            {"telegram_id": "1214641616", "password": "azamat2026", "name": "Азамат"},
            {"telegram_id": "1020773033", "password": "nozima2026", "name": "Нозима"}
        ]
        
        insert_query = """
            INSERT INTO students (telegram_id, password, name)
            VALUES (:telegram_id, :password, :name)
        """
        
        for student in students:
            try:
                await database.execute(query=insert_query, values=student)
            except Exception as e:
                logger.warning("Error seeding student %s: %s", student['name'], e)
    
    # Check if schedule exists
    try:
        count_query = "SELECT COUNT(*) FROM schedule"
        count = await database.fetch_val(query=count_query)
    except Exception as e:
        logger.warning("Schedule table check failed (maybe not created?): %s", e)
        count = -1  # Skip seeding if table check fails
    
    if count == 0:
        logger.info("Seeding schedule...")
        
        # Mappings for teachers
        TEACHERS = {
            "Качество и безопасность в гостиничной деятельности": {
                "lecture": "Махмудова Азиза Пирмаматовна",
                "seminar": "Мир-Джафарова Азиза Джавохировна"
            },
            "Стратегический менеджмент в гостиничном хозяйстве": {
                "lecture": "Усманова Нигина Маруповна",
                "seminar": "Бурхонова Наргиза Миршохидовна"
            },
            "Мировая экономика и международные экономические отношения": {
                "lecture": "Халимов Шахбоз Халимович",
                "seminar": "Амриева Шахзода Шухратовна"
            },
            "Международный гостиничный бизнес": {
                "lecture": "Амриддинова Райхона Садриддиновна",
                "seminar": "Мейлиев Абдугани Наджмиддинович"
            },
            "Урок просвещения": {
                "lecture": "Пардаев Гайрат Яхшибаевич",
                "seminar": "Пардаев Гайрат Яхшибаевич"
            }
        }

        lessons = [
            # Понедельник
            {"day": "monday", "pair": 1, "subject": "Качество и безопасность в гостиничной деятельности", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 8},
            {"day": "monday", "pair": 1, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "lecture", "room": "2/214*", "week_start": 10, "week_end": 15},
            {"day": "monday", "pair": 2, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 8},
            {"day": "monday", "pair": 2, "subject": "Мировая экономика и международные экономические отношения", "type": "lecture", "room": "2/214*", "week_start": 10, "week_end": 15},
            {"day": "monday", "pair": 3, "subject": "Урок просвещения", "type": "lecture", "room": "3/305*", "week_start": 4, "week_end": 8},
            {"day": "monday", "pair": 3, "subject": "Урок просвещения", "type": "lecture", "room": "3/305*", "week_start": 10, "week_end": 12},
            {"day": "monday", "pair": 3, "subject": "Урок просвещения", "type": "lecture", "room": "3/305*", "week_start": 13, "week_end": 15},

            # Вторник
            {"day": "tuesday", "pair": 1, "subject": "Мировая экономика и международные экономические отношения", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 10},
            {"day": "tuesday", "pair": 1, "subject": "Мировая экономика и международные экономические отношения", "type": "seminar", "room": "2/214", "week_start": 11, "week_end": 15},
            {"day": "tuesday", "pair": 2, "subject": "Качество и безопасность в гостиничной деятельности", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 10},
            {"day": "tuesday", "pair": 2, "subject": "Качество и безопасность в гостиничной деятельности", "type": "lecture", "room": "2/214*", "week_start": 11, "week_end": 15},
            {"day": "tuesday", "pair": 3, "subject": "Международный гостиничный бизнес", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 14},

            # Среда
            {"day": "wednesday", "pair": 1, "subject": "Международный гостиничный бизнес", "type": "seminar", "room": "2/214", "week_start": 4, "week_end": 15},
            {"day": "wednesday", "pair": 2, "subject": "Качество и безопасность в гостиничной деятельности", "type": "seminar", "room": "2/214", "week_start": 4, "week_end": 15},
            {"day": "wednesday", "pair": 3, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "lecture", "room": "2/214*", "week_start": 10, "week_end": 10},
            {"day": "wednesday", "pair": 3, "subject": "Мировая экономика и международные экономические отношения", "type": "seminar", "room": "2/214", "week_start": 15, "week_end": 15},

            # Четверг
            {"day": "thursday", "pair": 1, "subject": "Мировая экономика и международные экономические отношения", "type": "seminar", "room": "2/214", "week_start": 4, "week_end": 15},
            {"day": "thursday", "pair": 2, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 9},
            {"day": "thursday", "pair": 2, "subject": "Международный гостиничный бизнес", "type": "seminar", "room": "2/214", "week_start": 10, "week_end": 10},
            {"day": "thursday", "pair": 2, "subject": "Качество и безопасность в гостиничной деятельности", "type": "seminar", "room": "2/214", "week_start": 11, "week_end": 15},
            {"day": "thursday", "pair": 3, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "seminar", "room": "2/214", "week_start": 6, "week_end": 12},
            {"day": "thursday", "pair": 3, "subject": "Качество и безопасность в гостиничной деятельности", "type": "seminar", "room": "2/214", "week_start": 13, "week_end": 13},

            # Пятница
            {"day": "friday", "pair": 1, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "seminar", "room": "2/214", "week_start": 4, "week_end": 9},
            {"day": "friday", "pair": 1, "subject": "Международный гостиничный бизнес", "type": "seminar", "room": "2/214", "week_start": 11, "week_end": 15},
            {"day": "friday", "pair": 2, "subject": "Мировая экономика и международные экономические отношения", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 8},
            {"day": "friday", "pair": 2, "subject": "Качество и безопасность в гостиничной деятельности", "type": "lecture", "room": "3/207*", "week_start": 9, "week_end": 9},
            {"day": "friday", "pair": 2, "subject": "Стратегический менеджмент в гостиничном хозяйстве", "type": "seminar", "room": "2/214", "week_start": 11, "week_end": 15},
            {"day": "friday", "pair": 3, "subject": "Международный гостиничный бизнес", "type": "lecture", "room": "2/214*", "week_start": 4, "week_end": 9},
            {"day": "friday", "pair": 3, "subject": "Международный гостиничный бизнес", "type": "lecture", "room": "2/214*", "week_start": 11, "week_end": 11}
        ]
        
        insert_query = """
            INSERT INTO schedule (day_of_week, pair_number, subject, lesson_type, teacher, room, week_start, week_end)
            VALUES (:day, :pair, :subject, :type, :teacher, :room, :week_start, :week_end)
        """
        
        for lesson in lessons:
            try:
                # Determine teacher based on subject and type
                teacher_name = TEACHERS.get(lesson["subject"], {}).get(lesson["type"], "Не указан")
                
                # Format data for insertion
                data = {
                    "day": lesson["day"],
                    "pair": lesson["pair"],
                    "subject": lesson["subject"],
                    "type": lesson["type"],
                    "teacher": teacher_name,
                    "room": lesson["room"],
                    "week_start": lesson["week_start"],
                    "week_end": lesson["week_end"]
                }
                
                await database.execute(query=insert_query, values=data)
            except Exception as e:
                logger.warning("Error seeding lesson %s: %s", lesson['subject'], e)
                
        logger.info("Seeded %d lessons", len(lessons))
    
    # Create indexes for performance
    logger.info("Creating database indexes...")
    
    try:
        # Index on students.telegram_id (for login queries)
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_students_telegram_id 
            ON students(telegram_id)
        """)
        
        # Index on schedule.day_of_week (for day filtering)
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_schedule_day 
            ON schedule(day_of_week)
        """)
        
        # Composite index on schedule (day, week_start, week_end)
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_schedule_day_week 
            ON schedule(day_of_week, week_start, week_end)
        """)
        
        # Index on teacher_ratings.teacher_id (for rating aggregation)
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_ratings_teacher 
            ON teacher_ratings(teacher_id)
        """)
        
        # Index on exams.exam_date (for sorting exams)
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_exams_date 
            ON exams(exam_date)
        """)

        # Index on announcement_reads.announcement_id (for read count)
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id
            ON announcement_reads(announcement_id)
        """)

        # Index on subject_reviews (subject_name, moderated) for listing/moderated filter
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_subject_reviews_subject_moderated
            ON subject_reviews(subject_name, moderated)
        """)

        logger.info("Database indexes created")
    except Exception as e:
        logger.warning("Could not create indexes: %s", e)

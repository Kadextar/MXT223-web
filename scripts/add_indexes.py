"""
Database index migration script
Adds indexes to improve query performance
"""
import asyncio
import os
from dotenv import load_dotenv
import databases

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
database = databases.Database(DATABASE_URL)


async def add_indexes():
    """Add indexes to frequently queried columns"""
    await database.connect()
    
    try:
        print("🔧 Adding database indexes...\n")
        
        # Index on students.telegram_id (for login queries)
        print("Creating index on students.telegram_id...")
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_students_telegram_id 
            ON students(telegram_id)
        """)
        print("✓ Index idx_students_telegram_id created\n")
        
        # Index on schedule.day_of_week (for day filtering)
        print("Creating index on schedule.day_of_week...")
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_schedule_day 
            ON schedule(day_of_week)
        """)
        print("✓ Index idx_schedule_day created\n")
        
        # Composite index on schedule (day, week_start, week_end)
        # This is the most important - used for filtering schedule by day and week
        print("Creating composite index on schedule(day_of_week, week_start, week_end)...")
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_schedule_day_week 
            ON schedule(day_of_week, week_start, week_end)
        """)
        print("✓ Index idx_schedule_day_week created\n")
        
        # Index on teacher_ratings.teacher_id (for rating aggregation)
        print("Creating index on teacher_ratings.teacher_id...")
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_ratings_teacher 
            ON teacher_ratings(teacher_id)
        """)
        print("✓ Index idx_ratings_teacher created\n")
        
        # Index on exams.exam_date (for sorting exams)
        print("Creating index on exams.exam_date...")
        await database.execute("""
            CREATE INDEX IF NOT EXISTS idx_exams_date 
            ON exams(exam_date)
        """)
        print("✓ Index idx_exams_date created\n")
        
        print("✅ All indexes created successfully!")
        print("\nIndexes added:")
        print("  - students.telegram_id")
        print("  - schedule.day_of_week")
        print("  - schedule(day_of_week, week_start, week_end) [composite]")
        print("  - teacher_ratings.teacher_id")
        print("  - exams.exam_date")
        
    except Exception as e:
        print(f"❌ Error adding indexes: {e}")
        raise
    finally:
        await database.disconnect()


async def check_indexes():
    """Check which indexes exist"""
    await database.connect()
    
    try:
        print("\n📊 Checking existing indexes...\n")
        
        # PostgreSQL query to list indexes
        query = """
            SELECT 
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public'
            AND tablename IN ('students', 'schedule', 'teacher_ratings', 'exams')
            ORDER BY tablename, indexname
        """
        
        indexes = await database.fetch_all(query=query)
        
        if indexes:
            print(f"Found {len(indexes)} indexes:\n")
            current_table = None
            for idx in indexes:
                if idx['tablename'] != current_table:
                    current_table = idx['tablename']
                    print(f"\n{current_table}:")
                print(f"  - {idx['indexname']}")
        else:
            print("No indexes found")
            
    except Exception as e:
        print(f"Error checking indexes: {e}")
    finally:
        await database.disconnect()


if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE INDEX MIGRATION")
    print("=" * 60)
    print()
    
    # Add indexes
    asyncio.run(add_indexes())
    
    # Check what was created
    asyncio.run(check_indexes())
    
    print("\n" + "=" * 60)
    print("Migration complete!")
    print("=" * 60)

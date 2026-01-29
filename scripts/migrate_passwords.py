"""
Migration script to hash all existing plain text passwords in the database
Run this once before deploying the password hashing changes
"""
import asyncio
import os
from dotenv import load_dotenv
import databases

# Add parent directory to path to import utils
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.auth import hash_password, is_password_hashed

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
database = databases.Database(DATABASE_URL)


async def migrate_passwords():
    """Migrate all plain text passwords to hashed passwords"""
    await database.connect()
    
    try:
        # Get all students
        students = await database.fetch_all("SELECT telegram_id, password FROM students")
        
        migrated_count = 0
        skipped_count = 0
        
        for student in students:
            # Check if password is already hashed
            if is_password_hashed(student["password"]):
                print(f"✓ Skipping {student['telegram_id']} - already hashed")
                skipped_count += 1
                continue
            
            # Hash the plain text password
            hashed = hash_password(student["password"])
            
            # Update in database
            await database.execute(
                "UPDATE students SET password = :password WHERE telegram_id = :telegram_id",
                {"password": hashed, "telegram_id": student["telegram_id"]}
            )
            
            print(f"✓ Migrated {student['telegram_id']}")
            migrated_count += 1
        
        print(f"\n✅ Migration complete!")
        print(f"   Migrated: {migrated_count}")
        print(f"   Skipped: {skipped_count}")
        print(f"   Total: {len(students)}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await database.disconnect()


if __name__ == "__main__":
    print("🔐 Starting password migration...")
    print(f"Database: {DATABASE_URL[:30]}...")
    print()
    
    asyncio.run(migrate_passwords())

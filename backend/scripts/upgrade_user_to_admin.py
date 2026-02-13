#!/usr/bin/env python3
"""
Script to upgrade a user to admin role.

Usage:
    python scripts/upgrade_user_to_admin.py <username>

Example:
    python scripts/upgrade_user_to_admin.py john_doe
"""

import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings

settings = get_settings()


async def upgrade_user_to_admin(username: str):
    """Upgrade a user to admin role."""
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    try:
        # Find the user
        user = await db.users.find_one({"username": username})
        
        if not user:
            print(f"❌ Error: User '{username}' not found.")
            return False
        
        # Check if already admin
        if user.get("role") == "admin":
            print(f"ℹ️  User '{username}' is already an admin.")
            return True
        
        # Upgrade to admin
        result = await db.users.update_one(
            {"username": username},
            {"$set": {"role": "admin"}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Successfully upgraded user '{username}' to admin role.")
            return True
        else:
            print(f"❌ Error: Failed to upgrade user '{username}'.")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    finally:
        client.close()


async def list_all_users():
    """List all users in the database."""
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    try:
        users = await db.users.find().to_list(length=100)
        
        if not users:
            print("No users found in database.")
            return
        
        print("\n📋 Users in database:")
        print("-" * 60)
        print(f"{'Username':<20} {'Role':<10} {'Created At':<30}")
        print("-" * 60)
        
        for user in users:
            username = user.get("username", "N/A")
            role = user.get("role", "N/A")
            created_at = user.get("created_at", "N/A")
            print(f"{username:<20} {role:<10} {str(created_at):<30}")
        
        print("-" * 60)
        print(f"Total users: {len(users)}\n")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    finally:
        client.close()


def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python upgrade_user_to_admin.py <username>")
        print("       python upgrade_user_to_admin.py --list  (to list all users)")
        sys.exit(1)
    
    if sys.argv[1] == "--list":
        asyncio.run(list_all_users())
    else:
        username = sys.argv[1]
        success = asyncio.run(upgrade_user_to_admin(username))
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

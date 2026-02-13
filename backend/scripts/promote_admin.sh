#!/bin/bash

# Script to promote a user to admin
# Usage: ./promote_admin.sh [username]

echo "======================================"
echo "   Promote User to Admin"
echo "======================================"
echo ""

# Check if username is provided as argument
if [ -n "$1" ]; then
    USERNAME="$1"
else
    # Prompt for username
    read -p "Enter username: " USERNAME
fi

# Validate username is not empty
if [ -z "$USERNAME" ]; then
    echo "Error: Username cannot be empty"
    exit 1
fi

echo ""
echo "Processing: $USERNAME"
echo "--------------------------------------"

# Get the script directory
SCRIPT_DIR="$(dirname "$0")"

# Run the Python script
python3 "$SCRIPT_DIR/upgrade_user_to_admin.py" "$USERNAME"

# Check exit status
if [ $? -eq 0 ]; then
    echo "--------------------------------------"
    echo "✓ Operation completed successfully"
else
    echo "--------------------------------------"
    echo "✗ Operation failed"
    exit 1
fi

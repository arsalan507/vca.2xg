#!/bin/bash

# Google Drive Service Account Setup Helper
# This script helps you configure the service account credentials in .env

echo "🔧 Google Drive Service Account Setup Helper"
echo "=============================================="
echo ""

# Check if service account JSON file exists
echo "📁 Please provide the path to your service account JSON file:"
echo "   (Usually downloaded as: your-project-xxxxx-xxxxxxx.json)"
read -p "Path: " JSON_FILE

if [ ! -f "$JSON_FILE" ]; then
    echo "❌ Error: File not found: $JSON_FILE"
    exit 1
fi

echo ""
echo "✅ Found JSON file"
echo ""

# Convert JSON to single line
echo "📝 Converting JSON to single-line format..."
JSON_CONTENT=$(cat "$JSON_FILE" | tr -d '\n' | tr -d '\r')

echo "✅ JSON converted"
echo ""

# Ask for folder IDs
echo "📂 Now, let's get your Google Drive folder IDs"
echo ""
echo "1. Open Google Drive in your browser"
echo "2. Navigate to 'Production Files/Raw Footage/'"
echo "3. Copy the folder ID from the URL (the part after /folders/)"
echo ""
read -p "Raw Footage Folder ID: " RAW_FOLDER_ID

echo ""
echo "Navigate to 'Production Files/Edited Videos/'"
read -p "Edited Videos Folder ID: " EDITED_FOLDER_ID

echo ""
echo "Navigate to 'Production Files/Final Videos/'"
read -p "Final Videos Folder ID: " FINAL_FOLDER_ID

echo ""
echo "✅ Got all folder IDs"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to update it? (y/n): " UPDATE_ENV
    if [ "$UPDATE_ENV" != "y" ]; then
        echo "❌ Cancelled. No changes made."
        exit 0
    fi
    # Backup existing .env
    cp .env .env.backup
    echo "✅ Backed up existing .env to .env.backup"
fi

# Create/Update .env file
echo ""
echo "📝 Updating .env file..."

# Read existing .env or use .env.example
if [ -f ".env" ]; then
    SOURCE_FILE=".env"
else
    SOURCE_FILE=".env.example"
fi

# Update or add Google Drive credentials
cat "$SOURCE_FILE" | grep -v "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS" | grep -v "GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID" | grep -v "GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID" | grep -v "GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID" > .env.tmp

echo "" >> .env.tmp
echo "# Google Drive Service Account" >> .env.tmp
echo "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=$JSON_CONTENT" >> .env.tmp
echo "" >> .env.tmp
echo "# Google Drive Folder IDs" >> .env.tmp
echo "GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID=$RAW_FOLDER_ID" >> .env.tmp
echo "GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID=$EDITED_FOLDER_ID" >> .env.tmp
echo "GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID=$FINAL_FOLDER_ID" >> .env.tmp

mv .env.tmp .env

echo ""
echo "✅ Environment variables configured successfully!"
echo ""
echo "📋 Summary:"
echo "   - Service account credentials: ✅ Added"
echo "   - Raw Footage folder: $RAW_FOLDER_ID"
echo "   - Edited Videos folder: $EDITED_FOLDER_ID"
echo "   - Final Videos folder: $FINAL_FOLDER_ID"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: npm install"
echo "   2. Run: npm run dev"
echo "   3. Test: curl http://localhost:3001/health"
echo ""
echo "✨ Done!"

#!/bin/bash

echo "🔑 Tauri Signing Key Test"
echo "========================"
echo ""

# Check if private key is provided
if [ -z "$1" ]; then
    echo "❌ Usage: ./test-signing.sh <PRIVATE_KEY>"
    echo ""
    echo "Example:"
    echo "  ./test-signing.sh 'dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWdu...'"
    echo ""
    echo "To get your private key:"
    echo "  npm run tauri signer generate -- --ci"
    exit 1
fi

PRIVATE_KEY="$1"

echo "📝 Testing private key..."
echo "Key length: ${#PRIVATE_KEY} characters"
echo "Key starts with: ${PRIVATE_KEY:0:40}..."
echo ""

# Export the key
export TAURI_SIGNING_PRIVATE_KEY="$PRIVATE_KEY"

# Try to build with signing
echo "🔨 Attempting to build and sign..."
echo ""

npm run tauri build 2>&1 | tee build-test.log

# Check if .sig files were created
echo ""
echo "🔍 Checking for signature files..."
find src-tauri/target -name "*.sig" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Signature files found!"
else
    echo "❌ No signature files found"
    echo ""
    echo "Check build-test.log for errors"
fi

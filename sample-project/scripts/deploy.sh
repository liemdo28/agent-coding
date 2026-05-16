#!/bin/bash
# Deploy script — local only
set -e
echo "Building..."
npm run build
echo "Running tests..."
npm run test
echo "Done."

#!/bin/bash

# Configuration
URL="https://github.com/vucoffee2310/youtubedownloader/releases/download/pyav-custom/pyav-custom.tar.gz"
FILENAME="pyav-custom.tar.gz"
DIRNAME="pyav"

echo "--- 1. Downloading ---"
if command -v curl >/dev/null 2>&1; then
    curl -L -o "$FILENAME" "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget -O "$FILENAME" "$URL"
else
    echo "Error: Need curl or wget."
    return 1 2>/dev/null || exit 1
fi

echo "--- 2. Extracting ---"
# Apply permissions to the tar file as requested
chmod 755 "$FILENAME"
tar -xf "$FILENAME"

echo "--- 3. Setup and Install ---"
if [ -d "$DIRNAME" ]; then
    # Go into the directory
    cd "$DIRNAME" || return
    
    # Activate the script
    if [ -f "scripts/activate.sh" ]; then
        echo "Activating environment..."
        source scripts/activate.sh
    else
        echo "Warning: scripts/activate.sh not found. Attempting install anyway..."
    fi

    # Install the package
    echo "Running pip install..."
    pip install .
    
    echo "Done!"
else
    echo "Error: Folder '$DIRNAME' was not created."
fi
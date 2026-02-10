#!/bin/bash
# PDF Extraction Backend Setup Script

set -e

echo "Setting up PDF Extraction Backend..."

# Check Python version
python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
required_version="3.10"

if [[ "$python_version" < "$required_version" ]]; then
    echo "Error: Python 3.10+ is required (found $python_version)"
    exit 1
fi

echo "Python version: $python_version"

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create directories
echo "Creating required directories..."
mkdir -p models uploads

# Download models (optional - will use fallback if not present)
echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "To start the server:"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Or use Docker:"
echo "  docker-compose up -d"
echo ""
echo "API will be available at: http://localhost:8000"
echo ""
echo "Optional: Download DocLayout-YOLO model for better layout detection:"
echo "  Download from: https://huggingface.co/opendatalab/DocLayout-YOLO"
echo "  Place doclayout_yolo_ft.pt in the models/ directory"
echo ""

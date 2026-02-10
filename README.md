# Buildamax AI Tender Tool

A comprehensive construction estimation and tender management platform for Australian builders.

## Features

### PDF Takeoff Tool
- Interactive canvas for measuring areas, lengths, and counts on PDF plans
- Scale calibration for accurate measurements
- Cost estimation with SOW rate linking
- CSV export and markup calculation

### Market Insights
- Labour rates by state with data freshness tracking
- Scope of Work (SOW) rates for all Australian states
- Supplier database with 5-7 suppliers per state
- Price webhook system for automatic updates

### Estimation Tools
- Material pricing with real-time search
- NCC compliance checking
- Quote analyzer for subcontractor quotes
- Revision tracking and diff viewer
- Project templates (residential, commercial, industrial)

### AI Features
- AI chatbot for assistance
- Plan analysis with symbol detection
- Fixture and opening summarization
- **PDF-Extract-Kit Integration** (New!)
  - Automatic layout detection using DocLayout-YOLO
  - OCR text extraction with PaddleOCR
  - Table parsing for BOQ/schedule data
  - Dimension extraction from drawings

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **PDF**: PDF.js + Fabric.js for canvas
- **AI Extraction**: FastAPI + PDF-Extract-Kit (Python)
- **Charts**: Recharts

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yannlb1990/Desktop-AI-Estimation-.git
cd Desktop-AI-Estimation-
```

### 2. Install Node.js

If you don't have Node.js installed:
```bash
# Using Homebrew (macOS)
brew install node

# Or using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Supabase

1. Create a Supabase project at https://supabase.com
2. Go to **Settings** > **API** in your Supabase dashboard
3. Copy the **Project URL** and **anon/public key**
4. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

5. Update the `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key_here"
VITE_SUPABASE_URL="https://your_project_id.supabase.co"
```

### 5. Set Up Database

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run the migration files in order from `supabase/migrations/`:
   - Start with `001_initial_schema.sql`
   - Then run each numbered migration in sequence

Or run all migrations at once:
```bash
# If you have Supabase CLI installed
supabase db push
```

### 6. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 7. Set Up PDF Extraction Backend (Optional)

For AI-powered PDF analysis:

```bash
cd backend

# Using setup script
./setup.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The API will run at `http://localhost:8000`.

Add to your `.env`:
```env
VITE_PDF_API_URL="http://localhost:8000"
```

Or use Docker:
```bash
cd backend
docker-compose up -d
```

### 8. Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/        # React components
│   ├── features/     # Feature-specific components
│   ├── takeoff/      # PDF takeoff components
│   └── ui/           # shadcn/ui components
├── data/             # Static data (rates, templates)
├── hooks/            # Custom React hooks
├── integrations/     # Supabase client
├── lib/              # Utilities and API clients
│   └── api/          # API layer (including pdfExtractionApi)
├── pages/            # Page components
└── utils/            # Helper utilities

backend/              # Python FastAPI backend
├── main.py           # FastAPI application
├── pdf_extractor.py  # PDF-Extract-Kit integration
├── models.py         # Pydantic models
├── requirements.txt  # Python dependencies
├── Dockerfile        # Docker configuration
└── docker-compose.yml

supabase/
├── functions/        # Edge functions for AI
└── migrations/       # Database schema
```

## Key Components

| Component | Description |
|-----------|-------------|
| `PDFTakeoff` | Interactive PDF viewer with measurement tools |
| `InteractiveCanvas` | Fabric.js canvas for drawing measurements |
| `AIExtractionPanel` | AI-powered PDF content extraction |
| `MarketInsights` | Labour rates, SOW rates, suppliers dashboard |
| `CostEstimator` | Cost calculation with SOW rate linking |
| `NCCCompliancePanel` | NCC compliance checking |
| `QuoteAnalyzerPanel` | Analyze subcontractor quotes |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID |
| `VITE_PDF_API_URL` | PDF extraction API URL (default: http://localhost:8000) |

## Deployment

Deploy to Vercel, Netlify, or any static hosting:

```bash
npm run build
# Deploy the 'dist' folder
```

## License

Private - Buildamax Pty Ltd

# Migration Estimation

A migration estimation tool with a dynamic questionnaire frontend and a FastAPI backend for calculating migration efforts between technologies.


## Project Structure

```
migration-estimation/
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/                 # Pages and layouts
│   │   └── components/
│   │       ├── main/            # Form renderer component
│   │       ├── metadata/        # Form JSON configuration
│   │       ├── store/           # Zustand state management
│   │       └── utils/           # Helpers, types, validation
│   ├── public/                  # Static assets
│   └── package.json
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── api/v1/              # API routes and controllers
│   │   │   ├── controller/      # Endpoint handlers
│   │   │   └── schemas/         # Pydantic models
│   │   ├── core/                # Configuration
│   │   ├── migration/           # Migration rules and weights
│   │   │   └── cosmosdb_to_mongodb/
│   │   └── main.py              # FastAPI app entry point
│   └── requirements.txt
└── README.md
```

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Python 3.11 or higher
- pip

## Frontend Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/migration-estimation.git
   ```

2. **Install dependencies**

   ```bash
   cd frontend
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open in browser**

   Visit [http://localhost:3000](http://localhost:3000)

## Backend Setup

1. **Navigate to backend directory**

   ```bash
   cd backend
   ```

2. **Create a virtual environment**

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Start the development server**

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```


## Configuration

### Frontend

The form is configured via JSON at `frontend/src/components/metadata/form.json`. Edit this file to customize sections and questions.

### Backend

The backend uses environment variables for configuration. Create a `.env` file in the `backend/` directory to override defaults:

```env
APP_NAME=Migration Estimation API
APP_VERSION=1.0.0
DEBUG=true
CORS_ORIGINS=["http://localhost:3000"]
```


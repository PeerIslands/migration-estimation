# Migration Questionnaire

A dynamic, JSON-driven questionnaire application built with Next.js. Supports multiple question types, validation, progress tracking, and save/resume functionality.


## Project Structure

```
migration-questionnaire/
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
└── README.md
```

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/migration-questionnaire.git
   cd migration-questionnaire
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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Features

- Multi-section forms with Back/Next navigation
- Question types: text, email, number, date, mcq, checkbox, rating, textarea
- Built-in validation (required, email, min/max, regex)
- Progress bar
- Auto-save to localStorage with resume on reload
- Per-environment questions with tabbed interface

## Configuration

The form is configured via JSON at `frontend/src/components/metadata/form.json`. Edit this file to customize sections and questions.

## License

Private

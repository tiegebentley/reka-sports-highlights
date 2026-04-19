# Reka Sports Highlights - Frontend

React + Vite + TypeScript + Tailwind CSS frontend for Reka Sports Highlights video processing platform.

## Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS v3 + shadcn/ui components
- **Routing**: React Router DOM
- **State Management**: React Query (TanStack Query)
- **Backend**: Supabase (Auth, Database, Storage)
- **Icons**: Lucide React

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── layout/          # Header, Footer, Layout components
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── utils.ts         # Utility functions (cn helper)
│   ├── pages/
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── Upload.tsx       # Video upload page
│   │   ├── Library.tsx      # Video library
│   │   ├── Login.tsx        # Login page
│   │   └── Signup.tsx       # Signup page
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles + Tailwind
├── tailwind.config.ts       # Tailwind configuration
├── vite.config.ts           # Vite configuration
└── tsconfig.json            # TypeScript configuration
```

## Routes

- `/` - Dashboard (home page)
- `/upload` - Video upload interface
- `/library` - Video library
- `/login` - Authentication (login)
- `/signup` - Authentication (signup)

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 5175)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
VITE_DB_URL=your_supabase_url
VITE_DB_ANON_KEY=your_supabase_anon_key
```

## Features

- Responsive design with Tailwind CSS
- Dark mode ready (via Tailwind classes)
- Path aliases configured (`@/` for `src/`)
- TypeScript strict mode
- Component-based architecture
- shadcn/ui component foundation

## Next Steps

1. Configure Supabase credentials in `.env`
2. Implement authentication flows
3. Add video upload functionality
4. Connect to backend API
5. Add UI components from shadcn/ui as needed

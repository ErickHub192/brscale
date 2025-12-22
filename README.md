# BR SCALE

AI-powered real estate marketplace using multi-agent systems to automate 80-90% of the property sales process.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your actual keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
br-scale/
├── src/
│   ├── domain/              # Business entities & rules
│   ├── application/         # Use cases & services
│   ├── infrastructure/      # External integrations
│   └── presentation/        # UI components
├── app/                     # Next.js App Router
├── supabase/               # Database migrations
└── docs/                    # Documentation
```

## 🛠️ Tech Stack

- **Framework**: Next.js 16.1 + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: LangGraph + OpenAI GPT-5.1
- **Styling**: TailwindCSS

## 📚 Documentation

- [Architecture](./ARCHITECTURE.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Migrations Strategy](./MIGRATIONS_STRATEGY.md)
- [Project Timeline](./PROJECT_TIMELINE.md)

## 🎯 Current Phase

**Phase 2: Project Setup** ✅
- [x] Next.js initialization
- [x] Clean Architecture structure
- [x] Domain entities
- [x] Supabase setup
- [x] First migration

## 📝 Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run db:reset     # Reset database
npm run db:migrate   # Create new migration
npm run db:push      # Push migrations to remote
```

## 🔐 Environment Variables

See `.env.example` for required environment variables.

## 📄 License

Private - BR SCALE

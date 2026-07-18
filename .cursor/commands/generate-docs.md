# Generate Comprehensive Project Documentation

Generate detailed technical documentation for this AI-powered Next.js template project with the following comprehensive structure:

## 📋 Documentation Structure

### 1. Project Overview & Purpose
- **Project Name**: AI Next.js Template with Joveo Enterprise Dashboard
- **Primary Purpose**: Cursor AI-powered development template for building enterprise dashboards with Joveo design system
- **Target Audience**: Developers, Product Managers, and teams building enterprise analytics applications
- **Key Value Proposition**: Accelerated development using AI prompts with pre-built components and strict design compliance

### 2. Tech Stack & Architecture

#### Core Framework & Language
- **Frontend Framework**: Next.js 15.3.5 (React 19.0.0)
- **Language**: TypeScript 5.x with strict type checking
- **Runtime**: Node.js with modern ES modules
- **Build System**: Turbopack for fast development builds

#### UI & Styling
- **Design System**: Joveo Enterprise Design System (strict compliance mode)
- **Component Library**: 
  - Radix UI primitives (@radix-ui/react-*)
  - Custom shadcn/ui components
  - Joveo-branded chart components (Recharts-based)
- **Styling**: 
  - Tailwind CSS 4.1.11 with custom Joveo design tokens
  - PostCSS for processing
  - CSS custom properties for design token management
- **Icons**: Lucide React icon library
- **Animations**: Framer Motion 12.x for smooth transitions

#### Data Management
- **State Management**: 
  - React Query (TanStack Query) for server state
  - React Hook Form for form state with Zod validation
- **Database Integration**: 
  - Prisma ORM 6.x for database operations
  - AWS integration for cloud services
- **Data Visualization**: Recharts 3.x with custom Joveo chart components

#### Development & Quality
- **Linting**: ESLint 9.x with Next.js configuration
- **Type Safety**: Strict TypeScript with comprehensive type definitions
- **Package Management**: NPM with lock file for reproducible builds
- **Dev Tools**: 
  - React Query DevTools for debugging
  - Hot reload with Turbopack

### 3. Application Features & Functionality

#### Core Application Purpose
This is a **Cursor AI development template** that teaches developers how to:
- Build enterprise dashboards using AI prompts
- Implement Joveo design system components
- Create data visualizations and analytics interfaces
- Integrate with backend APIs and databases
- Follow best practices for production-ready applications

#### Key Features

**🎯 AI-Powered Development Examples**:
- Real prompts for creating dashboard cards with glassmorphism effects
- Contact form generation with validation and loading states
- API route creation with database integration
- Error boundary implementation for production resilience
- Debug console for development monitoring
- Google Sheets integration for dynamic data sources

**📊 Enterprise Dashboard Components**:
- **Header**: Dark navy (#1C2536) with client selector and user profile
- **Sidebar**: Expandable navigation (64px collapsed, 240px expanded)
- **Metric Cards**: 4-column grid with KPI displays and trend indicators
- **Charts**: Bar, pie, combination, and spend-by-channel visualizations
- **Data Tables**: Sortable, filterable tables with pagination
- **Interactive Elements**: Hover states, loading indicators, error handling

**🎨 Joveo Design System Integration**:
- Strict color palette enforcement (#303F9F primary, #7681E8 secondary)
- SF Pro Text typography with consistent spacing (16px/24px units)
- Component variants: metric cards, data tables, navigation elements
- Responsive design with mobile-first approach
- Accessibility compliance with ARIA attributes

**🔗 Backend Integration Capabilities**:
- Next.js API routes with TypeScript
- Prisma database integration
- AWS services integration (Secrets Manager, S3, etc.)
- Google Sheets API connectivity
- React Query for efficient data fetching and caching

#### User Workflows Supported
1. **Dashboard Creation**: Generate complete analytics dashboards with AI prompts
2. **Data Visualization**: Create charts and graphs with Joveo branding
3. **Form Building**: Generate validated forms with loading states
4. **API Integration**: Connect frontend to backend services
5. **Component Development**: Build reusable UI components following design system
6. **Spreadsheet Integration**: Turn Google Sheets into dynamic applications

### 4. Project Structure & Key Files

#### Configuration Files
- `package.json`: Dependencies and build scripts with profile switching
- `next.config.ts`: Next.js configuration with build optimizations
- `tailwind.config.js`: Tailwind configuration with Joveo design tokens
- `tsconfig.json`: TypeScript configuration with strict type checking
- `.cursorrules`: AI development rules and design system enforcement

#### Source Code Organization
```
src/
├── app/                    # Next.js app router
│   ├── api/               # Backend API routes
│   ├── dashboard/         # Dashboard pages
│   └── globals.css        # Global styles with Joveo tokens
├── components/            # Reusable UI components
│   ├── ui/               # Base shadcn/ui components
│   │   ├── charts/       # Joveo-branded chart components
│   │   └── metrics/      # KPI and metric display components
│   ├── Header.tsx        # Application header with navigation
│   └── Sidebar.tsx       # Expandable sidebar navigation
├── lib/                  # Utility functions and configurations
│   ├── joveo-design-tokens.ts  # Centralized design system
│   └── chart-types.ts    # Chart configuration types
└── utils/               # Helper functions
```

#### Design System Files
- `src/lib/joveo-design-tokens.ts`: Centralized color palette, typography, spacing
- `.cursor/profiles/joveo-ai-dashboard/`: Strict Joveo compliance rules
- Component-specific styling in individual component files

### 5. Key Dependencies & Packages

#### Production Dependencies (74 packages)
**Core Framework**:
- `next@15.3.5`: React framework with app router
- `react@19.0.0` & `react-dom@19.0.0`: React library and DOM renderer
- `typescript@5.x`: Type-safe JavaScript development

**UI & Design**:
- `@radix-ui/react-*`: Accessible component primitives (15+ packages)
- `tailwindcss@4.1.11`: Utility-first CSS framework  
- `framer-motion@12.23.12`: Animation library
- `lucide-react@0.525.0`: Icon library with 1000+ icons
- `class-variance-authority@0.7.1`: Component variant management

**Data & State Management**:
- `@tanstack/react-query@5.81.5`: Server state management
- `react-hook-form@7.62.0`: Form state and validation
- `zod@4.0.14`: Schema validation library
- `@prisma/client@6.11.1`: Database ORM client

**Charts & Visualization**:
- `recharts@3.1.0`: React charting library
- Custom Joveo chart components built on Recharts

**Backend Integration**:
- `@aws-sdk/client-secrets-manager@3.845.0`: AWS services integration
- `googleapis@152.0.0`: Google APIs integration
- `axios@1.6.8`: HTTP client for API requests

#### Development Dependencies (11 packages)
- `eslint@9` & `eslint-config-next`: Code linting and quality
- `@types/*`: TypeScript type definitions for all major libraries
- `autoprefixer@10.4.21`: CSS vendor prefixing

### 6. Development Setup & Scripts

#### Available Scripts
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Production build with optimization  
npm run start        # Start production server on port 8080
npm run lint         # Run ESLint for code quality
npm run type-check   # TypeScript compilation check
npm run clean        # Clean build artifacts and caches
npm run fresh        # Complete reset and fresh development start
```

#### Profile Management
```bash
npm run profile:joveo    # Switch to Joveo design system (strict mode)
npm run profile:default  # Switch to flexible development mode
npm run profile:status   # Check current active profile
```

#### Environment Setup
1. Clone repository
2. `npm install` - Install all dependencies
3. Configure environment variables for AWS/Google APIs (if using)
4. `npm run dev` - Start development server
5. Open `http://localhost:3000` in Cursor-compatible browser

### 7. Design System & Branding

#### Joveo Color Palette
- **Primary Colors**: #1C2536 (header), #303F9F (primary), #7681E8 (secondary)
- **Status Colors**: #43A047 (success), #FFAB00 (warning), #FF5252 (error)
- **Text Colors**: #3D4759 (primary text), #718096 (secondary text)
- **Backgrounds**: #FFFFFF (content), #F7FAFC (secondary surfaces)

#### Typography System
- **Font Family**: SF Pro Text with system fallbacks
- **Scale**: 11px-24px with consistent line heights (1.25-1.75)
- **Weights**: Regular (400), Medium (500), Semibold (600), Bold (700)
- **Usage**: Headers use semibold, body text uses regular, labels use medium

#### Component Standards
- **Border Radius**: Consistent 4px across all components
- **Spacing**: 4px base unit with multiples (8px, 16px, 24px, 32px, 48px)
- **Shadows**: Subtle elevation with consistent shadow patterns
- **Animations**: 150ms-500ms durations with ease-in-out timing

### 8. API Integration & Data Flow

#### Backend Architecture
- **API Routes**: RESTful endpoints in `src/app/api/`
- **Database**: Prisma ORM with PostgreSQL/MySQL support
- **Authentication**: JWT-based with role management
- **Error Handling**: Consistent error responses with proper HTTP codes

#### Data Sources
- **Internal APIs**: Custom Next.js API routes
- **External APIs**: Google Sheets, AWS services
- **Database**: Relational data through Prisma ORM
- **Real-time**: WebSocket support for live updates

#### State Management Pattern
- **Server State**: React Query for caching, synchronization, background updates
- **Client State**: React useState/useReducer for local component state
- **Form State**: React Hook Form with Zod validation schemas
- **Global State**: Context API for theme, user preferences

### 9. Production Considerations

#### Performance Optimizations
- **Bundle Splitting**: Automatic code splitting with Next.js
- **Image Optimization**: Next.js image component with lazy loading
- **Caching**: React Query for data caching, Next.js for static generation
- **Tree Shaking**: Unused code elimination in production builds

#### Security Features
- **Type Safety**: Comprehensive TypeScript coverage
- **Input Validation**: Zod schemas for all data inputs
- **API Security**: Rate limiting, authentication, input sanitization
- **Environment Variables**: Secure configuration management

#### Scalability & Maintenance
- **Component Architecture**: Reusable, composable components
- **Design System**: Centralized tokens for consistent updates
- **Code Quality**: ESLint rules, TypeScript strict mode
- **Documentation**: Inline JSDoc comments, component prop documentation

### 10. Usage Examples & AI Prompts

#### Getting Started Prompts
Copy these into Cursor to generate components:

**Dashboard Creation**:
"Create a modern dashboard card component with glassmorphism effect, showing revenue metrics with a chart. Include hover animations and proper TypeScript props."

**Data Table Generation**:
"Build a data table with sorting, filtering, pagination, and row actions. Use Joveo design tokens and include proper accessibility features."

**Chart Integration**:
"Generate a bar chart component using Recharts that displays campaign performance data. Follow Joveo color palette and include interactive tooltips."

**API Route Creation**:
"Create a Next.js API route that connects to Prisma database, handles CRUD operations for users, includes error handling and TypeScript types."

This template accelerates development by providing AI-ready prompts and pre-configured components that generate production-quality code instantly.

# Generate Joveo Enterprise Dashboard

Generate a comprehensive enterprise dashboard following strict Joveo design system compliance with:

## 🎯 Dashboard Structure
- **Header**: Dark navy (#1C2536) with client selector dropdown
- **Expandable Side Navigation**: Icon-only with hover states and smooth transitions
- **Main Content Area**: White background with metric cards, charts, and data tables
- **Footer**: Aligned to Joveo design system with consistent spacing and typography

## 📊 Core Components

### Header Section
Create a top header with:
- Dark navy background (#1C2536)
- Client/account selector dropdown with search functionality
- Notification bell icon with badge count
- Breadcrumb navigation below header
- Apply SF Pro Text typography and consistent 16px/24px padding

### Side Navigation
Generate expandable sidebar with:
- Icon-only collapsed state (64px width)
- Expanded state (240px width) with labels
- Smooth CSS transitions (0.3s ease-in-out)
- Active state indicators using primary blue (#303F9F)
- Hover states with subtle background changes
- Dashboard, Analytics, Campaigns, Reports, Settings menu items

### Main Dashboard Area
Create main content with:

#### Metric Cards Grid (4-column layout)
- **Revenue Card**: Current month revenue with trend arrow and sparkline
- **Campaign Performance**: CTR with percentage change indicator  
- **Budget Utilization**: Progress bar with remaining budget
- **Active Campaigns**: Count with status breakdown
- Apply consistent 4px border radius and subtle shadows
- Use success green (#43A047) for positive trends

#### Data Visualizations
- **Bar Chart**: Campaign performance by channel using JoveoBarChart component
- **Pie Chart**: Budget allocation by campaign type using JoveoPieChart component  
- **Combination Chart**: Spend vs Performance metrics using JoveoCombinationChart
- Apply Joveo color palette: Primary (#303F9F), Secondary (#7681E8), Success (#43A047)
- Include interactive tooltips and proper legends

#### Advanced Data Table
Generate sortable, filterable table with:
- **Column Features**: Sorting, filtering, resizing, drag & drop reordering
- **Search Input**: Top-level search with debounced filtering
- **Column Controls**: Show/hide toggles, column width persistence
- **Row Actions**: Edit, delete, duplicate with consistent button styling
- **Pagination**: Bottom pagination with configurable page sizes
- **Status Filtering**: Dropdown filters for Active/Paused/Completed campaigns
- Style with Joveo table rules and hover states

### Footer
Create footer with:
- Consistent padding (24px) and light background
- Copyright information with proper typography
- Links styled with primary blue (#303F9F)
- Responsive layout maintaining design system alignment

## 🎨 Design System Compliance

### Typography Scale
- Headers: Semibold 20px/30px for section titles
- Body text: Regular 14px/20px for content
- Labels: Medium 12px/18px for form elements
- Use SF Pro Text font family throughout

### Color Tokens
- Primary Header: #1C2536 (Dark Navy)
- Primary Blue: #303F9F for CTAs and active states  
- Secondary Blue: #7681E8 for secondary actions
- Success Green: #43A047 for positive indicators
- Text Gray: #3D4759 for body text
- Background: #FFFFFF for content areas

### Spacing & Layout
- Consistent 4px border radius for all components
- Subtle elevation shadows for cards and modals
- 16px/24px padding units for consistent spacing
- 4-column grid system for metric cards
- Responsive breakpoints with mobile-first approach

## 🚀 Component Implementation

Use existing Joveo components:
- `JoveoButton` for all interactive elements
- `JoveoTable` for data tables with advanced features
- `MetricCardGrid` with `MetricCard` and `SparklineMetricCard`
- `JoveoBarChart`, `JoveoPieChart`, `JoveoCombinationChart` for visualizations
- Import design tokens from `joveo-design-tokens.ts`
- Apply `ChartErrorBoundary` for data visualization error handling

## 📝 Code Requirements

### TypeScript Implementation
- Strong typing for all data interfaces
- Proper error boundary implementation  
- Loading states with skeleton components
- Accessibility compliance (ARIA labels, keyboard navigation)
- Mobile responsive design with breakpoint handling

### Performance Optimization
- Lazy loading for chart components
- Memoized callbacks and computed values
- Efficient data filtering and sorting algorithms
- Debounced search input handling
- Virtual scrolling for large datasets

### State Management
- Local component state for UI interactions
- Proper data fetching with loading/error states
- Form state management with validation
- URL state synchronization for filters and pagination

Generate complete, production-ready dashboard code that strictly adheres to Joveo design system guidelines with no custom styling variations or unauthorized component modifications.
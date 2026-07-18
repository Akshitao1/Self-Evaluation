# Generate Advanced Joveo Enterprise Table

Generate a comprehensive data table component following strict Joveo design system compliance with advanced features:

## 🎯 Table Structure
- **Header Section**: Search input with proper spacing and typography
- **Column Controls**: Show/hide toggles, sorting indicators, and resizing handles
- **Data Rows**: Consistent row height, hover states, and status indicators
- **Footer Section**: Pagination controls and row count information

## 📊 Core Features

### Search & Filtering
Create top-level search functionality with:
- Debounced search input (300ms delay) with consistent styling
- Global search across all table columns
- Status filter dropdown (Active, Paused, Completed, All)
- Date range filters with proper date picker integration
- Clear filters button with secondary styling
- Apply SF Pro Text typography and #3D4759 text color

### Column Management
Generate advanced column controls with:
- **Column Sorting**: Clickable headers with up/down arrow indicators
- **Multi-column Sorting**: Hold Shift for secondary sort with visual priority indicators
- **Column Resizing**: Draggable column borders with minimum width constraints (80px)
- **Drag & Drop Reordering**: Column headers with drag handles and visual feedback
- **Show/Hide Toggles**: Column visibility controls in dropdown menu
- **Column Width Persistence**: Save column preferences to localStorage
- Use primary blue (#303F9F) for active sort indicators

### Table Styling & Layout
Apply Joveo design system with:
- **Header Row**: Light background (#F8F9FA) with medium weight labels (12px/18px)
- **Data Rows**: White background (#FFFFFF) with subtle hover states (#F8F9FA)
- **Row Borders**: Light gray (#E5E7EB) separators between rows
- **Cell Padding**: Consistent 12px horizontal, 16px vertical padding
- **Row Height**: Minimum 48px for accessibility compliance
- **Zebra Striping**: Optional alternating row backgrounds for large datasets

### Interactive Elements
Implement table interactions with:
- **Row Selection**: Checkbox column with select all functionality
- **Row Actions**: Dropdown menu with Edit, Delete, Duplicate options
- **Bulk Actions**: Multi-select operations with action bar
- **Row Expansion**: Expandable rows for detailed information
- **Context Menu**: Right-click actions with consistent styling
- **Keyboard Navigation**: Arrow keys, Tab, Enter for accessibility

## 🎨 Design System Compliance

### Typography Scale
- **Table Headers**: Medium 12px/18px (#3D4759) for column labels
- **Data Cells**: Regular 14px/20px (#3D4759) for content
- **Status Badges**: Medium 11px/16px with appropriate background colors
- **Action Labels**: Medium 12px/18px for button text
- Use SF Pro Text font family throughout

### Color Tokens
- **Header Background**: #F8F9FA for table header row
- **Row Hover**: #F8F9FA for interactive row states
- **Border Color**: #E5E7EB for cell borders and separators
- **Active Sort**: #303F9F for sort indicators and selected states
- **Status Colors**: Success (#43A047), Warning (#F57C00), Error (#D32F2F)
- **Text Color**: #3D4759 for all table content

### Interactive States
- **Sort Indicators**: Arrow icons with primary blue (#303F9F) when active
- **Column Resize**: Cursor change and visual feedback during resize
- **Drag Handles**: Subtle grip indicators with hover states
- **Loading States**: Skeleton rows with animated shimmer effect
- **Empty States**: Centered message with illustration and CTA

## 🚀 Component Implementation

### Table Structure
Generate table using existing components:
```typescript
<JoveoTable
  data={tableData}
  columns={columnDefinitions}
  sortable={true}
  filterable={true}
  resizable={true}
  reorderable={true}
  selectable={true}
  searchable={true}
  pagination={true}
/>
```

### Required Props Interface
```typescript
interface JoveoTableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
  selectable?: boolean;
  searchable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  onRowSelect?: (selectedRows: T[]) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
}
```

### Column Definition Structure
```typescript
interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  render?: (value: any, row: T) => React.ReactNode;
  filter?: 'text' | 'select' | 'date' | 'number';
  filterOptions?: Array<{ label: string; value: any }>;
}
```

## 📝 Code Requirements

### TypeScript Implementation
- **Generic Type Support**: Full TypeScript generics for type safety
- **Accessibility Compliance**: ARIA labels, keyboard navigation, screen reader support
- **Performance Optimization**: Virtual scrolling for large datasets (>1000 rows)
- **Error Boundaries**: Graceful error handling with fallback UI
- **Loading States**: Skeleton components during data fetching

### Advanced Features
- **Export Functionality**: CSV/Excel export with filtered data
- **Column Presets**: Save/load column configurations
- **Quick Filters**: Predefined filter buttons for common queries
- **Advanced Search**: Boolean operators and field-specific search
- **Inline Editing**: Cell-level editing with validation

### State Management
- **Filter State**: URL synchronization for shareable filtered views
- **Sort State**: Persist sorting preferences across sessions
- **Column State**: Save column order, width, and visibility
- **Selection State**: Maintain row selection across pagination
- **Search State**: Debounced search with query highlighting

### Mobile Responsiveness
- **Horizontal Scroll**: Touch-friendly scrolling on mobile
- **Column Prioritization**: Hide less important columns on small screens
- **Touch Interactions**: Tap targets meeting 44px minimum size
- **Responsive Breakpoints**: Adapt layout for tablet and mobile viewports

## 🔧 Usage Examples

### Basic Implementation
```typescript
const campaigns = [
  { id: 1, name: "Summer Campaign", status: "Active", budget: 50000, ctr: 2.4 },
  { id: 2, name: "Holiday Promo", status: "Paused", budget: 75000, ctr: 3.1 }
];

const columns: ColumnDefinition<Campaign>[] = [
  { key: 'name', label: 'Campaign Name', sortable: true, filterable: true },
  { key: 'status', label: 'Status', filter: 'select', filterOptions: statusOptions },
  { key: 'budget', label: 'Budget', sortable: true, render: formatCurrency },
  { key: 'ctr', label: 'CTR %', sortable: true, render: formatPercentage }
];

<JoveoTable data={campaigns} columns={columns} />
```

### Advanced Configuration
```typescript
<JoveoTable
  data={tableData}
  columns={columnDefinitions}
  searchable={true}
  sortable={true}
  filterable={true}
  resizable={true}
  reorderable={true}
  selectable={true}
  pagination={true}
  pageSize={25}
  loading={isLoading}
  emptyMessage="No campaigns found. Create your first campaign to get started."
  onRowSelect={handleRowSelection}
  onSort={handleSort}
  onFilter={handleFilter}
/>
```

Generate complete, production-ready table component that strictly adheres to Joveo design system guidelines with no custom styling variations or unauthorized component modifications. Include comprehensive error handling, accessibility features, and performance optimizations for enterprise-scale data handling.

# Refactor Design - Joveo Design System Compliance

Refine this output to strictly follow Joveo's design system. 
Ensure all components, tokens (colors, typography, spacing, shadows, radii), 
and layouts match the approved Joveo patterns. 
Replace any non-standard UI with the correct Joveo component equivalent.

## 🎯 Design System Enforcement

### Automatic Design Corrections
Automatically correct this output to match Joveo's design system:
- Apply approved design tokens from `joveo-design-tokens.ts`
- Replace off-spec components with Joveo-standard equivalents
- Adjust layouts to align with enterprise dashboard patterns
- Fix typography, spacing, and color violations

### Command: `/check-design`
Analyze the current implementation and identify design system violations, then provide specific fixes.

## 🚨 Critical Design Violations to Fix

### Color Token Violations
**Fix these immediately:**
- ❌ Custom colors or hex codes not in design system
- ❌ Gradients or non-standard color combinations  
- ❌ Incorrect usage of semantic colors (error, warning, success)
- ✅ **Correct**: Use only approved tokens from Joveo palette

**Standard Color Tokens:**
```typescript
// Primary Colors
headerBackground: '#1C2536',    // Dark Navy Header
primaryBlue: '#303F9F',         // CTAs and Active States
secondaryBlue: '#7681E8',       // Secondary Actions
successGreen: '#43A047',        // Positive Indicators
textGray: '#3D4759',           // Body Text
contentBackground: '#FFFFFF'    // Main Background
```

### Typography Violations
**Fix these immediately:**
- ❌ Wrong font family (not SF Pro Text)
- ❌ Non-standard font sizes or line heights
- ❌ Incorrect font weights for hierarchy levels
- ✅ **Correct**: Apply Joveo typography scale exactly

**Standard Typography Scale:**
```typescript
// Headers: Semibold 20px/30px
// Body Text: Regular 14px/20px  
// Labels: Medium 12px/18px
// Font Family: SF Pro Text
```

### Component Violations
**Fix these immediately:**
- ❌ Custom-built components instead of Joveo library components
- ❌ Modified component styling or behavior
- ❌ Non-standard button styles, input fields, or data tables
- ✅ **Correct**: Use only approved Joveo components

**Required Joveo Components:**
- `JoveoButton` for all interactive elements
- `JoveoTable` for data tables
- `MetricCard` and `SparklineMetricCard` for KPIs
- `JoveoBarChart`, `JoveoPieChart`, `JoveoCombinationChart` for data viz
- Standard UI components from `components/ui/`

### Layout Violations
**Fix these immediately:**
- ❌ Inconsistent spacing (not using 16px/24px units)
- ❌ Wrong border radius (not 4px standard)
- ❌ Missing or incorrect shadows
- ❌ Non-standard grid layouts for metric cards
- ✅ **Correct**: Apply consistent Joveo layout patterns

**Standard Layout Rules:**
- Border Radius: 4px for all components
- Shadows: Subtle elevation only
- Spacing: 16px/24px padding units
- Grid: 4-column layout for metric cards
- Header Height: 64px with proper padding

## 🔧 Automated Refactoring Actions

### Phase 1: Token Replacement
1. **Replace Custom Colors**
   - Scan for hex codes not in approved palette
   - Replace with correct design tokens
   - Update CSS variables and Tailwind classes

2. **Fix Typography Issues**
   - Replace font-family declarations with SF Pro Text
   - Correct font-size and line-height values
   - Apply proper font-weight hierarchy

3. **Standardize Spacing**
   - Replace inconsistent margins/padding with standard units
   - Apply 4px border-radius consistently
   - Fix shadow implementations

### Phase 2: Component Standardization
1. **Replace Custom Components**
   ```typescript
   // ❌ Wrong - Custom button
   <button className="bg-blue-500 px-4 py-2 rounded">
   
   // ✅ Correct - Joveo component
   <JoveoButton variant="primary" size="medium">
   ```

2. **Fix Data Visualization**
   ```typescript
   // ❌ Wrong - Generic chart library
   <Chart type="bar" data={data} />
   
   // ✅ Correct - Joveo chart component
   <JoveoBarChart data={data} colors={joveoChartColors} />
   ```

3. **Standardize Tables**
   ```typescript
   // ❌ Wrong - Custom table
   <table className="custom-styles">
   
   // ✅ Correct - Joveo table
   <JoveoTable columns={columns} data={data} />
   ```

### Phase 3: Layout Compliance
1. **Header Structure**
   - Dark navy background (#1C2536)
   - Proper height (64px) and padding
   - Account selector and user profile components

2. **Sidebar Navigation**
   - Icon-only collapsed state (64px width)
   - Proper hover and active states
   - Smooth transitions (0.3s ease-in-out)

3. **Main Content Area**
   - White background (#FFFFFF)
   - 4-column metric card grid
   - Consistent padding (24px)
   - Proper chart integration

## 🎨 Design System Validation

### Pre-Refactor Checklist
Before starting refactoring, validate:
- [ ] All design tokens are imported from `joveo-design-tokens.ts`
- [ ] Typography uses SF Pro Text font family
- [ ] Colors match approved Joveo palette exactly
- [ ] Components are from Joveo library, not custom-built
- [ ] Layout follows 4-column grid for metrics
- [ ] Spacing uses 16px/24px units consistently

### Post-Refactor Validation
After refactoring, ensure:
- [ ] No custom CSS overrides Design System components
- [ ] All charts use Joveo color palette
- [ ] Interactive states (hover, active, focus) are consistent
- [ ] Mobile responsiveness maintained
- [ ] Accessibility standards preserved
- [ ] Performance optimizations retained

## 🚀 Advanced Refactoring Patterns

### Enterprise Dashboard Layout
```typescript
// Standard Joveo dashboard structure
<div className="min-h-screen bg-white">
  <Header className="bg-[#1C2536] h-16" />
  <div className="flex">
    <Sidebar className="w-16 hover:w-60 transition-all" />
    <main className="flex-1 p-6">
      <MetricCardGrid className="grid-cols-4 gap-6 mb-8" />
      <ChartsSection className="space-y-8" />
      <JoveoTable className="mt-8" />
    </main>
  </div>
</div>
```

### Data Visualization Standards
```typescript
// Approved chart color scheme
const joveoChartColors = {
  primary: '#303F9F',
  secondary: '#7681E8', 
  success: '#43A047',
  series: ['#303F9F', '#7681E8', '#43A047', '#FF7043', '#8BC34A']
};

// Standard chart configuration
<JoveoBarChart 
  data={chartData}
  colors={joveoChartColors}
  showTooltip={true}
  showLegend={true}
  height={300}
/>
```

### Metric Card Standards
```typescript
// Standard metric card implementation
<MetricCard
  title="Campaign Performance"
  value="94.2%"
  trend="up"
  trendValue="12.5%"
  chartData={sparklineData}
  color="success" // Maps to #43A047
/>
```

## 📋 Quality Assurance

### Design Review Criteria
1. **Visual Consistency**: All elements follow Joveo visual language
2. **Component Integrity**: No modified or custom components
3. **Token Compliance**: All colors, fonts, spacing from design system
4. **Layout Standards**: Proper grid, alignment, and hierarchy
5. **Interactive States**: Consistent hover, focus, and active states

### Testing Requirements
- Cross-browser compatibility testing
- Mobile responsiveness validation
- Accessibility audit (WCAG 2.1 AA compliance)
- Performance impact assessment
- Design system regression testing

## 🎯 Success Criteria

**Refactoring is complete when:**
- ✅ 100% design token compliance
- ✅ All components from Joveo library
- ✅ Consistent typography throughout
- ✅ Proper layout grid implementation  
- ✅ Standard color palette usage
- ✅ No custom styling overrides
- ✅ Maintained functionality and performance
- ✅ Responsive design preserved
- ✅ Accessibility standards met

**Command Usage:**
Use this refactoring guide to systematically bring any dashboard implementation into full Joveo design system compliance, ensuring enterprise-grade consistency and brand alignment.


# Generate Joveo Enterprise Header

Create a comprehensive enterprise header component following strict Joveo design system compliance with:

## 🎯 Header Structure
- **Dark Navy Background**: Primary header color (#1C2536) 
- **Client Selector Dropdown**: Multi-account/region selection with search functionality
- **Typography**: SF Pro Text with approved weights and spacing tokens
- **Consistent Spacing**: 16px/24px padding units following Joveo design standards

## 🎨 Design Requirements

### Background & Layout
- Background color: #1C2536 (Dark Navy)
- Height: 64px fixed header
- Full width with horizontal padding: 24px
- Flex layout with space-between alignment
- Subtle bottom border or shadow for depth

### Typography Standards
- Font Family: SF Pro Text
- Logo/Brand text: Semibold 18px/24px
- Dropdown labels: Medium 14px/20px  
- User name: Regular 14px/20px
- Role/subtitle: Regular 12px/18px
- All text in white/light colors for contrast

## 🔧 Component Structure

### Left Section - Logo & Navigation
Create left section with:
- Joveo logo/brand mark with proper sizing (32px height)
- Optional breadcrumb navigation below main header
- Consistent vertical alignment and spacing

### Center Section - Client Selector
Generate client selector dropdown with:
- **Trigger Button**: Current client name with down chevron icon
- **Dropdown Panel**: 
  - Search input field at top
  - Scrollable list of clients/accounts
  - Each item shows: Client name, account ID, region
  - Selection highlights with primary blue (#303F9F)
- **Functionality**: 
  - Filter clients on search input
  - Keyboard navigation support
  - Close on outside click
  - Loading states for async data

## 📱 Interactive States

### Hover States
- Client selector: Subtle background lightening
- Dropdown items: Background color change (#303F9F with opacity)
- Buttons: Smooth color transitions (0.2s ease)

### Active States  
- Selected dropdown items: Primary blue background (#303F9F)
- Open dropdown triggers: Visual indication of expanded state
- Focus states: Clear keyboard navigation indicators

### Loading States
- Client selector: Skeleton placeholders during data fetch
- Dropdown content: Loading indicators for async operations

## 🎯 Accessibility Requirements

### ARIA Labels & Roles
- Proper button roles for interactive elements
- ARIA expanded states for dropdowns
- Screen reader friendly labels
- Keyboard navigation support (Tab, Enter, Escape)

### Color Contrast
- White text on dark navy background meets WCAG AA standards
- Interactive elements have sufficient color contrast
- Focus indicators are clearly visible

## 🔧 Technical Implementation

### React Component Structure
```typescript
<Header className="bg-[#1C2536] h-16 px-6 flex items-center justify-between">
  <LeftSection>
    <JoveoLogo />
  </LeftSection>
  
  <CenterSection>
    <ClientSelector />
  </CenterSection>
</Header>
```

### Required Props Interface
- `currentClient`: Selected client/account object
- `availableClients`: Array of client options
- `onClientChange`: Callback for client selection

### State Management
- Dropdown open/closed states
- Loading states for data fetching  
- Selected client/account tracking

## 🎨 Styling Guidelines

### Colors
- Background: #1C2536 (Dark Navy)
- Text: #FFFFFF (White) and #F8F9FA (Light Gray)
- Interactive: #303F9F (Primary Blue)
- Hover: #7681E8 (Secondary Blue)
- Success/Online: #43A047 (Success Green)

### Spacing & Sizing
- Header height: 64px
- Horizontal padding: 24px
- Avatar size: 32px diameter
- Icon sizes: 16px-20px
- Border radius: 4px for dropdowns
- Dropdown min-width: 280px

### Shadows & Borders
- Header bottom shadow: 0 1px 3px rgba(0,0,0,0.1)
- Dropdown shadow: 0 4px 12px rgba(0,0,0,0.15)
- Border radius: 4px for all interactive elements

## ⚡ Performance Considerations

### Optimization
- Lazy load client data when dropdown opens
- Debounce search input for client filtering
- Memoize dropdown items to prevent unnecessary re-renders
- Use React.memo for avatar component
- Implement virtual scrolling for large client lists

### Loading Strategy
- Show skeleton states during initial load
- Progressive enhancement for dropdown functionality
- Graceful degradation if JavaScript fails
- Proper error boundaries for API failures

## 🔒 Security & Privacy

### Data Handling
- Proper authentication checks before showing client list
- Sanitize user input in search fields

### Privacy
- No sensitive data in localStorage
- Proper CORS configuration for API calls

Remember: Always maintain strict adherence to Joveo design standards. Consistency over creativity, brand compliance is mandatory.

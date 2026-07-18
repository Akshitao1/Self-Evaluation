# 🎯 JOVEO MODAL COMMAND
# Fix modal issues: transparent backgrounds, z-index, confirmation dialogs with sticky footers

## 🚨 COMMON ISSUES TO FIX
- **Transparent backgrounds**: Modal overlays not properly opaque
- **Z-index problems**: Modals appearing behind other elements  
- **Confirmation dialogs**: Missing sticky footer patterns

## 🔧 KEY FIXES

### **Dialog Overlay (Fix Transparency)**
```typescript
function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-[9998] bg-[#1C2536]/80 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}
```

### **Dialog Content (Fix Z-Index)**
```typescript
function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-[50%] left-[50%] z-[9999] grid w-full max-w-[calc(100%-2rem)]",
          "translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[4px] border",
          "bg-white shadow-2xl duration-200 sm:max-w-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute top-4 right-4 rounded-[4px] opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none ring-offset-white focus:ring-[#303F9F]">
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
```

### **Dialog Footer (Sticky Footer)**
```typescript
function DialogFooter({ className, sticky = false, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        sticky && "sticky bottom-0 bg-white border-t border-[#E2E6F1] pt-4 mt-6",
        className
      )}
      {...props}
    />
  )
}
```

## 🎨 MODAL EXAMPLES

### **Standard Modal**
```typescript
<Dialog>
  <DialogTrigger asChild>
    <JoveoButton variant="primary">Open Modal</JoveoButton>
  </DialogTrigger>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="text-[20px] font-semibold text-[#3D4759]">
        Modal Title
      </DialogTitle>
      <DialogDescription className="text-[14px] text-[#718096]">
        Modal description goes here.
      </DialogDescription>
    </DialogHeader>
    
    <div className="py-6">
      {/* Modal content */}
    </div>
    
    <DialogFooter sticky>
      <JoveoButton variant="outline">Cancel</JoveoButton>
      <JoveoButton variant="primary">Confirm</JoveoButton>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### **Confirmation Dialog**
```typescript
<Dialog>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="text-[20px] font-semibold text-[#3D4759]">
        Confirm Action
      </DialogTitle>
      <DialogDescription className="text-[14px] text-[#718096]">
        Are you sure you want to proceed? This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    
    <div className="py-6">
      <div className="bg-[#F7FAFC] border border-[#E2E6F1] rounded-[4px] p-4">
        <p className="text-[14px] text-[#3D4759]">
          This will permanently delete the selected items.
        </p>
      </div>
    </div>
    
    <DialogFooter sticky>
      <JoveoButton variant="outline">Cancel</JoveoButton>
      <JoveoButton variant="destructive">Delete</JoveoButton>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### **Large Content Modal**
```typescript
<Dialog>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
    <DialogHeader className="border-b border-[#E2E6F1] pb-4">
      <DialogTitle className="text-[20px] font-semibold text-[#3D4759]">
        Detailed View
      </DialogTitle>
    </DialogHeader>
    
    <div className="overflow-y-auto py-6 max-h-[60vh]">
      {/* Large content with scroll */}
    </div>
    
    <DialogFooter sticky>
      <JoveoButton variant="outline">Close</JoveoButton>
      <JoveoButton variant="primary">Export</JoveoButton>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 🎯 MODAL SIZES
```typescript
// Small: max-w-sm
// Medium: max-w-md (default)
// Large: max-w-lg
// Extra Large: max-w-2xl
// Full Width: max-w-4xl
// Full Screen: max-w-[95vw] max-h-[95vh]
```

## 🔍 QUICK FIXES
- **Modal behind elements**: Use z-[9999] for content, z-[9998] for overlay
- **Transparent background**: Use bg-[#1C2536]/80 with backdrop-blur-sm
- **Footer not sticky**: Add sticky prop to DialogFooter
- **Mobile issues**: Use responsive classes (max-w-[calc(100%-2rem)] sm:max-w-md)

---

**Remember**: Use Joveo design tokens (#1C2536, #303F9F, #3D4759), maintain 4px border radius, and ensure proper z-index stacking.

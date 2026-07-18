# 🚀 Optimize Performance Command

**Command**: `optimize-performance`
**Objective**: Maximize Next.js performance while maintaining system compliance.

---

## 🎯 CRITICAL OPTIMIZATIONS

### **1. Route & Data Prefetching**
- [ ] Add `prefetch={true}` to all navigation `Link` components
- [ ] Implement React Query for data caching and background refresh
- [ ] Use `router.prefetch()` for programmatic prefetching
- [ ] Add stale-while-revalidate patterns for real-time data

### **2. Component Performance**
- [ ] Wrap all metric cards and charts with `React.memo()`
- [ ] Use `next/dynamic` for lazy loading heavy components (charts)
- [ ] Add `useMemo()` for expensive calculations
- [ ] Implement virtual scrolling for large data tables

### **3. Bundle & Asset Optimization**
- [ ] Replace `<img>` with `next/image` and add `priority` flags
- [ ] Analyze bundle with `@next/bundle-analyzer`
- [ ] Tree-shake unused code and optimize Tailwind purging
- [ ] Add WebP images with blur placeholders

### **4. API & Caching**
- [ ] Add `Cache-Control` headers to API routes
- [ ] Implement database connection pooling
- [ ] Use `unstable_cache` for API route caching
- [ ] Add request deduplication and compression middleware

### **5. Error Handling**
- [ ] Add error boundaries for all major component trees
- [ ] Implement retry mechanisms with exponential backoff
- [ ] Add fallback UI for chart rendering failures
- [ ] Create graceful degradation patterns

### **6. Performance Monitoring**
- [ ] Track Core Web Vitals (LCP, FID, CLS)
- [ ] Add Lighthouse CI to build pipeline
- [ ] Monitor API response times and chart rendering
- [ ] Set up performance budgets and alerts

---

## 🚀 IMPLEMENTATION PRIORITY

### **Week 1: Core Optimizations**
1. Component memoization and lazy loading
2. Route prefetching implementation
3. Image optimization
4. Basic error boundaries

### **Week 2: Data & Caching**
1. React Query integration
2. API caching and compression
3. Database optimization
4. Performance monitoring setup

---

## 📊 TARGET METRICS
- **LCP**: < 1.5s | **FID**: < 100ms | **CLS**: < 0.1
- **Bundle Size**: < 300KB gzipped | **API Response**: < 200ms
- **Chart Rendering**: < 500ms | **Page Load**: < 2s on 3G

---

**Priority**: Maintain Joveo design system standards while optimizing for speed and reliability.

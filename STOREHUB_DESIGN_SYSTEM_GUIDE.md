# StoreHub Design System Implementation Guide

## Overview

The StoreHub design system has been successfully integrated into your codebase. This guide explains how to use it and what's been implemented.

## What's Been Implemented

### 1. Core Design System Files

- **`/public/css/storehub-design-system.css`** - The main design system with all design tokens, components, and utilities
- **`/public/css/storehub-global.css`** - Global overrides to unify all styles across the application
- **`/public/css/storehub-dashboard.css`** - Dashboard-specific styles
- **`/public/js/storehub-design-system.js`** - JavaScript for interactive components

### 2. New Page Templates

- **`/views/auth/login-storehub.ejs`** - Modernized login page using the design system
- **`/views/auth/register-storehub.ejs`** - Modernized registration page
- **`/views/backoffice/login-storehub.ejs`** - Backoffice admin login with dark theme
- **`/views/dashboard/index-storehub-new.ejs`** - Complete dashboard redesign

### 3. Updated Layouts

- **Backoffice Layout** - Updated to use the design system
- **Merchant Dashboard** - Updated to use the design system

## How to Use the Design System

### 1. Include the Design System in Your Pages

```html
<!-- StoreHub Design System -->
<link rel="stylesheet" href="/css/storehub-design-system.css?v=<%= Date.now() %>">
<link rel="stylesheet" href="/css/storehub-global.css?v=<%= Date.now() %>">
<script src="/js/storehub-design-system.js?v=<%= Date.now() %>" defer></script>
```

### 2. Use Design Tokens

```css
/* Colors */
var(--primary-orange)    /* #FA8C16 - Main brand color */
var(--primary-hover)     /* #FFA940 - Hover state */
var(--success-green)     /* #52C41A */
var(--error-red)         /* #CF1322 */
var(--gray-900)          /* #262626 - Primary text */
var(--gray-600)          /* #6B6B6B - Secondary text */

/* Spacing (4px grid) */
var(--space-1)  /* 4px */
var(--space-2)  /* 8px */
var(--space-3)  /* 12px */
var(--space-4)  /* 16px */
var(--space-5)  /* 20px */
var(--space-6)  /* 24px */

/* Typography */
var(--heading-1)  /* 32px */
var(--heading-2)  /* 28px */
var(--body)       /* 16px */
var(--small)      /* 14px */
```

### 3. Component Classes

#### Buttons
```html
<!-- Primary Button -->
<button class="btn btn-primary">Click Me</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Small Button -->
<button class="btn btn-primary btn-sm">Small</button>

<!-- Full Width Button -->
<button class="btn btn-primary btn-block">Full Width</button>
```

#### Forms
```html
<div class="form-group">
  <label class="form-label">Email Address</label>
  <input type="email" class="form-control" placeholder="Enter email">
  <span class="form-text">We'll never share your email</span>
</div>
```

#### Cards
```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
  </div>
  <div class="card-body">
    Card content goes here
  </div>
</div>
```

#### Stats Cards
```html
<div class="stats-card">
  <div class="stats-icon">🚀</div>
  <div class="stats-value">1,234</div>
  <div class="stats-label">Total Orders</div>
  <div class="stats-trend trend-positive">
    <span>↑ 12%</span> from last week
  </div>
</div>
```

#### Badges
```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-danger">Danger</span>
```

### 4. JavaScript Features

The design system includes JavaScript for:

- **Toast Notifications**
  ```javascript
  StoreHubDS.showToast('Success message', 'success');
  StoreHubDS.showToast('Error message', 'error');
  ```

- **Modals**
  ```javascript
  const modal = document.getElementById('myModal');
  StoreHubDS.openModal(modal);
  StoreHubDS.closeModal(modal);
  ```

- **Form Validation**
  - Add class `needs-validation` to forms
  - Automatic validation on submit

- **Animations**
  - Add classes: `fade-in`, `slide-up`, `scale-in`

## Migration Guide

### To Update Existing Pages:

1. **Replace CSS imports** with the design system files
2. **Update button classes** from old styles to new `btn btn-primary` format
3. **Update form controls** to use `form-control` class
4. **Replace color values** with design tokens
5. **Test responsiveness** - the design system is mobile-first

### Quick Wins:

1. **Update Authentication Pages**
   - Point login routes to `/views/auth/login-storehub.ejs`
   - Point register routes to `/views/auth/register-storehub.ejs`

2. **Update Backoffice Login**
   - Point backoffice login to `/views/backoffice/login-storehub.ejs`

3. **Try the New Dashboard**
   - Test the new dashboard at `/views/dashboard/index-storehub-new.ejs`

## Best Practices

1. **Always use design tokens** instead of hard-coded values
2. **Follow the spacing system** (4px grid)
3. **Use semantic color names** (primary, success, error)
4. **Test on mobile devices** - the system is mobile-first
5. **Use the provided components** instead of creating custom ones

## Browser Support

The design system supports:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari 12+
- iOS Safari 12+
- Chrome for Android

## Need Help?

- Check the design system documentation in `/storehub-design-system.md`
- Review example implementations in the new template files
- The CSS files are well-commented for reference

## Next Steps

1. **Test the new pages** in your development environment
2. **Gradually migrate** existing pages to use the design system
3. **Create new pages** using the design system from the start
4. **Customize** the design tokens if needed for your brand

The design system provides consistency, better user experience, and faster development. All components follow accessibility best practices and are optimized for performance.
# StoreHub Design System Implementation Guide

## Overview

This guide provides instructions for implementing the StoreHub Design System across the Queue Management System. The design system follows principles of modern minimalism with sophisticated restraint, using the StoreHub brand colors and Open Sans typography.

## Files Created

### CSS Files
1. **`/public/css/storehub-design-system.css`** - Core design system with all components
2. **`/public/css/storehub-header.css`** - Header component styles
3. **`/public/css/storehub-dashboard.css`** - Dashboard page styles
4. **`/public/css/storehub-queue-public.css`** - Customer-facing queue page styles

### JavaScript Files
1. **`/public/js/storehub-design-system.js`** - Dynamic styling and interactions

### View Templates
1. **`/views/partials/header-storehub.ejs`** - New header component
2. **`/views/dashboard/index-storehub.ejs`** - Redesigned dashboard example

## Implementation Steps

### 1. Update Base Layout

In your main layout file (e.g., `layout.ejs`), add the design system CSS and JS:

```html
<!-- StoreHub Design System -->
<link rel="stylesheet" href="/css/storehub-design-system.css?v=<%= Date.now() %>">
<script src="/js/storehub-design-system.js?v=<%= Date.now() %>"></script>
```

### 2. Replace Header Component

Replace the existing header include with the new StoreHub header:

```ejs
<%- include('../partials/header-storehub', { activePage: 'dashboard' }) %>
```

### 3. Update Color Variables

The design system uses CSS custom properties for colors. Key colors:
- Primary Orange: `#FA8C16`
- Success Green: `#52C41A`
- Warning Yellow: `#FADB14`
- Error Red: `#CF1322`
- Info Blue: `#1890FF`

### 4. Typography

The system automatically loads Open Sans font. Apply typography classes:
- `.storehub-page-title` - Page headings
- `.storehub-page-subtitle` - Page descriptions
- `.form-label` - Form labels
- `.btn` - Button text

### 5. Component Classes

#### Buttons
```html
<!-- Primary Button -->
<button class="btn btn-primary">Save Changes</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Text Button -->
<button class="btn btn-text">Learn More</button>

<!-- Button Sizes -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-lg">Large</button>
```

#### Forms
```html
<div class="form-group">
    <label class="form-label required">Customer Name</label>
    <input type="text" class="form-control" required>
    <small class="form-text">Enter the customer's full name</small>
</div>
```

#### Cards
```html
<div class="card">
    <div class="card-header">
        <h3>Card Title</h3>
    </div>
    <div class="card-body">
        Content here
    </div>
</div>
```

#### Tables
```html
<table class="table">
    <thead>
        <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>John Doe</td>
            <td><span class="badge badge-success">Active</span></td>
            <td><button class="btn btn-sm btn-primary">Edit</button></td>
        </tr>
    </tbody>
</table>
```

### 6. Queue-Specific Components

#### Queue Status Badge
```html
<span class="queue-status waiting">Waiting</span>
<span class="queue-status called">Called</span>
<span class="queue-status serving">Serving</span>
```

#### Queue Number Display
```html
<div class="queue-number">A24</div>
```

### 7. Responsive Grid System

```html
<div class="container">
    <div class="storehub-stats-grid">
        <!-- Grid items -->
    </div>
</div>
```

### 8. Toast Notifications

```javascript
// Show success toast
showToast('Changes saved successfully!', 'success');

// Show error toast
showToast('Something went wrong', 'danger');
```

### 9. Modal Dialogs

```html
<!-- Modal HTML -->
<div id="myModal" class="modal" style="display: none;">
    <div class="modal-header">
        <h3>Modal Title</h3>
    </div>
    <div class="modal-body">
        Modal content
    </div>
    <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save</button>
    </div>
</div>

<!-- Open modal -->
<button onclick="openModal('myModal')">Open Modal</button>
```

## Migration Guide

### 1. Update Existing Pages

For each existing page:
1. Add the design system CSS/JS includes
2. Replace Bootstrap classes with StoreHub classes
3. Update color references to use CSS variables
4. Apply new typography classes

### 2. Class Mapping

| Old Class | New Class |
|-----------|-----------|
| `btn-success` | `btn btn-primary` |
| `btn-danger` | `btn btn-secondary` |
| `alert-success` | `alert alert-success` |
| `panel` | `card` |
| `panel-heading` | `card-header` |
| `panel-body` | `card-body` |

### 3. Color Migration

| Old Color | New Variable |
|-----------|--------------|
| `#28a745` | `var(--success-green)` |
| `#dc3545` | `var(--error-red)` |
| `#ffc107` | `var(--warning-yellow)` |
| `#17a2b8` | `var(--info-blue)` |

## Best Practices

1. **Consistency**: Use design system components instead of custom styles
2. **Spacing**: Use spacing variables (`--space-1` through `--space-16`)
3. **Colors**: Always use CSS variables for colors
4. **Typography**: Use predefined font sizes and weights
5. **Shadows**: Use shadow variables for elevation
6. **Transitions**: Use transition variables for animations

## Testing

1. **Browser Support**: Test in Chrome, Firefox, Safari, and Edge
2. **Mobile Responsive**: Test on various screen sizes
3. **Dark Mode**: The system is designed for light mode only
4. **Accessibility**: Ensure proper contrast ratios and keyboard navigation

## Customization

To customize the design system:
1. Override CSS variables in a separate file
2. Add custom utility classes as needed
3. Extend component styles without modifying core files

## Support

For questions or issues with the design system implementation:
1. Check the design system documentation
2. Review the example implementations
3. Test components in isolation first
4. Ensure all dependencies are loaded

## Next Steps

1. Update all dashboard views to use new design system
2. Migrate customer-facing pages
3. Update email templates to match design
4. Create component library documentation
5. Add Storybook for component development
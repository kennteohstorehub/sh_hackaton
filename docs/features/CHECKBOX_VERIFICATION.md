# Checkbox Style Verification Guide

## Issue
The checkbox styles in the Notifications tab of Settings may not be displaying correctly due to CSS caching.

## Fix Applied
Added cache-busting parameter to the CSS link:
```html
<link href="/css/settings.css?v=<%= Date.now() %>" rel="stylesheet">
```

## Manual Verification Steps

1. **Clear Browser Cache**
   - Open Chrome DevTools (F12)
   - Go to Network tab
   - Check "Disable cache" checkbox
   - Keep DevTools open

2. **Login to Application**
   - Go to http://localhost:3000
   - Login with demo@storehub.com / demo123

3. **Navigate to Settings**
   - Click "Settings" in the navigation menu
   - You should see the improved settings page with tabs

4. **Check Notifications Tab**
   - Click on the "Notifications" tab (bell icon)
   - Scroll down to "Smart Notification Features" section

## Expected Result

You should see 3 checkboxes with the new design:

### Feature Checkbox Design
- **Card Layout**: Each checkbox in a card with padding and border
- **Custom Checkbox**: 24x24px square with rounded corners
- **Orange Gradient**: When checked, shows gradient from #ff8c00 to #ff6b35
- **White Checkmark**: Appears when checked
- **Title & Description**: Two-line text layout
- **Hover Effect**: Card lifts slightly with shadow on hover

### Visual Example
```
┌─────────────────────────────────────────────────┐
│ ☑ Adjust timing during peak hours              │
│    Automatically increase notification lead     │
│    time when busy                               │
└─────────────────────────────────────────────────┘
```

## Troubleshooting

### If styles are not showing:

1. **Check CSS Loading**
   - In DevTools > Network tab
   - Look for settings.css request
   - Should have ?v= parameter
   - Status should be 200

2. **Force Refresh**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

3. **Check Console**
   - Look for any CSS loading errors
   - Check for JavaScript errors

4. **Verify HTML Structure**
   - In DevTools > Elements
   - Find a label with class="feature-checkbox"
   - Should contain:
     - input[type="checkbox"]
     - span.checkbox-custom
     - div.feature-content

## CSS Classes Reference

- `.feature-checkbox` - Main container with card design
- `.checkbox-custom` - Custom checkbox visual
- `.feature-content` - Text container
- `.feature-title` - Main checkbox label
- `.feature-description` - Helper text

## Test File
Open `test-checkbox-direct.html` in a browser to see the expected design in isolation.

## Deployment
The fix has been pushed to GitHub and will be deployed to Render automatically.
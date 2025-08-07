# Generic StoreHub Design System

**Purpose:** Comprehensive design system for consistent brand identity across all projects  
**Design Philosophy:** Modern minimalism with sophisticated restraint

---

## Table of Contents
1. [Design Principles](#1-design-principles)
2. [Foundations](#2-foundations)
3. [Component Library](#3-component-library)
4. [Layout Systems](#4-layout-systems)
5. [Platform Guidelines](#5-platform-guidelines)
6. [Implementation Guide](#6-implementation-guide)

---

## 1. Design Principles

### Core Philosophy
Combining modern design principles with refined aesthetics:

- **Space & Clarity**: Generous use of whitespace for breathing room
- **Simplicity**: Beauty in minimalism and purposeful design
- **Sophistication**: Refined aesthetics with subtle details
- **Consistency**: Unified patterns throughout the interface

### Design Values
1. **Clarity First**: Clear information hierarchy
2. **Respectful Density**: Compact but not cluttered
3. **Subtle Sophistication**: Minimal animations and gentle transitions
4. **Authentic Experience**: Appropriate visual language for the context

---

## 2. Foundations

### 2.1 Color Palette

#### Primary Colors
```scss
// Brand Colors
$primary-orange: #FA8C16;      // Main brand color
$primary-hover: #FFA940;       // Lighter orange for hover states
$primary-pressed: #D46B08;     // Darker orange for pressed states

// Base Colors
$base-black: #1C1C1C;          // Deep black
$base-white: #FFFFFC;          // Soft warm white
$base-gray: #828282;           // Neutral gray
```

#### Semantic Colors
```scss
// Status Colors
$success-green: #52C41A;       // Success/Available
$warning-yellow: #FADB14;      // Warning
$error-red: #CF1322;           // Error
$info-blue: #1890FF;           // Information

// Category Colors (Flexible Use)
$category-blue: #4A90E2;       // Category 1
$category-green: #7ED321;      // Category 2
$category-purple: #BD10E0;     // Category 3

// Type Colors (Muted Palette)
$type-brown: #8B7355;          // Type A
$type-orange: #E17B47;         // Type B
$type-teal: #00A0B0;           // Type C
$type-pink: #CC527A;           // Type D
$type-silver: #A8A7A7;         // Type E/Other
```

#### Grayscale
```scss
$gray-900: #262626;   // Primary text
$gray-800: #434343;   // Secondary text
$gray-700: #595959;   // Tertiary text
$gray-600: #6B6B6B;   // Disabled text
$gray-500: #8C8C8C;   // Placeholder text
$gray-400: #BFBFBF;   // Borders
$gray-300: #D9D9D9;   // Dividers
$gray-200: #F0F0F0;   // Background accents
$gray-100: #FAFAFA;   // Light backgrounds
```

### 2.2 Typography

#### Font Families
```scss
// Primary Font Stack
$font-primary: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'SF Mono', 'Consolas', monospace; // For numbers/codes

// Font Weights
$weight-regular: 400;
$weight-medium: 500;
$weight-semibold: 600;
$weight-bold: 700;
```

#### Type Scale

**Mobile/Tablet**
```scss
$heading-1: 28px;   // Page titles
$heading-2: 24px;   // Section headers
$heading-3: 20px;   // Subsections
$body-large: 18px;  // Emphasized body
$body: 16px;        // Regular body
$small: 14px;       // Secondary text
$tiny: 12px;        // Captions
```

**Desktop/Web**
```scss
$heading-1: 32px;
$heading-2: 28px;
$heading-3: 24px;
$heading-4: 20px;
$body-large: 18px;
$body: 16px;
$small: 14px;
$tiny: 12px;
```

### 2.3 Spacing System

Based on 4px grid system:
```scss
$spacing-unit: 4px;

$space-0: 0;                    // 0
$space-1: $spacing-unit;        // 4px
$space-2: $spacing-unit * 2;    // 8px
$space-3: $spacing-unit * 3;    // 12px
$space-4: $spacing-unit * 4;    // 16px
$space-5: $spacing-unit * 5;    // 20px
$space-6: $spacing-unit * 6;    // 24px
$space-8: $spacing-unit * 8;    // 32px
$space-10: $spacing-unit * 10;  // 40px
$space-12: $spacing-unit * 12;  // 48px
$space-16: $spacing-unit * 16;  // 64px
```

### 2.4 Shadows & Elevations

Subtle shadows for depth:
```scss
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$shadow-md: 0 2px 4px rgba(0, 0, 0, 0.08);
$shadow-lg: 0 4px 8px rgba(0, 0, 0, 0.10);
$shadow-xl: 0 8px 16px rgba(0, 0, 0, 0.12);
```

### 2.5 Border Radius

Soft corners for modern feel:
```scss
$radius-sm: 4px;
$radius-md: 8px;
$radius-lg: 12px;
$radius-xl: 16px;
$radius-full: 9999px;
```

---

## 3. Component Library

### 3.1 Buttons

#### Primary Button
```typescript
interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
}
```

**Specifications:**
- Heights: Small: 36px, Medium: 44px, Large: 52px
- Min width: 120px (unless fullWidth)
- Padding: Horizontal 24px
- Font: Weight 500, sizes: S:14px, M:16px, L:18px
- Border radius: 8px

**States:**
| State | Background | Text | Border | Shadow |
|:------|:-----------|:-----|:-------|:-------|
| Default | $primary-orange | White | None | $shadow-sm |
| Hover | $primary-hover | White | None | $shadow-md |
| Pressed | $primary-pressed | White | None | None |
| Disabled | $gray-300 | $gray-600 | None | None |
| Loading | $primary-orange | Transparent | None | $shadow-sm |

#### Secondary Button
- Same dimensions as Primary
- Background: White
- Border: 1px solid $primary-orange
- Text: $primary-orange

#### Text Button
- No background or border
- Text: $primary-orange
- Underline on hover
- Min touch target: 44x44px

### 3.2 Form Controls

#### Input Field
```typescript
interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  type?: 'text' | 'email' | 'tel' | 'number' | 'password';
}
```

**Specifications:**
- Height: 44px (mobile/tablet), 40px (desktop)
- Border: 1px solid $gray-400
- Border radius: 4px
- Padding: 12px
- Focus border: $primary-orange
- Error border: $error-red

**Standard Input Layout:**
```
Label
┌─────────────────────────┐
│ Input text              │
└─────────────────────────┘
Helper text
```

#### Select Dropdown
- Custom styled
- Chevron icon on right
- Same height as input fields
- Options panel with subtle shadow

#### Date/Time Picker
- Standard calendar layout
- Time in 12/24-hour format
- 15-minute increments available

### 3.3 Data Display

#### Tables

**Standard Style:**
- Row height: 36px (compact), 44px (comfortable)
- Alternating row colors: White / $gray-100
- Sticky header with $gray-200 background
- Font size: 14px

**Example Structure:**
```
┌────────┬──────────┬──────────┬──────────┐
│ Time   │ Column A │ Column B │ Column C │ <- Sticky header
├────────┼──────────┼──────────┼──────────┤
│ 9:00   │ Data     │   --     │ Data     │
├────────┼──────────┼──────────┼──────────┤
│ 9:15   │ Data     │   Data   │ --       │
└────────┴──────────┴──────────┴──────────┘
```

#### Cards
- Background: White
- Border: 1px solid $gray-300
- Border radius: 8px
- Padding: 16px
- Shadow: $shadow-sm
- Hover shadow: $shadow-md

### 3.4 Timeline Components

#### Horizontal Timeline View:
```
        9:00   9:15   9:30   9:45   10:00  10:15
Available  2      1      3      0      2      1    <- Capacity row
────────────────────────────────────────────────
Row 1   │█████████│         │██████████████│    <- Data rows
Row 2   │         │█████████│              │
Row 3   │    │████████│     │█████████│    │
```

**Visual Specifications:**
- Time column width: 60px per 15 minutes
- Row height: 60px
- Capacity indicators:
  - High (>2): $success-green
  - Medium (1-2): $warning-yellow  
  - None (0): $error-red
- Content blocks:
  - Border radius: 4px
  - Border: 2px solid based on category
  - Type indicator: 4px colored bar on left

**Content Block Design:**
```
┌─┬─────────────────┐
│█│ Title           │
│█│ Subtitle        │
│█│ 09:00-10:00    │
└─┴─────────────────┘
  ^-- Type color bar
```

### 3.5 Navigation

#### Bottom Navigation (Mobile/Tablet)
- Height: 56px
- Background: White with top border
- Active tab: $primary-orange text and icon
- Icons: 24x24px
- Labels: 12px below icons

#### Sidebar (Desktop)
- Width: 240px expanded, 64px collapsed
- Background: $base-black
- Active item: $primary-orange background
- Icons: 20x20px
- Hover: Subtle background change

### 3.6 Feedback Components

#### Toast Notifications
- Position: Top center (mobile), Top right (desktop)
- Max width: 400px
- Auto-dismiss: 4 seconds
- Colors based on type (success/warning/error/info)
- Slide in/out animation

#### Loading States
- Spinner: 24px, $primary-orange
- Skeleton screens: Animated $gray-200 blocks
- Progress bars: 4px height, rounded

---

## 4. Layout Systems

### 4.1 Grid System

**Tablet (1024px width):**
- 12 column grid
- Gutter: 16px
- Margin: 24px

**Desktop:**
- Container max-width: 1440px
- 12 column grid
- Gutter: 24px
- Margin: 32px

### 4.2 Breakpoints

```scss
$breakpoint-mobile: 375px;
$breakpoint-tablet-portrait: 768px;
$breakpoint-tablet-landscape: 1024px;
$breakpoint-desktop: 1280px;
$breakpoint-wide: 1440px;
```

### 4.3 Layout Patterns

#### Split View (Tablet/Desktop)
- Left panel: 320px (navigation/list)
- Right panel: Remaining space (main content)
- Resizable divider option

#### Master-Detail (Desktop)
- Master: 25% width (min 280px)
- Detail: 75% width
- Collapsible master on smaller screens

---

## 5. Platform Guidelines

### 5.1 Mobile/Tablet (React Native)

#### Touch Targets
- Minimum: 44x44px
- Preferred: 48x48px for primary actions
- Spacing between targets: Minimum 8px

#### Gestures
- Swipe right: Navigate back
- Swipe left on items: Show actions
- Pinch: Zoom content
- Long press: Context menu
- Pull to refresh: Update data

#### Animations
```javascript
// Standard animation config
const animationConfig = {
  duration: 250,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// Micro-interactions
const buttonPress = {
  scale: 0.97,
  duration: 100,
};
```

### 5.2 Web (React/Next.js)

#### Interactions
- Hover states on all interactive elements
- Focus indicators for keyboard navigation
- Smooth transitions (250ms default)

#### Drag and Drop
- Visual feedback: Opacity 0.5 while dragging
- Drop zones: Highlight with dashed border
- Invalid drops: Red tint overlay

#### Keyboard Shortcuts
- `Cmd/Ctrl + S`: Save
- `Cmd/Ctrl + N`: New item
- `Esc`: Close modal
- Arrow keys: Navigate items

---

## 6. Implementation Guide

### 6.1 Design Tokens

Create a shared tokens file:
```typescript
// design-tokens.ts
export const tokens = {
  colors: {
    primary: {
      main: '#FA8C16',
      hover: '#FFA940',
      pressed: '#D46B08',
    },
    semantic: {
      success: '#52C41A',
      warning: '#FADB14',
      error: '#CF1322',
      info: '#1890FF',
    },
    category: {
      blue: '#4A90E2',
      green: '#7ED321',
      purple: '#BD10E0',
    },
    type: {
      brown: '#8B7355',
      orange: '#E17B47',
      teal: '#00A0B0',
      pink: '#CC527A',
      silver: '#A8A7A7',
    },
    gray: {
      900: '#262626',
      800: '#434343',
      700: '#595959',
      600: '#6B6B6B',
      500: '#8C8C8C',
      400: '#BFBFBF',
      300: '#D9D9D9',
      200: '#F0F0F0',
      100: '#FAFAFA',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontFamily: {
      primary: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'SF Mono', 'Consolas', monospace",
    },
    fontSize: {
      h1: 32,
      h2: 28,
      h3: 24,
      h4: 20,
      bodyLarge: 18,
      body: 16,
      small: 14,
      tiny: 12,
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 4px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.10)',
    xl: '0 8px 16px rgba(0, 0, 0, 0.12)',
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
};
```

### 6.2 Component Structure

Example component structure:
```typescript
// PrimaryButton.tsx
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import styled from 'styled-components/native';
import { tokens } from '../design-tokens';

interface Props {
  title: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const StyledButton = styled(TouchableOpacity)<{ 
  size: string; 
  disabled: boolean; 
  fullWidth: boolean;
}>`
  background-color: ${props => 
    props.disabled ? tokens.colors.gray[300] : tokens.colors.primary.main};
  padding: ${tokens.spacing.md}px ${tokens.spacing.lg}px;
  border-radius: ${tokens.borderRadius.md}px;
  min-width: ${props => props.fullWidth ? 'auto' : '120px'};
  height: ${props => {
    switch(props.size) {
      case 'small': return '36px';
      case 'large': return '52px';
      default: return '44px';
    }
  }};
  justify-content: center;
  align-items: center;
  shadow-color: #000;
  shadow-offset: 0px 1px;
  shadow-opacity: 0.05;
  shadow-radius: 2px;
  elevation: 1;
`;

const ButtonText = styled(Text)<{ size: string; disabled: boolean }>`
  color: ${props => props.disabled ? tokens.colors.gray[600] : 'white'};
  font-family: ${tokens.typography.fontFamily.primary};
  font-weight: ${tokens.typography.fontWeight.medium};
  font-size: ${props => {
    switch(props.size) {
      case 'small': return `${tokens.typography.fontSize.small}px`;
      case 'large': return `${tokens.typography.fontSize.bodyLarge}px`;
      default: return `${tokens.typography.fontSize.body}px`;
    }
  }};
`;

export const PrimaryButton: React.FC<Props> = ({ 
  title, 
  onPress, 
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
}) => {
  return (
    <StyledButton 
      onPress={onPress}
      disabled={disabled || loading}
      size={size}
      fullWidth={fullWidth}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <ButtonText size={size} disabled={disabled}>
          {title}
        </ButtonText>
      )}
    </StyledButton>
  );
};
```

### 6.3 Testing Checklist

Before implementing any component:
- [ ] Meets minimum touch target size (44px)
- [ ] Has all required states (default, hover, pressed, disabled)
- [ ] Follows typography guidelines
- [ ] Works with standard input methods
- [ ] Accessible with screen readers
- [ ] Performs well with large datasets
- [ ] Handles edge cases gracefully

### 6.4 Accessibility Guidelines

1. **Color Contrast**: Minimum 4.5:1 for normal text
2. **Touch Targets**: 44x44px minimum
3. **Focus Indicators**: Visible keyboard navigation
4. **Screen Reader**: Proper labels and descriptions
5. **Motion**: Respect reduced motion preferences

---

## Appendix: Quick Reference

### Icon Set Recommendation
Use **Ionicons** or **Feather Icons** as the primary icon library:
- Navigation: Standard icon set
- Status indicators: Colored variations
- Actions: Consistent 20px/24px sizing

### Animation Presets
```javascript
export const animations = {
  // Page transitions
  pageEnter: {
    from: { opacity: 0, translateX: 20 },
    to: { opacity: 1, translateX: 0 },
    duration: 250,
  },
  
  // Modal appearance
  modalIn: {
    from: { opacity: 0, scale: 0.95 },
    to: { opacity: 1, scale: 1 },
    duration: 200,
  },
  
  // List item stagger
  listStagger: {
    delay: 50, // ms between items
    duration: 200,
  },
  
  // Fade
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: 150,
  },
};
```

### Component Naming Convention
- Component names: `PrimaryButton`, `DataTable`, `NavigationBar`
- Props in camelCase: `onPress`, `isLoading`, `fullWidth`
- CSS classes: `btn-primary`, `table-compact`
- Design tokens: `colors.primary.main`, `spacing.md`

### Status Messages
```javascript
const statusMessages = {
  saving: 'Saving...',
  saved: 'Saved successfully',
  loading: 'Loading...',
  error: 'An error occurred',
  offline: 'You are offline',
  syncing: 'Syncing...',
  synced: 'Sync complete',
};
```

---

This design system provides a comprehensive foundation for building consistent, modern interfaces with a sophisticated aesthetic. The system ensures visual consistency across all platforms while maintaining flexibility for different use cases.
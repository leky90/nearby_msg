# Data Model: Vietnamese Localization & UI/UX Optimization

**Feature**: 002-vi-localization-uiux  
**Date**: 2025-01-27

## Overview

This feature is UI-only and does not introduce new data entities or modify existing data structures. However, we document the translation key structure and design token structure for implementation reference.

## Translation Key Structure

### Entity: TranslationKey

**Purpose**: String identifier for Vietnamese translations

**Structure**:

```
<category>.<subcategory>.<key>
```

**Examples**:

- `sos.medical` → "Cấp cứu Y tế"
- `status.safe` → "Tôi an toàn"
- `group.type.neighborhood` → "Khu dân cư"
- `button.send` → "Gửi"
- `message.input.placeholder` → "Nhập tin nhắn..."

**Categories**:

- `sos`: SOS message types
- `status`: Safety status types
- `group`: Group-related text
- `button`: Button labels
- `message`: Message-related text
- `form`: Form labels and placeholders
- `error`: Error messages
- `success`: Success messages
- `network`: Network status messages
- `common`: Common UI text (Cancel, Confirm, etc.)

**Validation Rules**:

- Keys must be unique within their category
- Keys should be descriptive (not abbreviations)
- Keys follow dot notation for hierarchy

**Storage**: TypeScript object in `lib/i18n.ts`

---

## Design Token Structure

### Entity: ColorToken

**Purpose**: CSS custom property for semantic colors

**Structure**:

```css
--<semantic-name>-color: <color-value>;
```

**Semantic Colors**:

- `--sos-color`: Red/orange for SOS and critical situations (#EF4444)
- `--safety-color`: Green for safe status (#16A34A)
- `--warning-color`: Orange/yellow for warnings (#EA580C)
- `--info-color`: Blue for information/primary actions (#2563EB)
- `--muted-color`: Gray for offline/muted states (#64748B)

**Neutral Colors** (existing, documented for reference):

- `--background`: White (#FFFFFF)
- `--foreground`: Dark text (#0F172A)
- `--card`: Light gray for cards (#F8FAFC)
- `--border`: Light border (#E2E8F0)

**Storage**: CSS custom properties in `index.css`

---

### Entity: TypographyScale

**Purpose**: Font size and weight definitions

**Structure**:

```typescript
{
  body: { size: '16pt', lineHeight: '1.5', weight: '400' },
  heading1: { size: '24pt', lineHeight: '1.2', weight: '700' },
  heading2: { size: '20pt', lineHeight: '1.3', weight: '700' },
  caption: { size: '13pt', lineHeight: '1.4', weight: '500' },
}
```

**Scale**:

- **Body**: 16pt minimum (21.33px) - Regular weight
- **Heading 1**: 24pt+ (32px+) - Bold weight
- **Heading 2**: 20pt+ (26.67px+) - Bold weight
- **Caption/Label**: 13pt minimum (17.33px) - Medium weight

**Validation Rules**:

- Body text must be ≥16pt
- Headings must be ≥20pt
- No text smaller than 13pt
- Font weights: Regular (400), Medium (500), Bold (700)
- Avoid Thin/Light weights (<300)

**Storage**: Tailwind config extension + CSS

---

### Entity: SpacingScale

**Purpose**: Touch target and spacing definitions

**Structure**:

- **Touch Target Minimum**: 48px (h-12 in Tailwind)
- **Button Spacing**: 8-12px (gap-2 to gap-3 in Tailwind)
- **Card Padding**: Reduced from p-6 to p-4 for mobile

**Validation Rules**:

- All interactive elements ≥48px height
- Spacing between buttons ≥8px
- Cards maintain minimum 48px height for tap targets

**Storage**: Tailwind utilities + component defaults

---

## Component Variant Structure

### Entity: ComponentVariant

**Purpose**: Extended variants for Shadcn/UI components

**Button Variants**:

- `default`: Primary actions (blue)
- `destructive`: SOS actions (red/orange)
- `outline`: Secondary actions
- `ghost`: Icon buttons
- `sos`: NEW - SOS button with pulse animation (red/orange, rounded-full)

**Button Sizes**:

- `default`: h-12 (48px) - UPDATED from h-9
- `sm`: h-10 (40px) - for less important actions
- `lg`: h-14 (56px) - for very important actions
- `icon`: size-12 (48px) - for icon-only buttons

**Badge Variants**:

- `default`: Primary badge
- `secondary`: Secondary badge
- `destructive`: Error/danger badge
- `outline`: Outlined badge
- `sos`: NEW - Red badge for SOS
- `safe`: NEW - Green badge for safe status
- `neighborhood`: NEW - Blue badge for neighborhood type

**Badge Style**:

- `rounded-full`: UPDATED from rounded-md

**Card Variants**:

- Default padding: p-4 (UPDATED from p-6)
- Border: Reduced opacity
- Shadow: shadow-sm

---

## Relationships

### TranslationKey → Component

- Many-to-many: One translation key can be used in multiple components
- One component can use multiple translation keys

### ColorToken → Component Variant

- One-to-many: One color token can be used in multiple variants
- Variants reference color tokens via CSS variables

### TypographyScale → Component

- One-to-many: Typography scale applies to all text in components
- Components use Tailwind typography utilities

---

## State Transitions

### Translation Loading

```
Initial State → Load translations → Ready State
```

### Color Theme

```
Light Mode → (User preference) → Dark Mode
```

### Network Status

```
Online → Syncing → Offline → Online
```

---

## Validation Rules

### Translation Keys

- Must be defined before use
- Must have Vietnamese value
- Keys should be descriptive

### Color Tokens

- Must meet WCAG AAA contrast ratio (7:1 for normal text, 4.5:1 for large text)
- SOS color must have highest contrast on white background
- All semantic colors must be distinguishable

### Typography

- Body text ≥16pt
- Headings ≥20pt
- No text <13pt
- Font weights: 400, 500, 700 only

### Touch Targets

- All interactive elements ≥48px height
- Spacing between elements ≥8px
- Cards maintain minimum 48px height

---

## Implementation Notes

1. **Translation Keys**: Organized by feature/component for easy maintenance
2. **Color Tokens**: Defined in CSS, referenced via Tailwind utilities
3. **Typography**: Tailwind config extension, applied via utility classes
4. **Component Variants**: Extended via existing variant systems (tailwind-variants, CVA)
5. **No Database Changes**: All changes are frontend-only, no backend modifications needed

---

## Migration Considerations

### Existing Components

- Components using English text → Update to use translation keys
- Components using default button size → Will automatically get h-12
- Components using default badge style → Will automatically get rounded-full
- Components using default card padding → Will automatically get p-4

### Breaking Changes

- None: All changes are additive or default updates
- Existing code continues to work
- New variants are optional

### Rollback Strategy

- Revert translation file changes
- Revert CSS custom property changes
- Revert Tailwind config changes
- Revert component variant changes

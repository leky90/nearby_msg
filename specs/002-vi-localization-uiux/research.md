# Research: Vietnamese Localization & UI/UX Optimization

**Feature**: 002-vi-localization-uiux  
**Date**: 2025-01-27  
**Status**: Complete

## Research Questions

### 1. Translation Strategy for Single Language

**Question**: How should we implement Vietnamese translations in a React app that only needs one language?

**Research**:

- Options: i18n library (react-i18next, react-intl), inline objects, constants file
- Current codebase: No existing i18n setup
- Requirements: Single language (Vietnamese), simple text replacement

**Decision**: Use inline translation objects organized by feature/component

**Rationale**:

- No need for i18n library overhead (pluralization, interpolation, etc.)
- Simple key-value mapping is sufficient
- Easy to maintain and review
- No additional dependencies
- Can be extracted to separate file later if needed

**Alternatives Considered**:

- **react-i18next**: Overkill for single language, adds bundle size
- **react-intl**: Similar overhead, more complex setup
- **Constants file**: Good option, but inline objects are more discoverable during development

**Implementation**:

```typescript
// lib/i18n.ts
export const translations = {
  sos: {
    medical: "Cấp cứu Y tế",
    flood: "Cấp cứu Lũ lụt",
    fire: "Cấp cứu Hỏa hoạn",
    missingPerson: "Người mất tích",
  },
  status: {
    safe: "Tôi an toàn",
    needHelp: "Cần hỗ trợ",
    cannotContact: "Không thể liên lạc",
  },
  // ... more translations
};
```

---

### 2. Color System Implementation with Tailwind CSS v4 and Shadcn/UI

**Question**: How to implement semantic color system (SOS red, Safety green, Warning orange) using Tailwind CSS v4's `@theme inline` directive and Shadcn/UI's CSS variable approach?

**Research**:

- **Tailwind CSS v4**: Uses `@theme inline` directive in CSS instead of `tailwind.config.ts` for theme customization
- **Shadcn/UI pattern**:
  - CSS variables defined in `:root` and `.dark` (OKLCH format)
  - `@theme inline` maps these to Tailwind utilities via `--color-*` pattern
  - Example: `--color-primary: var(--primary)` in `@theme inline` enables `bg-primary` utility
- **Current setup**:
  - Tailwind CSS v4.1.17 with `@tailwindcss/vite`
  - `@theme inline` already configured in `index.css`
  - Colors use OKLCH color space for better color accuracy

**Decision**: Add semantic colors to both `:root` (CSS variables) and `@theme inline` (Tailwind utilities)

**Rationale**:

- Follows Tailwind CSS v4 best practices (`@theme inline` instead of config file)
- Maintains consistency with existing Shadcn/UI approach
- CSS variables in `:root` allow runtime updates and dark mode overrides
- `@theme inline` makes colors available as Tailwind utilities (e.g., `bg-sos`, `text-safety`)
- Works seamlessly with existing Shadcn/UI color system

**Alternatives Considered**:

- **tailwind.config.ts only**: Tailwind CSS v4 prefers `@theme inline` for theme customization
- **CSS variables only**: Wouldn't be available as Tailwind utilities
- **Inline styles**: Not maintainable, breaks design system

**Implementation**:

```css
/* In @theme inline block */
@theme inline {
  /* Existing color mappings... */

  /* Semantic colors for emergency app */
  --color-sos: var(--sos);
  --color-safety: var(--safety);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-muted-semantic: var(--muted-semantic);
}

/* In :root block */
:root {
  /* Existing colors... */

  /* Semantic colors for emergency app */
  --sos: oklch(0.577 0.245 27.325); /* Red-500 #EF4444 */
  --safety: oklch(0.5 0.15 145); /* Green-600 #16A34A */
  --warning: oklch(0.6 0.15 50); /* Orange-600 #EA580C */
  --info: oklch(0.5 0.15 250); /* Blue-600 #2563EB */
  --muted-semantic: oklch(0.556 0 0); /* Slate-500 #64748B */
}

/* In .dark block (for dark mode support) */
.dark {
  /* Existing dark mode colors... */

  /* Semantic colors for dark mode (if needed) */
  --sos: oklch(0.65 0.25 27.325); /* Lighter red for dark mode */
  --safety: oklch(0.55 0.15 145); /* Adjusted green for dark mode */
  /* ... other semantic colors */
}
```

**How it works**:

- Tailwind CSS v4 **automatically generates utilities** from `@theme inline` tokens
- `--color-*` tokens automatically create color utilities for all color-related classes
- **No `@layer utilities` needed** - Tailwind handles this automatically
- Pattern: `--color-sos` → automatically creates `bg-sos`, `text-sos`, `border-sos`, `ring-sos`, etc.

**Usage in Tailwind utilities** (automatically generated):

- `bg-sos`, `text-sos`, `border-sos`, `ring-sos` (from `--color-sos`)
- `bg-safety`, `text-safety`, `border-safety` (from `--color-safety`)
- `bg-warning`, `text-warning`, `border-warning` (from `--color-warning`)
- `bg-info`, `text-info`, `border-info` (from `--color-info`)

**Key Point**: In Tailwind CSS v4, you **don't need** to manually create utilities. Just define tokens in `@theme inline` and Tailwind automatically generates all related utility classes.

---

### 3. Typography Scale for Accessibility

**Question**: How to implement large, readable typography (16pt minimum, 20pt+ headings) using Tailwind CSS v4?

**Research**:

- **Tailwind CSS v4**: Uses `@theme inline` for typography customization instead of `tailwind.config.ts`
- Tailwind default: 14px base, 16px for `text-base`
- Need: 16pt (21.33px) minimum for body, 20pt+ (26.67px+) for headings
- Current setup: Uses Tailwind typography utilities

**Decision**: Add custom font sizes to `@theme inline` directive

**Rationale**:

- Follows Tailwind CSS v4 best practices (`@theme inline` instead of config file)
- Maintains Tailwind utility class approach
- Easy to apply consistently across components
- Works with existing responsive design

**Alternatives Considered**:

- **tailwind.config.ts**: Tailwind CSS v4 prefers `@theme inline` for theme customization
- **CSS-only**: Less maintainable, harder to apply consistently
- **Inline styles**: Not scalable, breaks design system

**Implementation**:

```css
/* In @theme inline block */
@theme inline {
  /* Existing theme tokens... */

  /* Typography scale for accessibility */
  /* Tailwind v4 automatically generates utilities from these tokens */
  --font-size-body: 16pt;
  --font-size-heading-1: 24pt;
  --font-size-heading-2: 20pt;
  --font-size-caption: 13pt;

  /* Line heights */
  --line-height-body: 1.5;
  --line-height-heading-1: 1.2;
  --line-height-heading-2: 1.3;
  --line-height-caption: 1.4;
}
```

**How it works**:

- Tailwind CSS v4 **automatically generates utilities** from `@theme inline` tokens
- `--font-size-*` tokens automatically create `text-*` utilities
- `--line-height-*` tokens automatically create `leading-*` utilities
- **No `@layer utilities` needed** - Tailwind handles this automatically

**Usage in Tailwind utilities** (automatically generated):

- `text-body` (16pt) - automatically generated from `--font-size-body`
- `text-heading-1` (24pt) - automatically generated from `--font-size-heading-1`
- `text-heading-2` (20pt) - automatically generated from `--font-size-heading-2`
- `text-caption` (13pt) - automatically generated from `--font-size-caption`
- `leading-body` (1.5) - automatically generated from `--line-height-body`

**Note**: Tailwind CSS v4's automatic utility generation means you don't need to manually create utilities with `@layer`. Just define the tokens in `@theme inline` and Tailwind creates the classes automatically.

---

### 4. Component Customization Strategy

**Question**: How to customize Shadcn/UI components (Button, Badge, Card) without breaking existing code?

**Research**:

- Shadcn/UI components are copied into project (not installed as package)
- Components use `tailwind-variants` or `class-variance-authority` for variants
- Current Button: Uses `tailwind-variants`, has variants (default, destructive, outline, etc.)
- Current Badge: Uses `class-variance-authority`, has variants (default, secondary, destructive, outline)

**Decision**: Extend existing components with new variants and update default styles

**Rationale**:

- Maintains component API compatibility
- Follows Shadcn/UI patterns (variants system)
- Easy to apply selectively
- No breaking changes to existing code

**Alternatives Considered**:

- **Replace components**: Breaks existing code, high risk
- **Wrapper components**: Adds complexity, harder to maintain
- **CSS-only overrides**: Less maintainable, harder to apply consistently

**Implementation**:

```typescript
// Button: Add 'sos' variant, increase default size
buttonVariants({
  variants: {
    variant: {
      // ... existing variants
      sos: "bg-[--sos-color] text-white rounded-full shadow-lg animate-pulse",
    },
    size: {
      // Update default to h-12 (48px)
      default: "h-12 px-4 py-2", // was h-9
      // ... other sizes
    },
  },
});

// Badge: Add semantic variants, make rounded-full
badgeVariants({
  base: "rounded-full", // was rounded-md
  variants: {
    variant: {
      // ... existing variants
      sos: "bg-red-100 text-red-800",
      safe: "bg-green-100 text-green-800",
      neighborhood: "bg-blue-100 text-blue-800",
    },
  },
});
```

---

### 5. Touch Target Sizing

**Question**: How to ensure all interactive elements meet 48px minimum touch target size?

**Research**:

- Current Button default: `h-9` (36px) - too small
- Need: Minimum 48px (h-12 in Tailwind)
- Important buttons: SOS, Send message, Update status
- Cards: Should also be tappable with 48px minimum height

**Decision**: Update default button size to `h-12` and ensure cards meet minimum height

**Rationale**:

- Tailwind utilities (`h-12` = 48px) are consistent and maintainable
- Can override for specific cases if needed
- Works with existing responsive design
- Easy to verify in code

**Alternatives Considered**:

- **CSS-only**: Less discoverable, harder to maintain
- **Inline styles**: Not scalable
- **Separate utility classes**: Unnecessary complexity

**Implementation**:

- Update Button default size from `h-9` to `h-12`
- Add minimum height to Card components
- Ensure spacing between buttons is 8-12px (gap-2 to gap-3)

---

### 6. Skeleton Loading Implementation

**Question**: How to implement skeleton loading that matches component layouts?

**Research**:

- Current codebase: Has Skeleton component from Shadcn/UI
- Need: Layout-specific skeletons (GroupCard skeleton, MessageList skeleton)
- Pattern: Match the structure of actual components

**Decision**: Create skeleton variants that match component layouts

**Rationale**:

- Reuses existing Skeleton component
- Easy to maintain (update skeleton when component changes)
- Consistent with Shadcn/UI patterns
- No new dependencies

**Alternatives Considered**:

- **New component**: Unnecessary, Skeleton is sufficient
- **Spinner**: Doesn't show content structure, worse UX
- **Placeholder components**: More complex, harder to maintain

**Implementation**:

```typescript
// GroupCard skeleton
<div className="space-y-2">
  <Skeleton className="h-6 w-3/4" />  // Group name
  <Skeleton className="h-4 w-1/2" />  // Distance
  <Skeleton className="h-4 w-2/3" />  // Status
</div>
```

---

### 7. Toast/Sonner Configuration

**Question**: How to configure Sonner to display at top center with 5-7 second duration?

**Research**:

- Current: Sonner 2.0.7 installed, Toaster component exists
- Sonner API: `position` prop (top-center, bottom-center, etc.), `duration` prop
- Current config: Uses default position and duration

**Decision**: Update Toaster component with `position="top-center"` and `duration={6000}`

**Rationale**:

- Simple configuration change
- No code changes needed elsewhere
- Sonner API supports both requirements
- Maintains existing toast usage

**Alternatives Considered**:

- **Custom toast component**: Unnecessary, Sonner is sufficient
- **CSS-only positioning**: Less reliable, harder to maintain
- **Different library**: No need, Sonner works well

**Implementation**:

```typescript
<Sonner
  position="top-center"
  duration={6000}
  // ... existing props
/>
```

---

### 8. Network Status Banner Implementation

**Question**: How to implement network status as banner below header instead of small icon?

**Research**:

- Current: ConnectivityStatus component exists (likely small icon)
- Need: Full-width banner below header
- Pattern: Should be visible but not intrusive

**Decision**: Create new NetworkBanner component or extend ConnectivityStatus

**Rationale**:

- Banner is more visible in emergency situations
- Easy to implement with existing components (Alert or Card)
- Can reuse existing network status logic
- Maintains component separation

**Alternatives Considered**:

- **Modify existing component**: Might break existing usage
- **CSS-only**: Less maintainable
- **Separate component**: Better separation of concerns

**Implementation**:

- Create `NetworkBanner` component using Alert or Card
- Place below header in layout
- Use semantic colors (green for online, yellow for syncing, gray for offline)

---

## Understanding @theme inline in Tailwind CSS v4

### How @theme inline Works

**Key Concept**: Tailwind CSS v4 uses `@theme inline` to automatically generate utility classes from CSS custom properties. You **don't need** to manually create utilities with `@layer utilities` anymore.

**Automatic Utility Generation**:

1. **Color Tokens**: 
   - Define `--color-*` in `@theme inline` → Tailwind automatically creates `bg-*`, `text-*`, `border-*`, `ring-*`, etc.
   - Example: `--color-sos: var(--sos)` → automatically creates `bg-sos`, `text-sos`, `border-sos`

2. **Font Size Tokens**:
   - Define `--font-size-*` in `@theme inline` → Tailwind automatically creates `text-*` utilities
   - Example: `--font-size-body: 16pt` → automatically creates `text-body` utility

3. **Line Height Tokens**:
   - Define `--line-height-*` in `@theme inline` → Tailwind automatically creates `leading-*` utilities
   - Example: `--line-height-body: 1.5` → automatically creates `leading-body` utility

**Pattern**:
```css
@theme inline {
  /* Token definition */
  --color-sos: var(--sos);
  --font-size-body: 16pt;
}

/* Automatically generates utilities: */
/* bg-sos, text-sos, border-sos, ring-sos, etc. */
/* text-body */
```

**Benefits**:
- No manual utility creation needed
- Type-safe (Tailwind knows about your custom utilities)
- Consistent with Tailwind's design system
- Works with all Tailwind features (responsive, dark mode, etc.)

**Migration from v3**:
- **Old (v3)**: Define in `tailwind.config.ts` → utilities available
- **New (v4)**: Define in `@theme inline` → utilities automatically available
- **No `@layer utilities` needed** - Tailwind handles this automatically

## Summary of Decisions

| Area           | Decision                        | Rationale                                           |
| -------------- | ------------------------------- | --------------------------------------------------- |
| Translation    | Inline objects                  | Simple, no dependencies, easy to maintain           |
| Colors         | `@theme inline` + CSS variables | Tailwind CSS v4 best practice, Shadcn/UI compatible |
| Typography     | `@theme inline` directive       | Tailwind CSS v4 best practice, maintainable         |
| Components     | Extend variants                 | No breaking changes, follows patterns               |
| Touch targets  | Tailwind utilities (h-12)       | Consistent, maintainable                            |
| Skeleton       | Variants of existing component  | Reuse, maintainable                                 |
| Toast          | Sonner config                   | Simple, API supports it                             |
| Network banner | New component                   | Better separation, visible                          |

## Open Questions Resolved

✅ All research questions resolved. No NEEDS CLARIFICATION markers remain.

## Next Steps

1. Implement translation system (lib/i18n.ts)
2. Update CSS custom properties (index.css)
3. Extend Tailwind config (typography, colors)
4. Customize components (Button, Badge, Card, etc.)
5. Update all component text to use translations
6. Test accessibility (color contrast, touch targets, typography)

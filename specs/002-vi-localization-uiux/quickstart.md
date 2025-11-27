# Quick Start: Vietnamese Localization & UI/UX Optimization

**Feature**: 002-vi-localization-uiux  
**Date**: 2025-01-27

## Overview

This guide provides step-by-step instructions for implementing Vietnamese localization and UI/UX optimizations for the emergency app.

## Prerequisites

- Existing Shadcn/UI setup
- Tailwind CSS configured
- React 19.2.0+
- TypeScript 5.9.3+

## Implementation Steps

### Step 1: Create Translation System

**File**: `web/src/lib/i18n.ts`

```typescript
export const translations = {
  sos: {
    medical: "Cấp cứu Y tế",
    flood: "Cấp cứu Lũ lụt",
    fire: "Cấp cứu Hỏa hoạn",
    missingPerson: "Người mất tích",
    description: {
      medical: "Cần hỗ trợ y tế khẩn cấp",
      flood: "Cần hỗ trợ sơ tán",
      fire: "Cần hỗ trợ chữa cháy khẩn cấp",
      missingPerson: "Cần tìm người mất tích",
    },
  },
  status: {
    safe: "Tôi an toàn",
    needHelp: "Cần hỗ trợ",
    cannotContact: "Không thể liên lạc",
    description: {
      safe: "Tôi an toàn và ổn",
      needHelp: "Tôi cần hỗ trợ",
      cannotContact: "Tôi không thể liên lạc",
    },
  },
  group: {
    type: {
      neighborhood: "Khu dân cư",
      ward: "Phường",
      district: "Quận",
      apartment: "Chung cư",
      other: "Khác",
    },
  },
  button: {
    send: "Gửi",
    sendSOS: "Gửi SOS",
    updateStatus: "Cập nhật trạng thái",
    createGroup: "Tạo nhóm",
    joinGroup: "Tham gia nhóm",
    leaveGroup: "Rời nhóm",
    favorite: "Yêu thích",
    unfavorite: "Bỏ yêu thích",
    cancel: "Hủy",
    confirm: "Xác nhận",
  },
  // ... add more translations as needed
};

export type TranslationKey = keyof typeof translations | string;
```

---

### Step 2: Update CSS Custom Properties and @theme inline

**File**: `web/src/index.css`

**Important**: Tailwind CSS v4 uses `@theme inline` directive instead of `tailwind.config.ts` for theme customization. Follow Shadcn/UI pattern: define CSS variables in `:root` and map them in `@theme inline`.

Add semantic colors to `@theme inline` block:

```css
@theme inline {
  /* Existing color mappings... */

  /* Semantic colors for emergency app */
  --color-sos: var(--sos);
  --color-safety: var(--safety);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-muted-semantic: var(--muted-semantic);
}
```

Add semantic color values to `:root` block:

```css
:root {
  /* Existing colors... */

  /* Semantic colors for emergency app */
  --sos: oklch(0.577 0.245 27.325); /* Red-500 #EF4444 */
  --safety: oklch(0.5 0.15 145); /* Green-600 #16A34A */
  --warning: oklch(0.6 0.15 50); /* Orange-600 #EA580C */
  --info: oklch(0.5 0.15 250); /* Blue-600 #2563EB */
  --muted-semantic: oklch(0.556 0 0); /* Slate-500 #64748B */
}
```

Add dark mode variants to `.dark` block (optional, for dark mode support):

```css
.dark {
  /* Existing dark mode colors... */

  /* Semantic colors for dark mode (adjusted for better contrast) */
  --sos: oklch(0.65 0.25 27.325); /* Lighter red for dark mode */
  --safety: oklch(0.55 0.15 145); /* Adjusted green for dark mode */
  --warning: oklch(0.65 0.15 50); /* Adjusted orange for dark mode */
  --info: oklch(0.55 0.15 250); /* Adjusted blue for dark mode */
  --muted-semantic: oklch(0.65 0 0); /* Lighter gray for dark mode */
}
```

**How it works**:

Tailwind CSS v4 **automatically generates utilities** from `@theme inline` tokens. When you define `--color-sos` in `@theme inline`, Tailwind automatically creates:

- `bg-sos` (background color)
- `text-sos` (text color)
- `border-sos` (border color)
- `ring-sos` (ring color)
- And all other color-related utilities

**Usage** (automatically available after adding to `@theme inline`):

- `bg-sos`, `text-sos`, `border-sos`, `ring-sos`
- `bg-safety`, `text-safety`, `border-safety`
- `bg-warning`, `text-warning`, `border-warning`
- `bg-info`, `text-info`, `border-info`

**No manual utility creation needed** - Tailwind CSS v4 handles this automatically!

---

### Step 3: Add Typography Scale to @theme inline

**File**: `web/src/index.css`

**Note**: Tailwind CSS v4 uses `@theme inline` instead of `tailwind.config.ts` for theme customization. Add typography scale to the `@theme inline` block.

Add typography scale to `@theme inline` block:

```css
@theme inline {
  /* Existing theme tokens... */

  /* Typography scale for accessibility */
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

Tailwind CSS v4 **automatically generates utilities** from `@theme inline` tokens:

- `--font-size-body` → automatically creates `text-body` utility
- `--font-size-heading-1` → automatically creates `text-heading-1` utility
- `--font-size-heading-2` → automatically creates `text-heading-2` utility
- `--font-size-caption` → automatically creates `text-caption` utility
- `--line-height-body` → automatically creates `leading-body` utility

**Usage** (automatically available after adding to `@theme inline`):

- `text-body` (16pt) - automatically generated
- `text-heading-1` (24pt) - automatically generated
- `text-heading-2` (20pt) - automatically generated
- `text-caption` (13pt) - automatically generated
- `leading-body` (1.5) - automatically generated

**Combining with other utilities**:

- `text-body font-bold` (16pt with bold weight)
- `text-heading-1 leading-tight` (24pt with tight line height)

**Important**:

- **No `@layer utilities` needed** - Tailwind CSS v4 automatically creates these utilities
- Just define tokens in `@theme inline` and use the generated classes
- If you need font-weight, combine with existing utilities: `text-body font-bold`

---

### Step 4: Customize Button Component

**File**: `web/src/components/ui/button.tsx`

Update button variants:

```typescript
export const buttonVariants = tv({
  // ... existing config
  variants: {
    variant: {
      // ... existing variants
      sos: "bg-sos text-white rounded-full shadow-lg hover:bg-sos/90",
    },
    size: {
      default: "h-12 px-4 py-2", // UPDATED: was h-9
      sm: "h-10 rounded-md gap-1.5 px-3",
      lg: "h-14 rounded-md px-6",
      // ... other sizes
    },
  },
});
```

---

### Step 5: Customize Badge Component

**File**: `web/src/components/ui/badge.tsx`

Update badge variants:

```typescript
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", // UPDATED: rounded-full
  {
    variants: {
      variant: {
        // ... existing variants
        sos: "border-transparent bg-red-100 text-red-800",
        safe: "border-transparent bg-green-100 text-green-800",
        neighborhood: "border-transparent bg-blue-100 text-blue-800",
      },
    },
  }
);
```

---

### Step 6: Update Card Component

**File**: `web/src/components/ui/card.tsx`

Update padding (if using default padding):

```typescript
// In CardHeader, CardContent, CardFooter
// Change default padding from p-6 to p-4
```

---

### Step 7: Configure Toast/Sonner

**File**: `web/src/components/ui/sonner.tsx`

Update Toaster configuration:

```typescript
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"  // NEW
      duration={6000}         // NEW: 6 seconds
      theme="system"
      // ... rest of config
    />
  );
};
```

---

### Step 8: Update Components with Translations

**Example**: `web/src/components/common/SOSSelector.tsx`

```typescript
import { translations } from "@/lib/i18n";

const SOS_TYPES = [
  {
    type: "medical",
    label: translations.sos.medical,
    description: translations.sos.description.medical,
  },
  // ... other types
];
```

**Example**: `web/src/pages/Home.tsx`

```typescript
import { translations } from '@/lib/i18n';

// Replace hardcoded text
<CardTitle>{translations.button.sendSOS}</CardTitle>
<CardDescription>{translations.sos.description.medical}</CardDescription>
```

---

### Step 9: Create Network Banner Component

**File**: `web/src/components/common/NetworkBanner.tsx`

```typescript
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface NetworkBannerProps {
  status: "online" | "offline" | "syncing" | "pending";
  pendingCount?: number;
}

export function NetworkBanner({ status, pendingCount }: NetworkBannerProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "online":
        return { icon: <Wifi />, text: "Đã kết nối", className: "bg-green-100 text-green-800" };
      case "offline":
        return { icon: <WifiOff />, text: "Không có kết nối", className: "bg-gray-100 text-gray-800" };
      case "syncing":
        return { icon: <Loader2 className="animate-spin" />, text: "Đang đồng bộ...", className: "bg-yellow-100 text-yellow-800" };
      case "pending":
        return { icon: <WifiOff />, text: `${pendingCount} đang chờ`, className: "bg-yellow-100 text-yellow-800" };
    }
  };

  const config = getStatusConfig();

  return (
    <Alert className={`${config.className} rounded-none border-0`}>
      <AlertDescription className="flex items-center gap-2">
        {config.icon}
        {config.text}
      </AlertDescription>
    </Alert>
  );
}
```

---

### Step 10: Update Layout to Include Network Banner

**File**: `web/src/pages/Home.tsx` (or layout component)

```typescript
import { NetworkBanner } from '@/components/common/NetworkBanner';

// In component
<header>...</header>
<NetworkBanner status="online" />
<main>...</main>
```

---

## Testing Checklist

### Translation Testing

- [ ] All English text replaced with Vietnamese
- [ ] No hardcoded English strings remain
- [ ] Translation keys are valid
- [ ] All UI text is readable in Vietnamese

### Color System Testing

- [ ] SOS buttons use red/orange color
- [ ] Safe status uses green color
- [ ] Warning status uses orange/yellow color
- [ ] All colors meet WCAG AAA contrast (7:1)
- [ ] Colors are consistent across components

### Typography Testing

- [ ] Body text is ≥16pt
- [ ] Headings are ≥20pt
- [ ] No text is <13pt
- [ ] Font weights are Regular (400), Medium (500), or Bold (700)
- [ ] Text is readable without glasses (test with 60+ age group)

### Touch Target Testing

- [ ] All buttons are ≥48px height
- [ ] Spacing between buttons is ≥8px
- [ ] Cards are tappable with ≥48px height
- [ ] Touch targets work with one thumb

### Component Testing

- [ ] Button "sos" variant works
- [ ] Badge "sos", "safe", "neighborhood" variants work
- [ ] Badge is rounded-full
- [ ] Card padding is p-4
- [ ] Toast appears at top-center
- [ ] Toast duration is 5-7 seconds
- [ ] Network banner appears below header

### Accessibility Testing

- [ ] Color contrast meets WCAG AAA
- [ ] Touch targets meet minimum size
- [ ] Text is readable at specified sizes
- [ ] Screen reader compatible (if applicable)

---

## Common Issues & Solutions

### Issue: Translation key not found

**Solution**: Ensure translation key exists in `lib/i18n.ts` and is imported correctly.

### Issue: Color not applying

**Solution**:

1. Check CSS variable is defined in `:root` block in `index.css`
2. Check `@theme inline` block has `--color-*` mapping (e.g., `--color-sos: var(--sos)`)
3. Ensure you're using Tailwind utilities (e.g., `bg-sos`) not CSS variables directly
4. Clear Tailwind cache: `rm -rf node_modules/.cache && npm run build`

### Issue: Button size not updating

**Solution**: Clear Tailwind cache and rebuild: `rm -rf node_modules/.cache && npm run build`.

### Issue: Toast not appearing at top

**Solution**: Check Toaster component has `position="top-center"` prop.

### Issue: Network banner not showing

**Solution**: Ensure NetworkBanner is placed in layout and receives correct status prop.

---

## Next Steps

1. Complete translation of all components
2. Test with real users (especially 60+ age group)
3. Verify color contrast with accessibility tools
4. Test touch targets on actual mobile devices
5. Performance testing (ensure no degradation)

---

## Resources

- [Shadcn/UI Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [WCAG AAA Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html)
- [Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

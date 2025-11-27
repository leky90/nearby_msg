# Component Contracts: Vietnamese Localization & UI/UX Optimization

**Feature**: 002-vi-localization-uiux  
**Date**: 2025-01-27

## Overview

This is a frontend-only feature. No backend API changes are required. This document defines the component interfaces and translation key contracts for implementation.

## Translation Key Contract

### Structure

```typescript
type TranslationKey = string; // Format: "<category>.<subcategory>.<key>"
type TranslationValue = string; // Vietnamese text

interface Translations {
  [key: TranslationKey]: TranslationValue;
}
```

### Translation Categories

#### SOS Messages

```typescript
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
}
```

#### Status Types

```typescript
status: {
  safe: "Tôi an toàn",
  needHelp: "Cần hỗ trợ",
  cannotContact: "Không thể liên lạc",
  description: {
    safe: "Tôi an toàn và ổn",
    needHelp: "Tôi cần hỗ trợ",
    cannotContact: "Tôi không thể liên lạc",
  },
}
```

#### Group Types

```typescript
group: {
  type: {
    neighborhood: "Khu dân cư",
    ward: "Phường",
    district: "Quận",
    apartment: "Chung cư",
    other: "Khác",
  },
}
```

#### Common UI Text

```typescript
common: {
  cancel: "Hủy",
  confirm: "Xác nhận",
  send: "Gửi",
  save: "Lưu",
  delete: "Xóa",
  edit: "Sửa",
  close: "Đóng",
  back: "Quay lại",
  next: "Tiếp theo",
  loading: "Đang tải...",
  error: "Lỗi",
  success: "Thành công",
}
```

#### Button Labels

```typescript
button: {
  send: "Gửi",
  sendSOS: "Gửi SOS",
  updateStatus: "Cập nhật trạng thái",
  createGroup: "Tạo nhóm",
  joinGroup: "Tham gia nhóm",
  leaveGroup: "Rời nhóm",
  favorite: "Yêu thích",
  unfavorite: "Bỏ yêu thích",
}
```

#### Form Labels

```typescript
form: {
  groupName: "Tên nhóm",
  groupType: "Loại nhóm",
  location: "Vị trí",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
  description: "Mô tả",
  message: "Tin nhắn",
}
```

#### Error Messages

```typescript
error: {
  required: "Trường này là bắt buộc",
  invalid: "Giá trị không hợp lệ",
  network: "Lỗi kết nối mạng",
  unknown: "Đã xảy ra lỗi",
}
```

#### Network Status

```typescript
network: {
  online: "Đã kết nối",
  offline: "Không có kết nối",
  syncing: "Đang đồng bộ...",
  pending: "{count} đang chờ",
}
```

---

## Component Interface Contracts

### Button Component

**Extended Props**:

```typescript
interface ButtonProps {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "sos"; // NEW: "sos"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  // ... other props
}
```

**Size Changes**:

- `default`: Now `h-12` (48px) instead of `h-9` (36px)
- `sm`: `h-10` (40px)
- `lg`: `h-14` (56px)

**New Variant: `sos`**:

- Background: `--sos-color` (red/orange)
- Text: White
- Border radius: `rounded-full`
- Animation: `animate-pulse` (optional)
- Shadow: `shadow-lg`

---

### Badge Component

**Extended Props**:

```typescript
interface BadgeProps {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "sos"
    | "safe"
    | "neighborhood"; // NEW variants
  // ... other props
}
```

**Style Changes**:

- Border radius: `rounded-full` (was `rounded-md`)

**New Variants**:

- `sos`: Red background, red text
- `safe`: Green background, green text
- `neighborhood`: Blue background, blue text

---

### Card Component

**Style Changes**:

- Padding: `p-4` (was `p-6`)
- Border: Reduced opacity
- Shadow: `shadow-sm`

**No prop changes** - visual updates only.

---

### Toast/Sonner Component

**Configuration Changes**:

```typescript
<Toaster
  position="top-center"  // NEW: was default (bottom-right)
  duration={6000}        // NEW: was default (4000ms)
  // ... other props
/>
```

---

### Network Status Component

**New Component**: `NetworkBanner`

**Props**:

```typescript
interface NetworkBannerProps {
  status: "online" | "offline" | "syncing" | "pending";
  pendingCount?: number;
  className?: string;
}
```

**Display**:

- Full-width banner below header
- Uses semantic colors (green/yellow/gray)
- Visible but not intrusive

---

## Design Token Contracts

### Color Tokens

**Tailwind CSS v4 Pattern**: Colors are defined in two places:

1. CSS variables in `:root` and `.dark` (actual color values)
2. `@theme inline` block (maps to Tailwind utilities)

```css
/* In @theme inline block */
@theme inline {
  /* Semantic colors mapped to Tailwind utilities */
  --color-sos: var(--sos);
  --color-safety: var(--safety);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-muted-semantic: var(--muted-semantic);
}

/* In :root block */
:root {
  /* Semantic colors - actual values */
  --sos: oklch(0.577 0.245 27.325); /* Red-500 #EF4444 */
  --safety: oklch(0.5 0.15 145); /* Green-600 #16A34A */
  --warning: oklch(0.6 0.15 50); /* Orange-600 #EA580C */
  --info: oklch(0.5 0.15 250); /* Blue-600 #2563EB */
  --muted-semantic: oklch(0.556 0 0); /* Slate-500 #64748B */

  /* Neutral colors (existing) */
  --background: oklch(1 0 0); /* #FFFFFF */
  --foreground: oklch(0.145 0 0); /* #0F172A */
  --card: oklch(0.98 0 0); /* #F8FAFC */
  --border: oklch(0.922 0 0); /* #E2E8F0 */
}

/* In .dark block (for dark mode) */
.dark {
  /* Semantic colors for dark mode */
  --sos: oklch(0.65 0.25 27.325); /* Adjusted for dark mode */
  --safety: oklch(0.55 0.15 145); /* Adjusted for dark mode */
  --warning: oklch(0.65 0.15 50); /* Adjusted for dark mode */
  --info: oklch(0.55 0.15 250); /* Adjusted for dark mode */
  --muted-semantic: oklch(0.65 0 0); /* Adjusted for dark mode */
}
```

**How Tailwind CSS v4 generates utilities**:

Tailwind CSS v4 **automatically generates utilities** from `@theme inline` tokens. When you define `--color-sos` in `@theme inline`, Tailwind automatically creates all color-related utilities:

- `bg-sos` (background)
- `text-sos` (text color)
- `border-sos` (border color)
- `ring-sos` (ring color)
- `outline-sos` (outline color)
- And all other color utilities

**Usage in Tailwind utilities** (automatically generated):

- `bg-sos`, `text-sos`, `border-sos`, `ring-sos` (from `--color-sos` in `@theme inline`)
- `bg-safety`, `text-safety`, `border-safety` (from `--color-safety`)
- `bg-warning`, `text-warning`, `border-warning` (from `--color-warning`)
- `bg-info`, `text-info`, `border-info` (from `--color-info`)

**Key Point**: No manual utility creation needed. Tailwind CSS v4 handles this automatically from `@theme inline` tokens.

### Typography Scale

**Tailwind CSS v4 Pattern**: Typography is defined in `@theme inline` block.

```css
/* In @theme inline block */
@theme inline {
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

**How Tailwind CSS v4 generates utilities**:

Tailwind CSS v4 **automatically generates utilities** from `@theme inline` tokens:

- `--font-size-body` → automatically creates `text-body` utility
- `--font-size-heading-1` → automatically creates `text-heading-1` utility
- `--font-size-heading-2` → automatically creates `text-heading-2` utility
- `--font-size-caption` → automatically creates `text-caption` utility
- `--line-height-body` → automatically creates `leading-body` utility

**Usage** (automatically available):

- `text-body` (16pt) - automatically generated from `--font-size-body`
- `text-heading-1` (24pt) - automatically generated from `--font-size-heading-1`
- `text-heading-2` (20pt) - automatically generated from `--font-size-heading-2`
- `text-caption` (13pt) - automatically generated from `--font-size-caption`
- `leading-body` (1.5) - automatically generated from `--line-height-body`

**Combining with other utilities**:

- `text-body font-bold` (16pt, bold weight)
- `text-heading-1 leading-tight` (24pt, tight line height)

**Key Point**: **No `@layer utilities` needed**. Tailwind CSS v4 automatically creates these utilities from `@theme inline` tokens. Just define the tokens and use the generated classes.

### Spacing Scale

```typescript
// Touch targets
minHeight: {
  'touch': '48px', // h-12
}

// Button spacing
gap: {
  'touch': '8px',  // gap-2
  'touch-lg': '12px', // gap-3
}
```

---

## Usage Examples

### Translation Usage

```typescript
import { translations } from '@/lib/i18n';

// In component
<Button>{translations.button.send}</Button>
<Badge variant="sos">{translations.sos.medical}</Badge>
```

### Component Usage

```typescript
// SOS Button
<Button variant="sos" size="lg">
  {translations.button.sendSOS}
</Button>

// Status Badge
<Badge variant="safe">
  {translations.status.safe}
</Badge>

// Network Banner
<NetworkBanner status="online" />
```

---

## Validation Rules

1. **Translation Keys**: Must exist in translations object before use
2. **Color Tokens**: Must meet WCAG AAA contrast (7:1 for normal text)
3. **Typography**: Body ≥16pt, Headings ≥20pt, No text <13pt
4. **Touch Targets**: All interactive elements ≥48px height
5. **Component Variants**: Must use defined variant names

---

## Breaking Changes

**None**: All changes are additive or default updates. Existing code continues to work.

## Migration Guide

1. **Translation Keys**: Replace hardcoded English text with translation keys
2. **Button Sizes**: Existing buttons automatically get larger (h-12), can override if needed
3. **Badge Style**: Existing badges automatically get rounded-full, can override if needed
4. **Card Padding**: Existing cards automatically get p-4, can override if needed
5. **Toast Position**: Update Toaster component configuration

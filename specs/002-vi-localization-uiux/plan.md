# Implementation Plan: Vietnamese Localization & UI/UX Optimization

**Branch**: `002-vi-localization-uiux` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-vi-localization-uiux/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Dịch toàn bộ text tiếng Anh sang tiếng Việt và điều chỉnh UI/UX theo hướng dẫn thiết kế cho ứng dụng khẩn cấp. Áp dụng hệ thống màu ngữ nghĩa với độ tương phản cao, typography lớn dễ đọc, và layout thân thiện với ngón tay. Tùy biến Shadcn/UI components để đáp ứng yêu cầu accessibility và usability trong tình huống thiên tai.

## Technical Context

**Language/Version**: TypeScript 5.9.3, React 19.2.0  
**Primary Dependencies**:

- Shadcn/UI (Radix UI primitives + Tailwind CSS)
- Tailwind CSS 4.1.17
- React Aria Components 1.13.0
- Sonner 2.0.7 (Toast notifications)
- Lucide React 0.555.0 (Icons)
- TanStack Query 5.90.11

**Storage**: N/A (UI-only changes, no data model changes)  
**Testing**: Vitest 3.2.4, React Testing Library 16.3.0  
**Target Platform**: PWA (Progressive Web App), Mobile-first, browsers supporting CSS custom properties  
**Project Type**: Web application (frontend only)  
**Performance Goals**:

- Maintain 60fps during animations
- No degradation in render performance after UI changes
- Skeleton loading should feel instant (<100ms perceived latency)

**Constraints**:

- Must maintain backward compatibility with existing components
- Must work offline (PWA requirement)
- Must support minimum 320px width screens
- Color contrast must meet WCAG AAA standards
- Typography must be readable without glasses for 60+ age group

**Scale/Scope**:

- ~30+ React components to update with Vietnamese text
- ~15+ Shadcn/UI components to customize (Button, Badge, Card, Toast, etc.)
- ~5 pages/screens to update
- Design tokens system to extend (colors, typography, spacing)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify compliance with Engineering Constitution principles:

**Core Principles (I-VII)**:

- ✅ **Code Quality (I)**: KISS/DRY/SOLID; Domain-First architecture; Explicit > Implicit
  - Changes are UI-only, no business logic changes
  - Reuse existing Shadcn/UI components, extend rather than replace
  - Explicit color tokens and typography scale
- ✅ **Techstack (II)**: Respects project techstack config; documented rationale
  - Uses existing Shadcn/UI, Tailwind CSS, React stack
  - No new frameworks introduced
- ✅ **Version Management (III)**: Stable, explicit versions (no `latest`/wildcards)
  - All dependencies already pinned in package.json
  - No version changes required
- ✅ **Project Structure (IV)**: Code in `web/` directory (not root)
  - All changes in `web/src/` directory
  - Follows existing component structure
- ✅ **Installation (V)**: Official installation commands from vendor docs
  - No new installations required
  - Uses existing Shadcn/UI setup
- ✅ **Testing (VI)**: Test strategy for new features
  - Visual regression tests for UI changes
  - Accessibility tests for color contrast and touch targets
  - Component tests for translated text
- ✅ **Documentation (VII)**: Self-documenting code; API docs
  - Translation keys documented
  - Design tokens documented in CSS variables
  - Component customization rationale documented

**Techstack-Specific (VIII-IX)**:

- ✅ **Frontend (VIII)**: TypeScript; functional components/hooks; domain logic separated from UI
  - All components are functional components
  - Translation strings separated from component logic
  - TypeScript types for translation keys
- ✅ **Backend (IX)**: N/A (frontend-only feature)

**AI Collaboration (X)**: Generated code compiles; respects existing patterns

- ✅ No silent framework additions
- ✅ Follows existing Shadcn/UI patterns
- ✅ Maintains existing component API contracts

**No violations detected** - All changes are UI-only and follow existing patterns.

## Project Structure

### Documentation (this feature)

```text
specs/002-vi-localization-uiux/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository structure per Constitution IV)

```text
web/
├── src/
│   ├── components/
│   │   ├── ui/              # Shadcn/UI components (Button, Badge, Card, etc.)
│   │   ├── chat/            # Chat components (MessageList, MessageInput, etc.)
│   │   ├── common/          # Common components (SOSButton, StatusSelector, etc.)
│   │   └── groups/          # Group-related components
│   ├── pages/               # Page components (Home, ChatPage, etc.)
│   ├── lib/
│   │   ├── utils.ts         # Utility functions
│   │   └── i18n.ts          # NEW: Translation utilities
│   ├── styles/
│   │   └── tokens.css       # NEW: Design tokens (colors, typography)
│   └── index.css            # Global styles (update with new tokens)
├── components.json           # Shadcn/UI config (update if needed)
├── tailwind.config.ts       # Tailwind config (extend with new colors/typography)
└── package.json             # Dependencies (no changes expected)
```

**Structure Decision**:

- All changes are in `web/` directory (frontend-only)
- New files: `lib/i18n.ts` for translation utilities, `styles/tokens.css` for design tokens
- Existing component structure maintained, components updated in-place
- No new directories needed

## Complexity Tracking

> **No violations detected** - All changes are UI-only and follow existing patterns. No complexity justification needed.

## Phase 0: Research & Decisions

See [research.md](./research.md) for detailed research findings.

### Key Research Areas

1. **Translation Strategy**
   - Decision: Use inline translation objects (no i18n library)
   - Rationale: Single language (Vietnamese), simple requirement, avoid dependency overhead
   - Alternatives: react-i18next, react-intl (rejected due to complexity for single language)

2. **Color System Implementation**
   - Decision: Extend Tailwind CSS custom properties in `index.css`
   - Rationale: Shadcn/UI uses CSS variables, easy to override
   - Alternatives: Tailwind config only (rejected - CSS variables more flexible)

3. **Typography Scale**
   - Decision: Use Tailwind typography utilities with custom font sizes
   - Rationale: Consistent with existing Tailwind setup
   - Alternatives: CSS-only (rejected - Tailwind utilities more maintainable)

4. **Component Customization**
   - Decision: Extend existing Shadcn/UI components via variants
   - Rationale: Maintains component API, follows Shadcn patterns
   - Alternatives: Replace components (rejected - breaks existing code)

5. **Touch Target Sizing**
   - Decision: Use Tailwind height utilities (h-12, h-14) for minimum 48px
   - Rationale: Consistent with existing sizing system
   - Alternatives: CSS-only (rejected - Tailwind utilities preferred)

6. **Skeleton Loading**
   - Decision: Use existing Skeleton component, create layout-specific variants
   - Rationale: Component already exists, just needs customization
   - Alternatives: New component (rejected - unnecessary)

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for entity definitions.

**Key Entities**:

- **TranslationKey**: String identifier for translation (e.g., "sos.medical", "status.safe")
- **TranslationValue**: Vietnamese text string
- **ColorToken**: CSS custom property name (e.g., "--sos-color", "--safety-color")
- **TypographyScale**: Font size and weight definitions

### API Contracts

See [contracts/](./contracts/) for API documentation.

**Note**: This is a frontend-only feature. No backend API changes required. However, we document:

- Component prop interfaces (TypeScript)
- Translation key structure
- Design token structure

### Quick Start

See [quickstart.md](./quickstart.md) for implementation guide.

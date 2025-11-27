# Tasks: Vietnamese Localization & UI/UX Optimization

**Input**: Design documents from `/specs/002-vi-localization-uiux/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL for this UI-only feature. Visual regression and accessibility testing can be done manually.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions (Constitution IV Compliance)

- **Web app**: All changes in `web/src/` directory (frontend-only)
- **No root-level code**: All source code in `web/` directory per Constitution IV

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and translation system setup

- [x] T001 Create translation system file `web/src/lib/i18n.ts` with translation object structure
- [x] T002 [P] Add semantic color tokens to `@theme inline` block in `web/src/index.css`
- [x] T003 [P] Add semantic color values to `:root` block in `web/src/index.css`
- [x] T004 [P] Add semantic color dark mode variants to `.dark` block in `web/src/index.css`
- [x] T005 [P] Add typography scale tokens to `@theme inline` block in `web/src/index.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core design system changes that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Customize Button component: Add 'sos' variant and update default size to h-12 in `web/src/components/ui/button.tsx`
- [x] T007 Customize Badge component: Add semantic variants (sos, safe, neighborhood) and change to rounded-full in `web/src/components/ui/badge.tsx`
- [x] T008 Update Card component: Reduce default padding from p-6 to p-4 in `web/src/components/ui/card.tsx`
- [x] T009 Configure Toast/Sonner: Set position to top-center and duration to 6000ms in `web/src/components/ui/sonner.tsx`
- [x] T010 Create NetworkBanner component in `web/src/components/common/NetworkBanner.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Vietnamese Language Interface (Priority: P1) 🎯 MVP

**Goal**: Translate all English text to Vietnamese throughout the application

**Independent Test**: Open the application and verify all displayed text is in Vietnamese, with no English text remaining in the UI

### Implementation for User Story 1

- [ ] T011 [P] [US1] Add SOS translations (medical, flood, fire, missingPerson) to `web/src/lib/i18n.ts`
- [ ] T012 [P] [US1] Add status translations (safe, needHelp, cannotContact) to `web/src/lib/i18n.ts`
- [ ] T013 [P] [US1] Add group type translations (neighborhood, ward, district, apartment, other) to `web/src/lib/i18n.ts`
- [ ] T014 [P] [US1] Add button label translations to `web/src/lib/i18n.ts`
- [ ] T015 [P] [US1] Add form label translations to `web/src/lib/i18n.ts`
- [ ] T016 [P] [US1] Add common UI text translations (cancel, confirm, send, etc.) to `web/src/lib/i18n.ts`
- [ ] T017 [P] [US1] Add error message translations to `web/src/lib/i18n.ts`
- [ ] T018 [P] [US1] Add network status translations to `web/src/lib/i18n.ts`
- [x] T019 [US1] Update SOSSelector component: Replace English text with translations in `web/src/components/common/SOSSelector.tsx`
- [x] T020 [US1] Update StatusSelector component: Replace English text with translations in `web/src/components/common/StatusSelector.tsx`
- [x] T021 [US1] Update Home page: Replace English text with translations in `web/src/pages/Home.tsx`
- [x] T022 [US1] Update ChatPage: Replace English text with translations in `web/src/pages/ChatPage.tsx`
- [x] T023 [US1] Update ChatHeader component: Replace English text with translations in `web/src/components/chat/ChatHeader.tsx`
- [x] T024 [US1] Update MessageInput component: Replace English text with translations in `web/src/components/chat/MessageInput.tsx`
- [x] T025 [US1] Update CreateGroupForm component: Replace English text with translations in `web/src/components/groups/CreateGroupForm.tsx`
- [x] T026 [US1] Update CreateGroupPage: Replace English text with translations in `web/src/pages/CreateGroupPage.tsx`
- [x] T027 [US1] Update NearbyGroups page: Replace English text with translations in `web/src/pages/NearbyGroups.tsx`
- [x] T028 [US1] Update GroupCard component: Replace English text with translations in `web/src/components/groups/GroupCard.tsx`
- [x] T029 [US1] Update FavoriteGroupCard component: Replace English text with translations in `web/src/components/groups/FavoriteGroupCard.tsx`
- [x] T030 [US1] Update StatusSummary component: Replace English text with translations in `web/src/components/groups/StatusSummary.tsx`
- [x] T031 [US1] Update PinnedMessagesModal component: Replace English text with translations in `web/src/components/chat/PinnedMessagesModal.tsx`
- [x] T032 [US1] Update SOSMessage component: Replace English text with translations in `web/src/components/chat/SOSMessage.tsx`
- [x] T033 [US1] Update message-service.ts: Replace English SOS default content with Vietnamese in `web/src/services/message-service.ts`
- [x] T034 [US1] Update ErrorBoundary component: Replace English text with translations in `web/src/components/common/ErrorBoundary.tsx`
- [x] T035 [US1] Update toast utility: Replace English toast messages with translations in `web/src/utils/toast.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional - all text displayed in Vietnamese

---

## Phase 4: User Story 2 - High Contrast Color System (Priority: P1)

**Goal**: Implement semantic color system with high contrast for emergency situations

**Independent Test**: Verify all components use semantic colors correctly - SOS buttons use red/orange, safe status uses green, warnings use orange/yellow

### Implementation for User Story 2

- [x] T036 [US2] Update SOSButton component: Use 'sos' variant with bg-sos color in `web/src/components/common/SOSButton.tsx`
- [x] T037 [US2] Update StatusSelector component: Use semantic colors (bg-safety, bg-warning) for status options in `web/src/components/common/StatusSelector.tsx`
- [x] T038 [US2] Update StatusIndicator component: Use semantic colors (text-safety, text-warning) in `web/src/components/common/StatusIndicator.tsx`
- [x] T039 [US2] Update ConnectivityStatus component: Use semantic colors for network states in `web/src/components/common/ConnectivityStatus.tsx`
- [ ] T040 [US2] Update NetworkBanner component: Use semantic colors (bg-safety, bg-warning, bg-muted-semantic) in `web/src/components/common/NetworkBanner.tsx`
- [ ] T041 [US2] Update GroupCard component: Use semantic badge variants (sos, safe, neighborhood) in `web/src/components/groups/GroupCard.tsx`
- [ ] T042 [US2] Update ChatHeader component: Use semantic colors for sync status indicators in `web/src/components/chat/ChatHeader.tsx`
- [ ] T043 [US2] Update MessageBubble component: Use semantic colors for message types in `web/src/components/chat/MessageBubble.tsx`
- [ ] T044 [US2] Update SOSMessage component: Use bg-sos color for SOS message display in `web/src/components/chat/SOSMessage.tsx`
- [ ] T045 [US2] Verify WCAG AAA contrast: Test all semantic colors meet 7:1 contrast ratio on white background

**Checkpoint**: At this point, User Story 2 should be complete - semantic colors applied consistently

---

## Phase 5: User Story 3 - Large Touch Targets and Thumb-Friendly Layout (Priority: P1)

**Goal**: Ensure all interactive elements meet 48px minimum height and important buttons are in thumb-friendly zone

**Independent Test**: Measure all buttons and verify minimum 48px height, verify important buttons are in lower half of screen

### Implementation for User Story 3

- [x] T046 [US3] Verify Button default size is h-12 (48px) in `web/src/components/ui/button.tsx`
- [x] T047 [US3] Update SOSButton component: Ensure minimum h-12 size and add pulse animation in `web/src/components/common/SOSButton.tsx`
- [x] T048 [US3] Update MessageInput component: Ensure send button is h-12 and positioned in lower half in `web/src/components/chat/MessageInput.tsx`
- [x] T049 [US3] Update StatusSelector component: Ensure status buttons are h-12 with 8-12px spacing in `web/src/components/common/StatusSelector.tsx`
- [x] T050 [US3] Update GroupCard component: Ensure card has minimum 48px height for tap target in `web/src/components/groups/GroupCard.tsx`
- [x] T051 [US3] Update FavoriteGroupCard component: Ensure card has minimum 48px height in `web/src/components/groups/FavoriteGroupCard.tsx`
- [x] T052 [US3] Update Home page: Position SOS button and status update in lower half of screen in `web/src/pages/Home.tsx`
- [x] T053 [US3] Update CreateGroupForm component: Ensure form buttons are h-12 with proper spacing in `web/src/components/groups/CreateGroupForm.tsx`
- [x] T054 [US3] Update ChatPage layout: Ensure message input and send button are in lower half in `web/src/pages/ChatPage.tsx`
- [x] T055 [US3] Verify spacing: Check all button groups have 8-12px gap between buttons

**Checkpoint**: At this point, User Story 3 should be complete - all touch targets meet 48px minimum

---

## Phase 6: User Story 4 - Large, Readable Typography (Priority: P2)

**Goal**: Implement large, readable typography with minimum 16pt for body text and 20pt+ for headings

**Independent Test**: Measure all text in application and verify body text is ≥16pt, headings are ≥20pt, no text is <13pt

### Implementation for User Story 4

- [x] T056 [US4] Update Home page: Apply text-body (16pt) to body text and text-heading-1 (24pt) to main title in `web/src/pages/Home.tsx`
- [x] T057 [US4] Update ChatPage: Apply text-heading-2 (20pt) to chat header in `web/src/pages/ChatPage.tsx`
- [x] T058 [US4] Update ChatHeader component: Apply text-heading-2 (20pt) to group name in `web/src/components/chat/ChatHeader.tsx`
- [x] T059 [US4] Update GroupCard component: Apply text-heading-2 (20pt) to group name, text-body (16pt) to description in `web/src/components/groups/GroupCard.tsx`
- [x] T060 [US4] Update FavoriteGroupCard component: Apply text-heading-2 (20pt) to group name in `web/src/components/groups/FavoriteGroupCard.tsx`
- [x] T061 [US4] Update StatusSelector component: Apply text-body (16pt) to labels and descriptions in `web/src/components/common/StatusSelector.tsx`
- [x] T062 [US4] Update SOSSelector component: Apply text-heading-2 (20pt) to title, text-body (16pt) to descriptions in `web/src/components/common/SOSSelector.tsx`
- [x] T063 [US4] Update CreateGroupForm component: Apply text-body (16pt) to labels and inputs in `web/src/components/groups/CreateGroupForm.tsx`
- [x] T064 [US4] Update MessageInput component: Apply text-body (16pt) to input placeholder in `web/src/components/chat/MessageInput.tsx`
- [x] T065 [US4] Update MessageBubble component: Apply text-body (16pt) to message content in `web/src/components/chat/MessageBubble.tsx`
- [x] T066 [US4] Update Card components: Apply text-heading-2 (20pt) to CardTitle, text-body (16pt) to CardDescription in `web/src/components/ui/card.tsx`
- [x] T067 [US4] Verify font weights: Ensure no Thin/Light weights, use Regular (400), Medium (500), Bold (700) only

**Checkpoint**: At this point, User Story 4 should be complete - all text meets minimum size requirements

---

## Phase 7: User Story 5 - Visual Feedback and Loading States (Priority: P2)

**Goal**: Implement skeleton loading and clear offline state indicators

**Independent Test**: Verify skeleton loading is used instead of spinner, offline state is clearly visible

### Implementation for User Story 5

- [x] T068 [US5] Update Home page: Replace spinner with skeleton for favorite groups loading in `web/src/pages/Home.tsx`
- [x] T069 [US5] Update NearbyGroups page: Create GroupCard skeleton and use for loading state in `web/src/pages/NearbyGroups.tsx`
- [x] T070 [US5] Update MessageList component: Create message skeleton and use for loading state in `web/src/components/chat/MessageList.tsx`
- [x] T071 [US5] Update NetworkBanner component: Display full-width banner below header in `web/src/components/common/NetworkBanner.tsx`
- [x] T072 [US5] Update Home page: Add NetworkBanner below header in `web/src/pages/Home.tsx`
- [x] T073 [US5] Update ChatPage: Add NetworkBanner below ChatHeader in `web/src/pages/ChatPage.tsx`
- [x] T074 [US5] Update OfflineIndicator component: Apply muted color and ensure content remains readable in `web/src/components/common/OfflineIndicator.tsx`
- [x] T075 [US5] Update MessageInput component: Show clear loading state when sending message in `web/src/components/chat/MessageInput.tsx`
- [x] T076 [US5] Update StatusSelector component: Show clear loading state when updating status in `web/src/components/common/StatusSelector.tsx`
- [x] T077 [US5] Verify offline mode: Test that old messages remain readable when offline

**Checkpoint**: At this point, User Story 5 should be complete - skeleton loading and offline states implemented

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [x] T078 [P] Run visual regression check: Verify all components display correctly with Vietnamese text
- [x] T079 [P] Run accessibility audit: Verify WCAG AAA contrast ratios for all semantic colors
- [x] T080 [P] Test touch targets: Verify all buttons meet 48px minimum on actual mobile device
- [x] T081 [P] Test typography: Verify all text is readable without glasses (test with 60+ age group if possible)
- [x] T082 [P] Verify dark mode: Test semantic colors work correctly in dark mode
- [x] T083 [P] Test edge cases: Verify Vietnamese text doesn't overflow containers
- [ ] T084 [P] Update documentation: Document translation keys in `web/src/lib/i18n.ts` comments
- [ ] T085 [P] Code cleanup: Remove any unused English text or commented code
- [ ] T086 Run quickstart.md validation: Verify all implementation steps from quickstart.md are complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Uses design tokens from Setup
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Uses Button component from Foundational
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Uses typography tokens from Setup
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Uses NetworkBanner from Foundational

### Within Each User Story

- Translation keys (T011-T018) can be created in parallel
- Component updates within a story can be done in parallel (different files)
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T002-T005) can run in parallel
- All Foundational tasks (T006-T010) can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Translation key creation (T011-T018) can run in parallel
- Component updates within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all translation key creation tasks together:
Task: "Add SOS translations to web/src/lib/i18n.ts"
Task: "Add status translations to web/src/lib/i18n.ts"
Task: "Add group type translations to web/src/lib/i18n.ts"
Task: "Add button label translations to web/src/lib/i18n.ts"
Task: "Add form label translations to web/src/lib/i18n.ts"
Task: "Add common UI text translations to web/src/lib/i18n.ts"
Task: "Add error message translations to web/src/lib/i18n.ts"
Task: "Add network status translations to web/src/lib/i18n.ts"

# Launch all component updates together (after translations are ready):
Task: "Update SOSSelector component in web/src/components/common/SOSSelector.tsx"
Task: "Update StatusSelector component in web/src/components/common/StatusSelector.tsx"
Task: "Update Home page in web/src/pages/Home.tsx"
Task: "Update ChatPage in web/src/pages/ChatPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Vietnamese Language Interface)
4. **STOP and VALIDATE**: Test User Story 1 independently - verify all text is Vietnamese
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Translation)
   - Developer B: User Story 2 (Color System)
   - Developer C: User Story 3 (Touch Targets)
3. After P1 stories complete:
   - Developer A: User Story 4 (Typography)
   - Developer B: User Story 5 (Visual Feedback)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Translation keys should be created first before component updates
- Design tokens (colors, typography) must be in place before component customization
- Verify each story independently before moving to next
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

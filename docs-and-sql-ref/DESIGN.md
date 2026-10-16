# Design System — Drawing Control & Alerts

**Status:** Draft for approval
**Sources:** `DESIGN-SYSTEM-V1.md`, `DESIGN-SYSTEM-COMPONENTS-V1.md`, `FRONTEND-DESIGN-SYSTEM-EXPORT.md` (uploaded reference, from the Therapist Platform project)
**Scope:** Internal web app (owner, project heads, discipline leads, drafters, checkers) and the client portal (read-only drawings, conflicts, transmittals). English only.

---

## 1. What we reuse and what we change

| Area | Reference | This product |
|---|---|---|
| Tokens (Sage, Terracotta, Stone, status colours) | Yes | **Reuse**, subject to confirmation O-D1 (brand) |
| Typography scale | Yes | **Reuse** |
| Spacing, radius, shadows, motion | Yes | **Reuse**, add reduced-motion support |
| `ds-*` component library | Button, Card, Badge, Avatar, PageHeader, EmptyState, FormField | **Reuse** the seven components; build the gaps (section 7.2) |
| Domain components (PatientCard, ClinicalNote, PrivacyIndicator…) | Therapy domain | **Replace** with drawing-control components (section 7.3) |
| Layout: sidebar shell, list-page anatomy | Yes | **Reuse** for the internal app; simplified shell for the client portal |
| Public website, shop, cart, cookie consent, SEO | Yes | **Remove** — not in scope |
| Portuguese copy and route slugs (`/loja`, `/cliente`) | Yes | **Remove** — English only |
| Multi-language (pt-BR, en, es, fr) | Yes | **Remove** — English only (decision 43) |
| Brand ramp generated at runtime (white-label) | Yes | **Remove** — single firm brand (no white-label in scope) |
| Dark mode | Tokens defined, screens never tuned | **Tokens defined, pilot ships light only** (O-D3) |

---

## 2. Design direction

**Working name:** *Calma estruturada* (structured calm), inherited from the reference, **to be confirmed (O-D1)**.

For this product the direction means:

- **Quiet, not decorative.** The owner and project heads scan many items a day. The interface should reduce noise, not add to it.
- **Structured.** Every sheet, revision, approval and conflict has a clear state, a clear owner and a clear next action.
- **Trustworthy.** Revisions are immutable once issued. The interface shows this explicitly, so nobody mistakes an old revision for the current one.
- **Professional, not hospital-like or ERP-like.** The users are architects and engineers at a design firm. The interface should feel like a good drawing set: precise, well-labelled, easy to read.

### Principles

1. **Status is always visible** — never a colour alone; always an icon or text label as well.
2. **One next action per screen** — the primary button says what happens next.
3. **Show the revision** — every sheet reference includes its revision (for example `M-101 R2`).
4. **Explain blocked actions** — when an action is blocked by a rule (for example, open critical clash), say which rule and what to do.
5. **No hidden state changes** — approvals, rejections and issues always show who did them and when.

---

## 3. Design tokens

All tokens are defined as CSS custom properties on `:root`, with Tailwind `@theme` aliases. New code uses the **semantic** tokens (`--surface`, `--text-primary`), not the primitives.

### 3.1 Brand — Sage (primary)

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#F3F7F5` | `#E4EEE9` | `#C9DED3` | `#A5C8B7` | `#7EAE98` | `#5B947B` | `#477762` | `#385E4E` | `#304D42` | `#293F37` | `#15231E` |

- Primary action: **600**. Hover: **700**. Pressed: **800**.
- Active navigation: background **50**, text **800**.
- Focus ring: `0 0 0 3px rgba(71,119,98,.15)` plus a 2px outline in `--focus`.

### 3.2 Accent — Terracotta (use sparingly)

`#D56546` (500). Use for editorial highlights, chart series and the owner's "attention" moments only. It never replaces the primary colour.

### 3.3 Stone — neutrals

| 0 | 25 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#FFFFFF` | `#FCFCFA` | `#F8F8F5` | `#F1F1EC` | `#E4E3DC` | `#D2D0C7` | `#A8A69E` | `#7D7A73` | `#5E5B55` | `#45433E` | `#302F2B` | `#1E1E1B` | `#121310` |

### 3.4 Semantic tokens

| Token | Light | Dark (defined, not shipped in pilot) |
|---|---|---|
| `--background` | `#F8F8F5` | `#151714` |
| `--surface` | `#FFFFFF` | `#1E211E` |
| `--surface-secondary` | `#F1F1EC` | `#272B27` |
| `--surface-selected` | `#F3F7F5` | `#25342C` |
| `--surface-muted` | `#FCFCFA` | `#1A1D1A` |
| `--text-primary` | `#1E1E1B` | `#F3F3EE` |
| `--text-secondary` | `#5E5B55` | `#C8CBC5` |
| `--text-muted` | `#7D7A73` | `#A6AAA3` |
| `--text-inverse` | `#FFFFFF` | `#15231E` |
| `--border` | `#E4E3DC` | `#383C38` |
| `--border-strong` | `#D2D0C7` | `#4B504B` |
| `--focus` | `#477762` | `#76AD91` |

### 3.5 Status colours

Always paired with an icon and a text label.

| Status | Foreground | Background | Used for |
|---|---|---|---|
| success | `#3F795F` | `#EDF7F1` | Approved, Issued, GFC/IFC, resolved |
| warning | `#B7791F` | `#FFF8E6` | Due soon, Coordination, Commented, escalation pending |
| error | `#B54747` | `#FFF0F0` | Overdue, critical, rejected, failed send |
| info | `#52718C` | `#EEF5FA` | In progress: WIP, internal check, client review |
| neutral | `#5E5B55` | `#F1F1EC` | Not started, assigned, superseded |

**Contrast check (WCAG 2.2 AA, normal text 4.5:1):** verify each foreground/background pair in the build. The reference does not record contrast results for these pairs.

---

## 4. Typography

**Family:** `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
**Decision needed (O-D4):** the reference does not load Inter by default, so users may see system fonts. Recommend loading Inter from Google Fonts (one stylesheet) to keep the look consistent across devices. Note: the reference notes the app shouldn't use decorative fonts.

| Role | Size / line height | Weight |
|---|---|---|
| H1 | 32 / 40 (28 / 36 on mobile) | 600 |
| H2 | 24 / 32 | 600 |
| H3 | 20 / 28 | 600 |
| H4 | 18 / 26 | 600 |
| Body large | 16 / 24 | 400 |
| Body | 14 / 21 | 400 |
| Small | 13 / 19 | 400 |
| Caption | 12 / 16 | 500 |
| Eyebrow | 12 / 16, uppercase, letter-spacing 0.06em | 700 |
| Form label | 13 / 18 | 600 |

**Numbers and identifiers** (sheet numbers, revisions, transmittal numbers, dates) use tabular figures so columns align: `font-variant-numeric: tabular-nums`.

---

## 5. Spacing, shape, elevation, motion

- **Spacing:** 4px base. Dominant gaps 16, 24, 32.
- **Radius:** xs 6 · sm 8 (buttons, inputs) · md 12 (cards) · lg 16 (dialogs, empty states) · xl 20 · pill 999.
- **Elevation:** subtle. Hierarchy comes from spacing and borders first.
  - `--shadow-xs: 0 1px 2px rgba(30,30,27,.05)` — cards at rest
  - `--shadow-sm: 0 2px 8px rgba(30,30,27,.06)` — hover
  - `--shadow-md: 0 8px 24px rgba(30,30,27,.08)` — overlays
- **Motion:** 120ms (buttons, inputs), 180ms (cards), 240ms (overlays). Easing `cubic-bezier(.2,.8,.2,1)`.
- **Reduced motion (new requirement):** under `prefers-reduced-motion: reduce`, all transitions and the route/list animations are disabled. The reference does not do this yet, so it must be added.

---

## 6. Layout

### 6.1 Internal app (owner, project heads, leads, drafters, checkers)

**Desktop (≥ 1024px):**
- Sidebar 240px, background Stone 25, right border `--border`, sticky.
- Main area background Stone 50, content max width 1440px, padding 16 / 24 / 32.
- Sidebar top: logo and product name. Middle: navigation. Bottom: user, notifications, sign out.

**Navigation items** (in order):
1. Home (role-based dashboard)
2. Projects
3. Register (sheets)
4. Approvals (with count badge)
5. Issues (clashes, RFIs, submittals)
6. Transmittals
7. Conflicts (with overdue count)
8. Team (admin only)
9. Admin (admin only): settings, rules, SLAs, WhatsApp, exports, audit log

**Mobile (< 1024px):** 64px sticky header, hamburger opens a drawer (300ms), a scrim closes it, all tap targets ≥ 40px.

### 6.2 Client portal

- Simpler shell: top bar with logo, project name selector, notifications and sign out. No sidebar.
- Navigation: Drawings, Transmittals, Conflicts.
- Read-only drawings with a download action. Clients never see internal states such as WIP or Internal check; they see only issued revisions.

### 6.3 List-page anatomy (register, clashes, RFIs, transmittals)

```
page (grid, gap 20)
├── page header     eyebrow (project) · H1 · description · actions (secondary + primary)
├── filter bar      search | project | discipline | status | owner | [Clear]
├── saved views     (optional, P1) tabs: All · Overdue · My sheets · Waiting for approval
└── table card      sortable table, sticky header, paginator, row actions
```

- Filters collapse to two columns ≤ 980px and one column ≤ 639px.
- **On mobile, tables become a card list** (one card per row, key fields first). Table scrolling sideways is not acceptable for status-heavy data.

---

## 7. Components

### 7.1 Existing library (copy from reference)

| Component | Selector | Notes for this product |
|---|---|---|
| Button | `ds-button` | `variant`: primary, secondary, ghost, danger. `size`: sm 36px, md 40px, lg 44px. `loading` sets `aria-busy`. |
| Card | `ds-card` | `padding`: sm 16, md 20, lg 24. `interactive` for clickable cards. Never nest cards. |
| Badge | `ds-badge` | `tone`: neutral, brand, success, warning, error, info. `dot` adds an indicator. |
| Avatar | `ds-avatar` | Initials derived from name. Use for owners, approvers and conflict authors. |
| Page header | `ds-page-header` | `title`, `description`, `eyebrow` (project name). Actions in `dsPageActions`. |
| Empty state | `ds-empty-state` | `title`, `description`, `icon`. Always offers the next action. |
| Form field | `ds-form-field` | Label, hint, error (`role="alert"`), required marker. Wraps the native control. |

**Rule from reference:** new code uses `ds-*` before any hand-built equivalent. Colours come only from tokens.

**Decision needed (O-D5):** the reference library uses inline templates and styles. The reference team rule is separate files for feature components. Recommend: separate files for everything in this product, including `ds-*`, so there's one rule.

### 7.2 Components to build (gaps)

These are listed in the reference as "not built, fall back to PrimeNG." This product needs them, so they're built as `ds-*` wrappers:

| Component | Purpose |
|---|---|
| `ds-tabs` | Sheet detail (Overview, Revisions, Files, Comments, History) |
| `ds-table` | Wrapper around PrimeNG table with the list-page styles, sort, paginator, empty and loading states |
| `ds-timeline` | Revision history, status history, conflict messages |
| `ds-alert` | Inline messages (import errors, rule blocks) |
| `ds-drawer` | Mobile navigation, side detail panels |
| `ds-breadcrumb` | Project › Sheet › Revision |
| `ds-icon-button` | Row actions (32×32), always with `aria-label` |
| `ds-dropdown-button` | Secondary actions menus |
| `ds-file-upload` | Drag and drop plus file picker, shows size, format and naming warning |
| `ds-skeleton` | Loading shaped like the final content |
| `ds-confirm-dialog` | Destructive actions (delete, export and delete, reject) |

### 7.3 Domain components (drawing control)

These represent concepts from the product. Each one composes `ds-*` and never restyles their fundamentals.

| Component | Composes | Shows |
|---|---|---|
| `SheetCard` | Card, Badge, Avatar | Sheet number, title, discipline, revision, state, owner, due date |
| `SheetStateBadge` | Badge | Lifecycle state with icon and text (section 8) |
| `RevisionTimeline` | Timeline | Revisions of one sheet: code, date, who, status, transmittal |
| `ApprovalCard` | Card, Avatar, Button | What needs approving, who requested it, due date, Approve / Reject |
| `RejectDialog` | Dialog, FormField | Requires a text reason before rejecting |
| `ConflictThread` | Timeline, FormField | Back-and-forth conversation between client and firm |
| `ConflictForm` | FormField, FileUpload | Subject, content, attachments |
| `TransmittalSummary` | Card, Badge | Number, date, recipient, revision count |
| `ClashRow` | Table row, Badge | Clash title, disciplines, priority, age, status |
| `RegisterImportPreview` | Table, Alert | Rows OK, errors by row, Confirm / Cancel |
| `CriticalRuleEditor` | FormField, Select | Owner-defined rules (admin only) |
| `SlaEditor` | FormField, Select | Working-day SLAs per project (admin) |
| `DigestPreview` | Card | Exactly what will be sent on WhatsApp, with character count |
| `DrawingViewer` | (wraps Autodesk Viewer SDK) | Loading, error, and fallback message |
| `PdfViewer` | (wraps PDF.js) | Pages, zoom, download where allowed |
| `NotificationBell` | Button, Badge, Drawer | Unread count and list |

---

## 8. Status vocabulary

Every sheet state has a fixed tone and a fixed label. The label is always shown.

| State | Tone | Icon (PrimeIcons) | Label |
|---|---|---|---|
| Not started | neutral | `pi-circle` | Not started |
| Assigned | neutral | `pi-user` | Assigned |
| WIP | info | `pi-pencil` | In progress |
| Internal check | info | `pi-eye` | Internal check |
| Coordination | warning | `pi-sitemap` | Coordination |
| Approved | success | `pi-check` | Approved |
| Issued | success | `pi-send` | Issued |
| Client review | info | `pi-comments` | Client review |
| Commented | warning | `pi-comment` | Commented |
| Revised | info | `pi-refresh` | Revised |
| GFC | success | `pi-verified` | Good for construction |
| IFC | success | `pi-verified` | Issued for construction |
| Superseded | neutral | `pi-history` | Superseded |
| Overdue (flag) | error | `pi-exclamation-triangle` | Overdue |
| Critical (flag) | error | `pi-flag` | Critical |

**Note on label wording:** "In progress" replaces the internal name "WIP" in the UI. The internal code stays `wip`. Confirm wording with the owner (O-D6).

---

## 9. Accessibility (WCAG 2.2 AA)

- Visible focus on every interactive element (2px outline, offset 2px).
- Full keyboard operation: tabs, tables (arrow keys between rows, Enter to open), dialogs (focus trap, Esc to close, focus returns to the trigger).
- Every field has a visible label. Hints and errors are linked with `aria-describedby`.
- Errors appear next to the field and are announced (`role="alert"`). The first error gets focus on submit.
- States use icon and text as well as colour (section 8).
- Tables have proper `<th scope>`, captions and sort state in `aria-sort`.
- Targets at least 40px on touch screens.
- Motion is short and disabled under reduced-motion settings.
- Images and icons: decorative icons `aria-hidden="true"`. Drawing previews have a text alternative: sheet number, title and revision.
- Timestamps are shown in IST with the time zone name where ambiguous.

---

## 10. Content and voice

- **English, plain and direct.** No marketing language. No exclamation marks.
- **Name the object and the state:** "M-101 R2 is waiting for approval from Priya Nair." Not "Something needs your attention."
- **Explain blocked actions:** "You can't issue M-101 yet. It has 1 open critical clash (CL-044)." 
- **Empty states offer the next step:** "No sheets yet. Import the register or add the first sheet."
- **Errors say what to do:** "Sheet number M-101 already exists in this project. Use a different number or open the existing sheet."

### 10.1 WhatsApp copy rules

- Under 300 characters where possible. Each message ends with one link to the dashboard.
- Numbers and identifiers come from the database only.
- Never include client-written text (decision 10). Conflict messages say only who raised it, on which project, and the link.
- Never include a drawing file.
- Sign-off line: none. Messages come from the system, not a person.

Sample copy is in FEATURES.md, Appendices A and B.

---

## 11. Responsive rules

| Breakpoint | Behaviour |
|---|---|
| ≥ 1440px | Content capped at 1440px |
| 1024–1439px | Full sidebar, full tables |
| 640–1023px | Drawer navigation, tables show priority columns; others in the row detail |
| < 640px | Single-column layout, tables become card lists, actions go full width |

---

## 12. Dark mode

- Tokens are defined (section 3.4) and the `.dark` class is supported by the PrimeNG preset.
- **The pilot ships light mode only** (O-D3). Dark mode needs its own contrast and screen review, which the reference never completed.

---

## 13. Reference rules we keep

1. Solve hierarchy with spacing and type before adding a card.
2. No cards inside cards.
3. Tables only for real comparison of rows.
4. State never relies on colour alone.
5. Split long forms into labelled groups (for example, Sheet details, Discipline, Owner and dates).
6. Destructive actions are explicit: red button, confirm dialog, consequences stated.
7. AI features have no separate visual style: no neon, gradients or robot icons. AI-generated text is labelled "Summary generated by Gemini" wherever it appears.

---

## 14. Known issues to fix while porting

| Issue in reference | Fix here |
|---|---|
| Inter not loaded, falls back to system font | Load Inter (O-D4) |
| `ds-*` uses inline templates; team rule says separate files | One rule (O-D5) |
| Per-page `::ng-deep` table restyling | Move into the PrimeNG preset (`components: { datatable: … }`) once |
| Runtime branding overwrites Tailwind primary but not `--brand-*` | Not applicable: no white-label |
| No reduced-motion support | Add (section 5) |
| Source package versions mixed (20.3.15 and 20.3.32) | Pin all `@angular/*` to one exact version at build time |
| PrimeNG Quill editor used for rich text | Not needed: conflict content is plain text (decision 22) |
| Domain components are therapy-specific | Replaced (section 7.3) |

---

## 15. Design QA checklist (per screen)

- [ ] Every state has icon, text and colour.
- [ ] Every sheet reference shows its revision.
- [ ] Primary action is one button and says what happens next.
- [ ] Empty, loading and error states exist.
- [ ] Keyboard only: can reach and use everything.
- [ ] Mobile width: no horizontal scroll.
- [ ] Reduced motion: no animation essential to understanding.
- [ ] No Portuguese or non-English text.
- [ ] Times shown in IST.
- [ ] Contrast checked for every new colour pairing.

---

## 16. Open design decisions

| ID | Question | Recommendation |
|---|---|---|
| O-D1 | Keep the Sage/Stone palette and the "Calma estruturada" name for this product, or a new brand? | Keep for the pilot. It suits the tone. Rename the direction when the product gets its own brand. |
| O-D3 | Dark mode in the pilot? | No. Ship light only. |
| O-D4 | Load Inter from Google Fonts? | Yes. |
| O-D5 | Separate template files for all components? | Yes. |
| O-D6 | Show "In progress" instead of "WIP"? | Yes, after owner confirms. |

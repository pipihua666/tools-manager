---
name: Tools Manager
description: A light desktop telemetry workstation for local AI-agent operations
colors:
  workstation-ink: "#1d2521"
  secondary-text: "#66716b"
  telemetry-text: "#59655f"
  divider: "#e0e5e2"
  divider-strong: "#cbd3cf"
  desktop-field: "#dfe5e2"
  workspace: "#eef2f0"
  panel: "#ffffff"
  panel-soft: "#f5f7f6"
  panel-hover: "#f0f5f2"
  input-field: "#fbfcfb"
  navigation-rail: "#edf1ef"
  status-lime: "#bdf36b"
  status-green: "#6da926"
  status-text: "#426f16"
  focus-teal: "#2e7d70"
  feedback-dark: "#202824"
  danger-soft: "#fff1ef"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
  label:
    fontFamily: '"Berkeley Mono", "SFMono-Regular", Menlo, Consolas, monospace'
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  tag: "5px"
  control: "8px"
  navigation: "9px"
  panel: "12px"
  dialog: "14px"
  window: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  panel: "22px"
  workspace: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.status-lime}"
    textColor: "{colors.workstation-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.workstation-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
    height: "36px"
  input:
    backgroundColor: "{colors.input-field}"
    textColor: "{colors.workstation-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.workstation-ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
  nav-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.workstation-ink}"
    rounded: "{rounded.navigation}"
    padding: "9px 12px"
    height: "42px"
---

# Design System: Tools Manager

## Overview

**Creative North Star: "The Desktop Telemetry Workstation"**

Tools Manager should feel like a focused local application opened for recurring operational work, not a themed command console or a marketing dashboard. A cool-gray desktop field frames one light application window; inside it, a fixed navigation rail, a stable page toolbar, and quiet white work surfaces make agent state, local resources, and usage telemetry easy to scan.

The visual hierarchy comes from nested application layers rather than heavy contrast: desktop, window, navigation rail, workspace, then panels. Soft green marks readiness, selection, and successful action, while teal is reserved for keyboard focus and navigational attention. Dense tables and compact controls remain calm because spacing, alignment, and shallow elevation are consistent.

**Key Characteristics:** light desktop application frame; fixed workstation navigation; compact telemetry hierarchy; low-elevation white panels; status-led green accents; state-driven motion only.

## Colors

The palette is a cool, near-neutral workstation field with white working surfaces and restrained botanical status colors; dark surfaces appear only for transient high-contrast feedback such as menus and toasts.

### Primary
- **Status Lime:** Marks primary actions, checked controls, and affirmative state without becoming a page background.
- **Status Green:** Provides the stronger edge, indicator, or active-rail cue required to keep pale lime legible.
- **Status Text:** Carries readable green emphasis on light surfaces.

### Secondary
- **Focus Teal:** Identifies focused fields, linked names, and keyboard-visible interaction.

### Neutral
- **Workstation Ink:** Primary copy, titles, and high-confidence values.
- **Secondary Text:** Supporting descriptions and labels.
- **Telemetry Text:** Paths, notes, and compact operational metadata.
- **Desktop Field:** The outer canvas visible around the application window.
- **Workspace:** The main scrolling work area.
- **Navigation Rail:** The fixed local navigation layer.
- **Panel:** Canonical working surface for metrics, tables, and detail regions.
- **Panel Soft / Panel Hover:** Quiet tonal separation and row feedback.
- **Divider / Divider Strong:** Structural rules between dense controls and data regions.
- **Feedback Dark:** Reserved for transient overlays that must remain distinct from the light workstation.

### Named Rules
**The Work Surface Rule.** The desktop, application shell, workspace, and panel must remain visibly distinct light layers; no single neutral should flatten all four.

**The Status, Not Decoration Rule.** Green appears because a control is active, a process is ready, or an action is affirmative. It is not ambient decoration.

## Typography

**Display Font:** System display sans (`-apple-system`, BlinkMacSystemFont, `SF Pro Display`, `Segoe UI`, sans-serif)
**Body Font:** System text sans (`-apple-system`, BlinkMacSystemFont, `SF Pro Text`, `Segoe UI`, sans-serif)
**Label/Mono Font:** Berkeley Mono with SFMono, Menlo, and Consolas fallbacks

**Character:** Native system typography makes the frame read as installed desktop software. Monospace is a secondary instrument for paths, counts, state labels, and configuration values, never the dominant voice.

### Hierarchy
- **Display** (700, 20px, 1.2): Page titles in the fixed toolbar.
- **Title** (700, 16px, 1.25): Section and panel headings; agent identity titles may rise to 18px.
- **Metric** (700, 32-36px, 1): Tabular telemetry values and usage totals.
- **Body** (400, 13px, 1.4): Tables, forms, descriptions, and dialog content.
- **Label** (700, 9-11px, 1.2): Operational labels, metadata, table headings, and status text.

### Named Rules
**The Native Voice Rule.** Use the system sans for all navigation and hierarchy. Reserve mono type for data that benefits from fixed-width scanning.

## Layout

On desktop, the product sits inside a viewport-filling application window with 12px of outer desktop field and a 36px window chrome. The application body uses a fixed 224px navigation rail and a flexible workspace. The main column holds a fixed 76px top toolbar above one independently scrolling content region with 24px padding.

Telemetry panels use explicit grids: dashboard metrics begin as three columns, while agent usage uses four equal columns. At 1100px the usage grid becomes two columns. At 900px the outer frame, window chrome, and split application layout collapse into a single document flow; at 560px content padding becomes 14px and metric grids stack. Data tables may scroll horizontally rather than compressing identifiers beyond recognition.

**The Stable Frame Rule.** Navigation and toolbar stay spatially fixed while the workspace content changes; route changes must not resize or recompose the frame.

## Elevation & Depth

Depth is shallow and functional. The outer desktop window receives the strongest ambient shadow, dialogs float above a dimmed backdrop, and ordinary panels use a low diffuse shadow plus a cool border. Navigation selection and segmented controls use smaller local shadows. Dividers and tonal layering do most of the structural work.

### Shadow Vocabulary
- **Window Ambient** (`0 24px 70px rgba(27, 38, 32, .22), 0 2px 8px rgba(27, 38, 32, .08)`): Separates the application from the desktop field.
- **Dialog Ambient** (`0 22px 60px rgba(31, 43, 37, .16)`): Used only for modal focus.
- **Panel Low** (`0 6px 20px rgba(35, 48, 41, .05)`): Gives tables and ordinary panels just enough separation from the workspace.
- **Telemetry Low** (`0 8px 26px rgba(35, 48, 41, .055)`): Unifies grouped metric cells without making them look like separate cards.
- **Control Lift** (`0 2px 7px rgba(25, 36, 30, .08)`): Indicates a selected segment or active local control.

### Named Rules
**The Low-Elevation Rule.** Panels rest close to the workspace. Strong elevation belongs only to the desktop window, dialogs, and transient overlays.

## Shapes

The system uses gently rounded rectangles that echo a desktop utility: 8px controls, 9px navigation and segmented groups, 12px panels, 14px dialogs, and a 16px outer window. Tags use a tighter 5px radius, while status dots, toggles, and agent targets may be circular. Borders stay at 1px and use cool gray rather than black.

**The Nested Radius Rule.** Radius increases with layer size: compact status elements are tighter, controls are medium, panels are broader, and the application window is broadest.

## Components

### Buttons
- **Shape:** Compact native controls with an 8px radius and a 36px minimum height.
- **Primary:** Pale status lime with workstation ink, a green border, and a small lifted shadow.
- **Secondary:** White with a strong cool-gray border and minimal elevation.
- **Hover / Focus:** Hover raises by 1px; primary hover raises by 2px. Keyboard focus uses a 3px translucent teal outline with 2px offset.
- **Danger / Ghost:** Danger is red-on-soft-red; ghost removes the border and surface until interaction.

### Chips
- **Style:** Compact mono labels with 5px corners, a thin border, and tonal fills for neutral, green, amber, or red state.
- **State:** Chips report scope or status. They do not act as general-purpose buttons.

### Cards / Containers
- **Corner Style:** Gently rounded panels (12px), with grouped detail surfaces allowed at 14px.
- **Background:** White over the cool workspace; the lead metric may use a barely green-tinted white.
- **Shadow Strategy:** Panel Low for tables and ordinary panels; Telemetry Low for grouped metric blocks.
- **Border:** One cool-gray divider stroke.
- **Internal Padding:** 22px for standard panels and 28px for large telemetry cells.

### Inputs / Fields
- **Style:** Near-white field, strong cool-gray border, 8px radius, 44px minimum height, and 10px by 12px padding.
- **Focus:** Teal border with a translucent 3px ring; the field becomes pure white.
- **Error / Disabled:** Destructive meaning uses soft red; disabled controls reduce opacity but retain their geometry.

### Navigation
- **Style:** A 224px light rail inside the application frame. Rows are 42px high with 9px corners and system sans labels.
- **State:** Hover adds a translucent white surface. Active navigation becomes white with a low shadow and a narrow green inset at the leading edge.
- **Mobile:** Below 900px, the established compact navigation flow replaces the fixed rail and the decorative window chrome disappears.

### Segmented Filters
- **Style:** Controls sit in a slightly darker recessed tray with a 9px outer radius and 6-7px inner segments.
- **State:** The selected segment becomes white with a local shadow. Counts receive a pale green fill only when selected.

### Telemetry Grid
- **Style:** Equal cells share one white bordered panel. Large values use tabular numerals; supporting labels and notes stay quiet.
- **State:** Fresh values settle once when data arrives; loading uses restrained tonal skeletons.

### Tables
- **Style:** White 12px container, softly tinted sticky header, generous 13px by 14px cells, and one-pixel row dividers.
- **State:** Hover uses a pale cool-green row fill and a 2px green leading indicator; focus-within uses a pale teal tint.

## Do's and Don'ts

### Do:
- **Do** preserve the four nested light layers: desktop field, application window, workspace, and white panels.
- **Do** keep navigation and top toolbar fixed while the workspace scrolls and routes change.
- **Do** use green only for readiness, active state, successful action, and live telemetry.
- **Do** animate state changes only: one workspace View Transition per route change, one-time value settling, loading skeletons, dialogs, menus, and feedback.
- **Do** honor reduced motion by removing animation and retaining a visible static focus or active state.

### Don't:
- **Don't** reintroduce a dark graphite sidebar or turn lime into a large console-style brand field.
- **Don't** wrap every section in a floating card; use panels for actual data or tool surfaces.
- **Don't** add looping ambient motion, page-load choreography, decorative parallax, or repeated route animations inside the same transition.
- **Don't** use oversized marketing typography, pill-shaped text buttons, or soft consumer-app ornament in this operational workstation.
- **Don't** compress dense tables until paths and identifiers become unreadable; preserve horizontal access instead.

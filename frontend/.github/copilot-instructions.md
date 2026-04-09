**STRICT UI RULES**:

NEVER use hardcoded Tailwind colors like 'bg-slate-xxx', 'bg-zinc-xxx', or 'bg-black'.

ONLY use the CSS variables defined in globals.css (e.g., use 'bg-background', 'bg-card', 'border-border').

use global css folder


EVALON Project: System Instructions & Coding Standards
1. Core Mission & Design Philosophy
Project: EVALON (AI-Powered Multi-Asset Terminal).
Aesthetic: Strict TradingView Dark Mode fidelity.
Vibe: Professional, high-density data, minimalist, and high-performance.
Rule: Every UI element must look like it belongs in a $1000/month financial terminal. No "cheap" or "generic" web designs.
2. Strict Styling & Color Governance (NO EXCEPTIONS)
ABSOLUTE FORBIDDEN: Do not use hardcoded hex codes (#123456) or default Tailwind color classes (e.g., bg-slate-900, text-blue-500, bg-zinc-800).
MANDATORY: Use ONLY the semantic CSS variables defined in globals.css.

3. Atomic Component Architecture
Atomicity: Even the smallest repeating element (a button, a badge, a table cell) must be its own component in src/components/ui.
DRY (Don't Repeat Yourself): If you are about to write a button style twice, stop and create/use a reusable component.
Button Standards: All buttons must derive from a central BaseButton or Shadcn-based Button component to ensure consistent padding, hover effects, and font weights.
4. Feature-First Folder Structure (Scalability for 25+ Pages)
Organize the codebase by Features, not by file types. This prevents file bloat and manages complexity.
src/components/ui/: Stateless, generic atoms (Buttons, Inputs, Checkboxes).
src/components/layout/: Global skeleton (Sidebar, Navigation, TopBar).
src/features/[feature-name]/: Independent logic modules (e.g., features/analysis, features/backtest).
components/: Feature-specific UI (e.g., SignalCard.tsx).
hooks/: Feature-specific logic (e.g., useStockData.ts).
services/: Specific API calls for that feature.
src/store/: Global state (Zustand).
7. AI Behavior Protocol
Analyze: Before writing code, check globals.css and the /features folder to understand existing patterns.
Modularize: If a file exceeds 120 lines, break it into smaller sub-components.
Consistency Check: Ensure the background is always #131722. If you see a blue-ish tint in a dark background, revert it to the base background variable.
Professional UI: Add subtle hover effects (transition-colors), clean typography (Inter), and 1px borders (border-border).


şuanlık mock data kullanıcaz. ama gerçek veriye dönüştürmeye hazır bir yapı olmalı her zaman.

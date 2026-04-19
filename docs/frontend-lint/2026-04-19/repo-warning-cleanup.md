# Summary
Cleaned the remaining frontend lint warnings outside the community feature on a dedicated branch. The pass focused on low-risk hygiene changes such as removing unused imports and variables, tightening hook dependencies, and keeping existing image behavior where optimizer migration was unnecessary.

# Change List
- Modified `frontend/components/dashboard/portfolio-chart.tsx`
- Modified `frontend/components/ui/select-native.tsx`
- Modified `frontend/data/types.ts`
- Modified `frontend/features/backtest/backtest-view.tsx`
- Modified `frontend/features/brokers/brokers-view.tsx`
- Modified `frontend/features/calendar/calendar-view.tsx`
- Modified `frontend/features/landing/hero-section.tsx`
- Modified `frontend/features/landing/landing-navbar.tsx`
- Modified `frontend/features/landing/market-overview-section.tsx`
- Modified `frontend/features/landing/pricing-section.tsx`
- Modified `frontend/features/news/news-view.tsx`
- Modified `frontend/features/notifications/notifications-view.tsx`
- Modified `frontend/features/profile/profile-view.tsx`
- Modified `frontend/features/screener/screener-view.tsx`
- Modified `frontend/features/stocks/stock-detail-view.tsx`
- Modified `frontend/features/support/support-view.tsx`
- Modified `frontend/src/components/layout/Sidebar.tsx`

# Technical Details
- Removed unused imports, state, and derived values across dashboard, landing, widget, and utility components.
- Normalized the backtest rule catalog flow so hook dependencies are memo-safe and no longer trigger `react-hooks/exhaustive-deps`.
- Removed unused pricing-card props that were being passed but never consumed.
- Kept profile avatar rendering on a native `img` element with a targeted lint suppression to avoid changing external image behavior during a cleanup-only pass.
- Left runtime behavior unchanged where possible; this was a lint hygiene pass, not a UX refactor.

# Checklist
1. Run `npm run lint` inside `frontend` and confirm it exits without warnings or errors.
2. Run `npm run build` inside `frontend` and confirm all routes still compile.
3. Smoke-test landing, backtest, screener, profile, news, notifications, and sidebar surfaces for basic rendering.
4. Verify the profile avatar still renders correctly for authenticated users.

# Known Issues / Gaps
- This pass does not change any backend or API behavior.
- The remaining Next.js workspace-root warning during build is unrelated to ESLint and was intentionally left unchanged.

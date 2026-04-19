# Summary
Cleaned the remaining community-specific lint warnings on `main` without changing runtime image behavior. The composer preview and post hero media keep using native `img` rendering because they depend on blob previews and Firebase-hosted public URLs.

# Change List
- Modified `frontend/features/community/components/community-composer.tsx`
- Modified `frontend/features/community/components/community-post-card.tsx`

# Technical Details
- Added targeted `@next/next/no-img-element` suppressions only around the two community image surfaces.
- Kept the existing rendering model intact:
  - composer preview still supports local `blob:` URLs from pasted/uploaded images
  - feed/detail cards still render Firebase Storage public image URLs directly
- Avoided a forced `next/image` migration on `main` because that would require separate loader/config decisions and carried unnecessary merge risk for a lint-only pass.

# Checklist
1. Run `npm run lint` inside `frontend` and confirm the community image warnings no longer appear.
2. Run `npm run build` inside `frontend` and confirm the community routes still compile.
3. Open `/community` and verify composer image preview still works after upload/paste.
4. Open a post with media in feed and detail views and confirm the hero image still renders.

# Known Issues / Gaps
- This change only removes the community-specific warnings.
- Repo-wide non-community warnings are intentionally left for a separate cleanup branch.

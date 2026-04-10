# Performance Baseline Report

Date: 2026-04-10

## Scope

- App build output size review
- Initial optimization pass for heavy UI areas
- Identify next Lighthouse and Core Web Vitals actions

## Implemented in this pass

- Added member selection search and frequency sorting to reduce interaction cost on large groups.
- Added reusable avatar grouping component to reduce repeated render branches.
- Added responsive constraints for treemap and mobile-only bottom navigation.

## Pending Measurements

Run these commands locally after deploying a preview URL:

```bash
npm run build
npm run preview
npx lighthouse http://localhost:4173 --view
```

## Next optimization targets

1. Route-level lazy loading for group detail tabs and personal detail pages.
2. Virtualized expense/activity list rendering when records exceed 100 items.
3. Image optimization pipeline for uploaded receipts (worker-side resize/compress).
4. Add Lighthouse CI in GitHub Actions with budget thresholds.

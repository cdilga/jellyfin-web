# AGENTS.md — cdilga/jellyfin-web fork

This is a private fork of [jellyfin/jellyfin-web](https://github.com/jellyfin/jellyfin-web)
containing custom UI modifications. The server (`jellyfin/jellyfin`) is **not forked** — this
repo only changes the frontend. Docker images are built in
[cdilga/jellyfin-fork](https://github.com/cdilga/jellyfin-fork) and deployed to TrueNAS SCALE.

---

## Tech Stack

- **React** (functional components, hooks throughout)
- **TypeScript** — strict, use types from `@jellyfin/sdk`
- **TanStack Query** — all API data fetching via hooks in `api/` subdirectories
- **React Router** — page routing
- **Vite** — build tool (`npm run build` → `dist/`)
- **Legacy web components** — `emby-scroller`, `emby-itemscontainer` still used in some places
  (mixed React + custom elements, fragile — avoid expanding usage of these)

---

## Repository Layout (relevant paths)

```
src/
  apps/stable/
    routes/search.tsx                    ← search page entry point
    features/search/
      api/
        fetchItemsByType.ts              ← base API fetch
        useSearchItems.ts                ← main hook: aggregates all search sections
        useArtistsSearch.ts              ← artists/bands section
        usePeopleSearch.ts               ← actors/people section
        useLiveTvSearch.ts
        useProgramsSearch.ts
        useVideoSearch.ts
        useSearchSuggestions.ts
      components/
        SearchFields.tsx                 ← search input bar
        SearchResults.tsx                ← renders section list
        SearchResultsRow.tsx             ← ONE horizontal scroll row (TARGET FOR OVERHAUL)
        SearchSuggestions.tsx
      constants/
        queryOptions.ts                  ← API query defaults (result limits live here)
        sectionSortOrder.ts              ← section display order
        liveTvCardOptions.ts
      types.ts                           ← Section type definition
      utils/search.ts                    ← section helpers, type→title mapping

  components/
    cardbuilder/
      Card/                              ← modern React card components
        Card.tsx                         ← top-level card component
        CardImageContainer.tsx           ← image area (BIF/chapter cycling goes here)
        CardHoverMenu.tsx                ← hover overlay
        useCard.ts
        useCardImageUrl.ts               ← resolves image URL from item
        Cards.tsx                        ← renders a list of Card components
      cardBuilder.ts                     ← legacy imperative card builder (used by SearchResultsRow)
```

---

## Planned Modifications

### 1. Search — Dense Infinite-Scroll Grid

**Current behaviour:**
- `SearchResults.tsx` renders sections (Movies, Shows, Episodes, etc.)
- Each section is a `SearchResultsRow` — a horizontal scroll strip using the legacy
  `emby-scroller` web component with `data-horizontal="true"`

**Target behaviour:**
- Single unified dense vertical grid (no per-section horizontal rows for media content)
- Infinite scroll — load more results as user scrolls to bottom
- Smaller cards — far more items visible per screen
- Sections for people/actors/artists preserved but **hidden by default**, toggled via toolbar

**Key files to modify:**
- `SearchResultsRow.tsx` — replace horizontal scroller with vertical grid layout
- `SearchResults.tsx` — add infinite scroll logic, restructure section rendering
- `queryOptions.ts` — increase page size for API requests
- `searchfields.scss` + new grid stylesheet — CSS for dense layout

**Infinite scroll approach:** use an `IntersectionObserver` on a sentinel element at the
bottom of the grid, trigger TanStack Query's `fetchNextPage` from `useInfiniteQuery`.
This requires refactoring `useSearchItems` to use `useInfiniteQuery`.

---

### 2. People / Actors Section — Toolbar Toggle

**Current behaviour:** `usePeopleSearch` and `useArtistsSearch` results appear inline as
section rows alongside media results.

**Target behaviour:**
- People/artists sections hidden by default
- Toolbar button/toggle in `SearchFields.tsx` enables them
- When enabled, people results appear (probably below media results, or as a separate section)

**Key files to modify:**
- `SearchFields.tsx` — add toolbar toggle button
- `SearchResults.tsx` — pass `showPeople` flag down, conditionally render people sections
- `useSearchItems.ts` — conditionally include people/artists queries

---

### 3. Chapter Image Cycling on Cards

**Current behaviour:** Cards show a single poster/backdrop image. No animation.

**Target behaviour:**
- On load (or hover), cards cycle through the item's **chapter images** automatically
- Chapter images are fetched from the Jellyfin API:
  `GET /Items/{itemId}/Images/Chapter/{chapterIndex}`
- After initial chapter images are loaded client-side, upgrade to **trickplay / BIF frames**
  for smoother, denser cycling

**Jellyfin Trickplay API** (v10.9+, prefer this over raw .bif parsing):
- `GET /Videos/{itemId}/Trickplay/{width}/tiles.m3u8` — HLS trickplay manifest
- `GET /Videos/{itemId}/Trickplay/{width}/{index}.jpg` — individual tile images
- Check availability: `GET /Items/{itemId}` → `TrickplayInfos` field
- Falls back gracefully to chapter images if trickplay not generated for an item

**Key files to modify:**
- `CardImageContainer.tsx` — add cycling logic (useState for current image index,
  setInterval or requestAnimationFrame for cycling)
- `useCardImageUrl.ts` — may need extension to support chapter/trickplay URL arrays
- New hook: `useChapterImages.ts` or `useTrickplayFrames.ts`

**Open questions for owner — see below.**

---

## Open Questions (need owner input before implementing)

### BIF / Trickplay cycling UX
1. **Trigger**: Does cycling start on hover, or automatically when card enters viewport?
2. **Speed**: How fast should frames cycle? (e.g. 1 frame/second for chapters, faster for trickplay?)
3. **Trickplay vs BIF**: The server has a built-in Trickplay API (10.9+) which is cleaner than
   parsing raw `.bif` files. Should we use the Trickplay API, or do you specifically want `.bif`
   file parsing? (Trickplay recommended — `.bif` is a Roku legacy format.)
4. **Fallback**: If an item has no chapter images and no trickplay data, show static poster only?

### Grid density
5. **Card size**: How small should cards be? Approximate cards-per-row target? (e.g. 8, 10, 12 on
   a 1080p display?) Or should it be fluid/responsive with a `minmax` CSS grid?
6. **Aspect ratio**: Should all cards in the dense grid use a consistent shape (portrait poster,
   landscape, square), or preserve per-type shapes?

### Result counts / infinite scroll
7. **Page size**: How many results to load per "page" in infinite scroll? (e.g. 50, 100?)
8. **Section separation**: In the dense grid, should Movies / Shows / Episodes be intermixed in
   a single stream, or still grouped by type with a small section header above each group?

### People section toolbar
9. **Toggle state**: Should the people/actors toggle persist across sessions (localStorage), or
   always default to off on page load?

---

## Development Workflow

```bash
# Install
cd /path/to/jellyfin-web
npm ci

# Dev server (needs a running Jellyfin server to proxy API calls)
# Set JELLYFIN_SERVER_URL in .env or pass via env
npm start

# Production build
npm run build
# Output → dist/ (this is what gets COPYd into the Docker image)

# Lint
npm run lint

# Tests
npm test
```

### Connecting dev server to TrueNAS Jellyfin
Set up a `.env.local`:
```
JELLYFIN_SERVER_URL=http://<truenas-ip>:8096
```
The Vite dev server proxies API calls to the live server, so you develop against real data.

---

## Deployment Flow

```
Push to cdilga/jellyfin-web (this repo)
    ↓ (no CI here — CI lives in jellyfin-fork)

Trigger build in cdilga/jellyfin-fork
    → GitHub Actions: npm ci + npm run build + Docker build
    → Pushes ghcr.io/cdilga/jellyfin:{version}-fork.{n}

TrueNAS SCALE Custom App
    → Update image tag → redeploy
    → ZFS snapshot of /mnt/tank/jellyfin/config taken before upgrade
```

To trigger a build manually after pushing web changes:
```bash
gh workflow run build.yml --repo cdilga/jellyfin-fork
```

---

## Staying Current with Upstream

The upstream remote is already configured (`upstream/master`, `upstream/release-10.x.z`).

```bash
# Rebase onto a new upstream release tag
git fetch upstream
git rebase upstream/release-10.12.z

# Resolve conflicts — most will be in:
#   src/apps/stable/features/search/
#   src/components/cardbuilder/Card/

git push origin master
```

Conflict surface is intentionally small — all custom code is in the files listed above.
Avoid modifying files outside the search feature and Card components unless strictly necessary.

---

## Constraints and Notes

- **Do not** use `any` — the `@jellyfin/sdk` types are comprehensive, use them
- **Do not** expand use of `emby-scroller` / legacy web components — these are being phased out
- **Do not** add new server-side changes — the server is the official unmodified image
- Keep custom code in clearly marked sections or separate files where possible to reduce
  rebase friction
- The `SearchResultsRow` horizontal scroller uses `dangerouslySetInnerHTML` due to
  React/web-component compatibility issues — this is known and acceptable to replace entirely

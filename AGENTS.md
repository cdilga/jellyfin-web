# AGENTS.md — cdilga/jellyfin-web fork

This is a private fork of [jellyfin/jellyfin-web](https://github.com/jellyfin/jellyfin-web)
containing custom UI modifications. The server (`jellyfin/jellyfin`) is **not forked** — this
repo only changes the frontend. Docker images are built in
[cdilga/jellyfin-fork](https://github.com/cdilga/jellyfin-fork) and deployed to TrueNAS SCALE.

**Active branch:** `release-10.11.z` — tracks the stable 10.11.x series, matches server image
`jellyfin/jellyfin:10.11.6`. `master` is the upstream development branch and is not used for
custom work.

---

## Tech Stack

- **React** (functional components, hooks throughout)
- **TypeScript** — strict, use types from `@jellyfin/sdk`
- **TanStack Query** — all API data fetching via hooks in `api/` subdirectories
- **React Router** — page routing
- **Webpack** — build tool (not Vite on this branch — `npm run build:production` → `dist/`)
- **Legacy web components** — `emby-scroller`, `emby-itemscontainer` still present in some
  areas — avoid expanding usage, they're being phased out upstream

---

## Repository Layout (relevant paths)

```
src/
  apps/stable/
    routes/search.tsx                    ← search page entry point, showPeople state
    features/search/
      api/
        fetchItemsByType.ts              ← base API fetch for media items
        useSearchItems.ts                ← aggregates all search sections
        useArtistsSearch.ts              ← artists/bands section
        usePeopleSearch.ts               ← actors/people section
        useLiveTvSearch.ts
        useProgramsSearch.ts
        useVideoSearch.ts
        useSearchSuggestions.ts
      components/
        SearchFields.tsx                 ← search input + people toggle button
        SearchResults.tsx                ← renders SearchDenseGrid, accepts showPeople
        SearchDenseGrid.tsx              ← [CUSTOM] dense CSS grid with infinite scroll
        SearchResultsRow.tsx             ← original horizontal scroll row (no longer used
                                            in search, kept for potential other uses)
        SearchSuggestions.tsx
        searchgrid.scss                  ← [CUSTOM] grid layout styles
        searchfields.scss                ← existing search bar styles
      constants/
        queryOptions.ts                  ← API query defaults + ItemFields.Chapters added
        sectionSortOrder.ts
        liveTvCardOptions.ts
      types.ts
      utils/search.ts

  components/
    cardbuilder/
      Card/
        Card.tsx
        CardImageContainer.tsx           ← [MODIFIED] hover cycling via useChapterImageCycling
        CardBox.tsx
        CardHoverMenu.tsx
        useCard.ts
        useCardImageUrl.ts
        useChapterImageCycling.ts        ← [CUSTOM] hover chapter/image cycling hook
        Cards.tsx                        ← renders a list of Card components (used in grid)
      cardBuilder.ts                     ← legacy imperative card builder (not used in our grid)
```

---

## Custom Features

### 1. Dense Infinite-Scroll Search Grid

**Files:** `SearchDenseGrid.tsx`, `searchgrid.scss`, `SearchResults.tsx`, `search.tsx`

**How it works:**
- `SearchResults` renders a single `SearchDenseGrid` instead of per-section `SearchResultsRow`
- Grid uses `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))` — fluid, ~8-10
  cards per row on 1080p
- Progressive rendering: starts with 50 items, `IntersectionObserver` on a sentinel div at
  the bottom triggers loading 50 more as the user scrolls
- Sections are still grouped with a small header above each type group
- People sections are separated and only rendered when `showPeople` is true

### 2. People / Actors Toolbar Toggle

**Files:** `SearchFields.tsx`, `search.tsx`

**How it works:**
- A person icon button lives in the search toolbar, right of the input
- State managed in `search.tsx` with `useState`, persisted to `localStorage`
  under key `search.showPeople` (default: `false`)
- When toggled on, people and artist sections appear below media sections in the grid
- When off, `usePeopleSearch` / `useArtistsSearch` hooks still run (TanStack Query
  caches the result) but results are not rendered — this keeps it fast to toggle on

### 3. Chapter Image Cycling on Hover

**Files:** `useChapterImageCycling.ts`, `CardImageContainer.tsx`, `queryOptions.ts`

**How it works:**
- `queryOptions.ts` now requests `ItemFields.Chapters` so chapter data is in search results
- `CardImageContainer` gains `onMouseEnter`/`onMouseLeave` handlers
- `useChapterImageCycling` hook: on hover start, builds chapter image URL array from
  `item.Chapters` using `getImageApi(api).getItemImageUrlById(id, ImageType.Chapter, {...})`
- Cycles through images at 900ms intervals using `setInterval`
- On mouse leave: clears interval, resets to static poster image
- Falls back silently if `item.Chapters` is absent or has < 2 images

**Trickplay (Phase 2, not yet implemented):**
- The SDK has `getTrickplayApi` and `TrickplayInfoDto` available
- `item.TrickplayInfo` is a `{ [width]: TrickplayInfoDto }` map
- Trickplay tiles are sprite sheets — requires CSS `background-position` clipping
  to extract individual frames from the tile image
- When implemented: after chapter images are shown, upgrade to trickplay frames
  for smoother, denser cycling if `item.TrickplayInfo` has entries

---

## Development Workflow

### Requirements

- Node 20.x (use `nvm use 20`)
  ⚠️ Node 24 / npm 11 are **not compatible** with this branch (10.11.x requires npm <11)

### Setup

```bash
cd ~/Documents/dev/jellyfin-web
nvm use 20
git checkout release-10.11.z
npm ci
```

### Dev server

```bash
npm start
# Dev server at http://localhost:8080
```

When the browser opens `http://localhost:8080`:
1. Jellyfin will ask for your server URL — enter your TrueNAS Jellyfin URL
   (e.g., `http://truenas.local:8096`)
2. Log in normally — all API calls go directly from browser to the Jellyfin server

**CORS note:** The Jellyfin server must allow CORS from `http://localhost:8080` during
development. In TrueNAS, go to Jellyfin Dashboard → Networking → Add `http://localhost:8080`
to the allowed origins, or use `*` temporarily during development.

### Build

```bash
npm run build:production
# Output → dist/
```

### Type check

```bash
npm run build:check
# tsc --noEmit, should return 0 errors
```

### Lint

```bash
npm run lint
```

---

## Deployment Flow

```
Push to release-10.11.z (this repo)
    ↓ (CI in jellyfin-fork — must be triggered manually or via workflow_dispatch)

cdilga/jellyfin-fork GitHub Actions:
    → npm ci + npm run build:production (on release-10.11.z branch)
    → docker build FROM jellyfin/jellyfin:10.11.6 + COPY dist/
    → Push ghcr.io/cdilga/jellyfin:10.11.6-fork.{N}

TrueNAS SCALE Custom App
    → Update image tag in compose → redeploy
    → ZFS snapshot of /mnt/tank/jellyfin/config before upgrade
```

**Trigger a build after pushing changes:**
```bash
gh workflow run build.yml --repo cdilga/jellyfin-fork
```

---

## Staying Current with Upstream

```bash
# When upstream releases a new 10.11.x patch
git fetch upstream
git rebase upstream/release-10.11.z

# Resolve conflicts (likely in search/ and CardImageContainer.tsx)
git push origin release-10.11.z
```

**Conflict surface:** Only files listed under "MODIFIED" or "CUSTOM" in the layout above.
All custom code is in dedicated new files where possible to minimise rebase friction.

---

## Constraints

- **Node 20 only** on this branch — do not use Node 24 / npm 11
- **Do not use `any`** — `@jellyfin/sdk` types are comprehensive
- **Do not expand** `emby-scroller` / legacy web component usage
- **Do not fork the server** — all changes are frontend only
- Keep custom additions in new files where possible to reduce upstream merge conflicts
- The `SearchResultsRow` horizontal scroller is kept but no longer used in search —
  do not remove it in case upstream code references it elsewhere

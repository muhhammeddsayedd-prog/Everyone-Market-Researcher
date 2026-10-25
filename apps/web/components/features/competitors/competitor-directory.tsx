'use client';

import { useState } from 'react';
import { CompetitorCard } from './competitor-card';
import { categoryLabels, tierLabels, type DirectoryFixture } from './competitor-directory.fixtures';
import { selectCompetitors, type DirectoryFilters } from './competitor-directory.model';
import styles from './competitor-directory.module.css';

function ViewIcon({ list }: { list: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {list ? (
        <path d="M3 5h14M3 10h14M3 15h14" />
      ) : (
        <>
          <rect x="3" y="3" width="5" height="5" rx="1" />
          <rect x="12" y="3" width="5" height="5" rx="1" />
          <rect x="3" y="12" width="5" height="5" rx="1" />
          <rect x="12" y="12" width="5" height="5" rx="1" />
        </>
      )}
    </svg>
  );
}

export function CompetitorDirectory({ competitors }: { competitors: readonly DirectoryFixture[] }) {
  const [filters, setFilters] = useState<DirectoryFilters>({});
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const results = selectCompetitors(competitors, filters);
  const hasFilters = Boolean(filters.query || filters.market || filters.tier || filters.category);
  const clearFilters = () => setFilters({});
  return (
    <main id="directory-main" className={styles.main}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.kicker}>Market directory</p>
          <h1>
            Competitors
            <span className={styles.headingCount} aria-hidden="true">
              {competitors.length}
            </span>
          </h1>
        </div>
        <p className={styles.intro}>
          Egypt. Saudi Arabia.
          <br />
          United Arab Emirates.
        </p>
      </div>
      <aside className={styles.fixtureNotice} aria-label="Fixture data notice">
        <span className={styles.noticeMark} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div>
          <strong>Fixture preview</strong>
          <p>{competitors.length} catalog records · 17 October 2026 snapshot. No live data.</p>
        </div>
        <span className={styles.noticeScope}>Local development only</span>
      </aside>
      <fieldset className={styles.filters}>
        <legend className={styles.srOnly}>Filter competitors</legend>
        <label className={styles.searchField}>
          Search by name
          <div className={styles.searchControl}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              type="search"
              placeholder="Find a production house…"
              value={filters.query ?? ''}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </div>
        </label>
        <label>
          Market
          <select
            value={filters.market ?? ''}
            className={filters.market ? styles.selectedFilter : ''}
            onChange={(event) => {
              const market = event.target.value;
              setFilters({
                ...filters,
                market: market === 'EG' || market === 'KSA' || market === 'UAE' ? market : undefined,
              });
            }}
          >
            <option value="">All markets</option>
            <option value="EG">Egypt · EG</option>
            <option value="KSA">Saudi Arabia · KSA</option>
            <option value="UAE">United Arab Emirates · UAE</option>
          </select>
        </label>
        <label>
          Tier
          <select
            value={filters.tier ?? ''}
            className={filters.tier ? styles.selectedFilter : ''}
            onChange={(event) => {
              const tier = event.target.value;
              setFilters({
                ...filters,
                tier:
                  tier === 'baseline' || tier === 'pilot' || tier === 'next_wave' || tier === 'adjacent'
                    ? tier
                    : undefined,
              });
            }}
          >
            <option value="">All tiers</option>
            {Object.entries(tierLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.categoryField}>
          Category
          <select
            value={filters.category ?? ''}
            className={filters.category ? styles.selectedFilter : ''}
            onChange={(event) =>
              setFilters({
                ...filters,
                category: Object.hasOwn(categoryLabels, event.target.value) ? event.target.value : undefined,
              })
            }
          >
            <option value="">All categories</option>
            {Object.entries(categoryLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className={styles.resultsBar}>
        <p role="status" aria-live="polite" aria-atomic="true">
          <strong>{results.length}</strong> of {competitors.length} fixture records
        </p>
        <button type="button" className={styles.clearButton} onClick={clearFilters} disabled={!hasFilters}>
          Clear all filters
        </button>
        <span className={styles.sortLabel}>Name A–Z</span>
        <div className={styles.viewControls} role="group" aria-label="Result view">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
          >
            <ViewIcon list={false} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <ViewIcon list />
          </button>
        </div>
      </div>
      {results.length > 0 ? (
        <ul className={view === 'grid' ? styles.grid : styles.list} aria-label="Competitor results">
          {results.map((competitor) => (
            <CompetitorCard key={competitor.company_code} competitor={competitor} />
          ))}
        </ul>
      ) : (
        <section className={styles.emptyState}>
          <span aria-hidden="true">···</span>
          <h2>No matching competitors</h2>
          <p>Try a different name or clear the filters.</p>
          <button type="button" onClick={clearFilters}>
            Reset filters
          </button>
        </section>
      )}
      <footer className={styles.directoryFooter}>
        <span>Public catalog snapshot · Initials shown in place of logos</span>
        <span>everyone. Market Radar</span>
      </footer>
    </main>
  );
}

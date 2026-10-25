import {
  categoryLabels,
  marketLabels,
  tierLabels,
  type DirectoryFixture,
} from './competitor-directory.fixtures';
import styles from './competitor-directory.module.css';

export function CompetitorCard({ competitor }: { competitor: DirectoryFixture }) {
  const initials = competitor.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <li className={`${styles.card} ${competitor.is_baseline ? styles.baseline : ''}`}>
      <div className={styles.cardTop}>
        <span className={styles.logoTile} aria-hidden="true">
          {competitor.is_baseline ? 'e.' : initials}
        </span>
        <span className={styles.tier}>
          {tierLabels[competitor.priority_tier]}
          {competitor.pilot_rank !== null && (
            <span className={styles.rank}> · {String(competitor.pilot_rank).padStart(2, '0')}</span>
          )}
        </span>
      </div>
      <div className={styles.identity}>
        <h2 className={styles.cardName} dir="auto" title={competitor.name}>
          {competitor.name}
        </h2>
        {competitor.name_ar && (
          <p className={styles.arabicName} dir="auto" lang="ar">
            {competitor.name_ar}
          </p>
        )}
        <div className={styles.markets} aria-label="Markets">
          {competitor.markets.map((market) => (
            <span key={market} title={marketLabels[market]}>
              {market}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.categories}>
        {competitor.categories.slice(0, 3).map((category) => (
          <span key={category}>{categoryLabels[category] ?? category}</span>
        ))}
        {competitor.categories.length > 3 && (
          <span
            title={competitor.categories
              .slice(3)
              .map((code) => categoryLabels[code] ?? code)
              .join(', ')}
          >
            <span aria-hidden="true">+{competitor.categories.length - 3}</span>
            <span className={styles.srOnly}>
              Additional categories:{' '}
              {competitor.categories
                .slice(3)
                .map((code) => categoryLabels[code] ?? code)
                .join(', ')}
            </span>
          </span>
        )}
      </div>
      <div className={styles.cardFooter}>
        <span>
          HQ <span className={styles.hq}>{competitor.hq_country ?? '—'}</span>
        </span>
        <span className={styles.companyCode}>{competitor.company_code}</span>
      </div>
    </li>
  );
}

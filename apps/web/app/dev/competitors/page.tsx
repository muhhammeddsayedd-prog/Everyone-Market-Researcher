import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CompetitorDirectory } from '../../../components/features/competitors/competitor-directory';
import styles from '../../../components/features/competitors/competitor-directory.module.css';

export default async function CompetitorPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { competitorFixtures } =
    await import('../../../components/features/competitors/competitor-directory.fixtures');
  return (
    <div className={styles.previewShell}>
      <a href="#directory-main" className={styles.skipLink}>
        Skip to competitors
      </a>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Image
            src="/brand/everyone-logotype.svg"
            alt="everyone."
            width={519}
            height={87}
            className={styles.wordmark}
          />
          <span>Market Radar</span>
        </div>
        <span className={styles.previewLabel}>Directory preview</span>
      </header>
      <CompetitorDirectory competitors={competitorFixtures} />
    </div>
  );
}

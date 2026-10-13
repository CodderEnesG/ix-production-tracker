import type { ReactNode } from 'react';
import { IxButton, IxMessageBar, IxSpinner } from '@siemens/ix-react';
import type { ApiError } from '../lib/api';
import styles from './AsyncState.module.css';

type Props = {
  loading: boolean;
  error: ApiError | undefined;
  hasData: boolean;
  onRetry: () => void;
  children: ReactNode;
};

/**
 * Shared loading / error handling for pages that fetch data. On the first load
 * it shows a spinner; if a reload fails, the old data stays on screen with an
 * error bar above it.
 */
export function AsyncState({ loading, error, hasData, onRetry, children }: Props) {
  const errorBar = error && (
    <IxMessageBar type="alarm" persistent className={styles.errorBar}>
      <div className={styles.errorContent}>
        <span>{error.message}</span>
        <IxButton variant="secondary" onClick={onRetry}>
          Retry
        </IxButton>
      </div>
    </IxMessageBar>
  );

  if (!hasData) {
    if (error) return errorBar;
    if (loading) {
      return (
        <div className={styles.loading} role="status">
          <IxSpinner size="large" />
          <span>Loading…</span>
        </div>
      );
    }
  }

  return (
    <>
      {errorBar}
      {children}
    </>
  );
}

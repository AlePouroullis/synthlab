/**
 * TRACK GRID
 * ==========
 * Generic step sequencer grid for any track type.
 * Renders rows × steps with click-to-toggle cells.
 */

import { useCallback } from 'preact/hooks';
import { Pattern, toggleNote, hasNote } from '../sequencer/types';
import { RowDef } from '../timeline/types';
import styles from './TrackGrid.module.css';

interface Props {
  rows: RowDef[];
  pattern: Pattern;
  currentStep: number;
  isPlaying: boolean;
  onPatternChange?: () => void;
}

export function TrackGrid({ rows, pattern, currentStep, isPlaying, onPatternChange }: Props) {
  const handleCellClick = useCallback(
    (step: number, rowId: string) => {
      toggleNote(pattern, step, rowId);
      onPatternChange?.();
    },
    [pattern, onPatternChange]
  );

  // Render row labels (top to bottom)
  const rowLabels = rows.map((row) => (
    <div key={row.id} class={`${styles.rowLabel} ${row.accent ? styles.rowLabelAccent : ''}`}>
      {row.label}
    </div>
  ));

  // Render grid columns
  const columns = [];
  for (let step = 0; step < pattern.length; step++) {
    const cells = rows.map((row) => {
      const isActive = hasNote(pattern, step, row.id);
      return (
        <div
          key={row.id}
          class={`${styles.cell} ${row.accent ? styles.cellAccent : ''} ${isActive ? styles.cellActive : ''}`}
          onClick={() => handleCellClick(step, row.id)}
        />
      );
    });

    columns.push(
      <div
        key={step}
        class={`${styles.column} ${step % 4 === 0 ? styles.columnBeatStart : ''} ${currentStep === step && isPlaying ? styles.columnPlaying : ''}`}
      >
        {cells}
      </div>
    );
  }

  return (
    <div class={styles.grid}>
      <div class={styles.labels}>{rowLabels}</div>
      <div class={styles.steps}>{columns}</div>
    </div>
  );
}

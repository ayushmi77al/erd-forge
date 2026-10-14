import React, { useState } from 'react';
import styles from './SquishyToggle.module.css';

export interface SquishyOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  title?: string;
}

export interface SquishyToggleProps<T extends string> {
  options: [SquishyOption<T>, SquishyOption<T>];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function SquishyToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SquishyToggleProps<T>) {
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const isRight = selectedIndex === 1;

  let pressClass = '';
  if (pressedIndex !== null) {
    if (pressedIndex === selectedIndex) {
      pressClass = styles.isPressedSame || '';
    } else if (pressedIndex === 1) {
      pressClass = styles.isPressedRight || '';
    } else {
      pressClass = styles.isPressedLeft || '';
    }
  }

  const handlePointerDown = (index: number) => {
    setPressedIndex(index);
  };

  const handleClick = (index: number) => {
    const opt = options[index];
    if (opt) {
      onChange(opt.value);
    }
    setPressedIndex(null);
  };

  const handlePointerLeave = () => {
    setPressedIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && options[0]) {
      e.preventDefault();
      onChange(options[0].value);
    } else if (e.key === 'ArrowRight' && options[1]) {
      e.preventDefault();
      onChange(options[1].value);
    }
  };

  return (
    <div
      className={`${styles.toggle} ${isRight ? styles.isRight : ''} ${pressClass}`}
      role="group"
      aria-label={ariaLabel}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((opt, idx) => {
        const isOptSelected = idx === selectedIndex;
        return (
          <button
            key={opt.value}
            type="button"
            className={`${styles.option} ${isOptSelected ? styles.active : ''}`}
            title={opt.title}
            aria-pressed={isOptSelected}
            onPointerDown={() => handlePointerDown(idx)}
            onClick={() => handleClick(idx)}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

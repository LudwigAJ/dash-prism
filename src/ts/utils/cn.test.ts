import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps the last of two conflicting prefixed utilities', () => {
    expect(cn('tw:px-2', 'tw:px-4')).toBe('tw:px-4');
  });

  it('merges conflicting utilities that have the same variant', () => {
    expect(cn('tw:hover:bg-muted', 'tw:hover:bg-accent')).toBe('tw:hover:bg-accent');
  });

  it('keeps utilities that have different variants', () => {
    expect(cn('tw:bg-muted', 'tw:hover:bg-accent')).toBe('tw:bg-muted tw:hover:bg-accent');
  });

  it('passes the Prism classes through', () => {
    expect(cn('prism-root', 'prism-size-md', 'tw:flex')).toBe('prism-root prism-size-md tw:flex');
  });

  it('leaves unprefixed classes alone', () => {
    expect(cn('flex', 'hidden')).toBe('flex hidden');
    expect(cn('px-2', 'px-4')).toBe('px-2 px-4');
  });

  it('drops falsy conditional classes', () => {
    const isHidden = false;
    expect(cn('tw:flex', isHidden && 'tw:hidden', undefined, 'tw:gap-2')).toBe('tw:flex tw:gap-2');
  });
});

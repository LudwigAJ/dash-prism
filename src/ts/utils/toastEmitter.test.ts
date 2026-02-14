/**
 * Unit tests for toastEmitter - event emitter for toast notifications
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { subscribeToToasts, notifyUser, type ToastEvent } from './toastEmitter';

describe('toastEmitter', () => {
  // Store unsubscribe functions to clean up after each test
  let unsubscribeFns: Array<() => void> = [];

  afterEach(() => {
    // Clean up all subscriptions after each test
    unsubscribeFns.forEach((fn) => fn());
    unsubscribeFns = [];
  });

  describe('subscribeToToasts', () => {
    it('subscribes a listener and receives events from notifyUser', () => {
      const listener = vi.fn();
      const unsub = subscribeToToasts(listener);
      unsubscribeFns.push(unsub);

      notifyUser('info', 'Test message');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        type: 'info',
        message: 'Test message',
      });
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToToasts(listener);
      unsubscribeFns.push(unsubscribe);

      expect(typeof unsubscribe).toBe('function');
    });

    it('stops receiving events after unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToToasts(listener);

      notifyUser('info', 'Before unsubscribe');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      notifyUser('info', 'After unsubscribe');
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('supports multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      unsubscribeFns.push(subscribeToToasts(listener1));
      unsubscribeFns.push(subscribeToToasts(listener2));
      unsubscribeFns.push(subscribeToToasts(listener3));

      notifyUser('warning', 'Multiple listeners');

      const expected = { type: 'warning', message: 'Multiple listeners' };
      expect(listener1).toHaveBeenCalledWith(expected);
      expect(listener2).toHaveBeenCalledWith(expected);
      expect(listener3).toHaveBeenCalledWith(expected);
    });

    it('allows selective unsubscribing', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      unsubscribeFns.push(subscribeToToasts(listener1));
      const unsubscribe2 = subscribeToToasts(listener2);
      unsubscribeFns.push(unsubscribe2);
      unsubscribeFns.push(subscribeToToasts(listener3));

      // Unsubscribe only listener2
      unsubscribe2();

      notifyUser('error', 'Selective unsubscribe');

      const expected = { type: 'error', message: 'Selective unsubscribe' };
      expect(listener1).toHaveBeenCalledWith(expected);
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledWith(expected);
    });
  });

  describe('notifyUser', () => {
    it('emits warning toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(subscribeToToasts(listener));

      notifyUser('warning', 'Maximum tabs reached');

      expect(listener).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Maximum tabs reached',
      });
    });

    it('emits error toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(subscribeToToasts(listener));

      notifyUser('error', 'Operation failed');

      expect(listener).toHaveBeenCalledWith({
        type: 'error',
        message: 'Operation failed',
      });
    });

    it('emits info toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(subscribeToToasts(listener));

      notifyUser('info', 'Layout already open');

      expect(listener).toHaveBeenCalledWith({
        type: 'info',
        message: 'Layout already open',
      });
    });

    it('handles multiple emissions', () => {
      const listener = vi.fn();
      unsubscribeFns.push(subscribeToToasts(listener));

      notifyUser('info', 'First');
      notifyUser('warning', 'Second');
      notifyUser('error', 'Third');

      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenNthCalledWith(1, { type: 'info', message: 'First' });
      expect(listener).toHaveBeenNthCalledWith(2, { type: 'warning', message: 'Second' });
      expect(listener).toHaveBeenNthCalledWith(3, { type: 'error', message: 'Third' });
    });
  });
});

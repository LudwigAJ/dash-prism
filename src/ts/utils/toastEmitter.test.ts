/**
 * Unit tests for toastEmitter - event emitter for toast notifications
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { toastEmitter, type ToastEvent } from './toastEmitter';

describe('toastEmitter', () => {
  // Store unsubscribe functions to clean up after each test
  let unsubscribeFns: Array<() => void> = [];

  afterEach(() => {
    // Clean up all subscriptions after each test
    unsubscribeFns.forEach((fn) => fn());
    unsubscribeFns = [];
  });

  describe('subscribe', () => {
    it('subscribes a listener and receives emitted events', () => {
      const listener = vi.fn();
      const unsub = toastEmitter.subscribe(listener);
      unsubscribeFns.push(unsub);

      const event: ToastEvent = {
        type: 'success',
        message: 'Test message',
      };

      toastEmitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = toastEmitter.subscribe(listener);
      unsubscribeFns.push(unsubscribe);

      expect(typeof unsubscribe).toBe('function');
    });

    it('stops receiving events after unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = toastEmitter.subscribe(listener);

      toastEmitter.emit({ type: 'info', message: 'Before unsubscribe' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      toastEmitter.emit({ type: 'info', message: 'After unsubscribe' });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('supports multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      unsubscribeFns.push(toastEmitter.subscribe(listener1));
      unsubscribeFns.push(toastEmitter.subscribe(listener2));
      unsubscribeFns.push(toastEmitter.subscribe(listener3));

      const event: ToastEvent = {
        type: 'warning',
        message: 'Multiple listeners',
      };

      toastEmitter.emit(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
      expect(listener3).toHaveBeenCalledWith(event);
    });

    it('allows selective unsubscribing', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      unsubscribeFns.push(toastEmitter.subscribe(listener1));
      const unsubscribe2 = toastEmitter.subscribe(listener2);
      unsubscribeFns.push(unsubscribe2);
      unsubscribeFns.push(toastEmitter.subscribe(listener3));

      // Unsubscribe only listener2
      unsubscribe2();

      const event: ToastEvent = {
        type: 'error',
        message: 'Selective unsubscribe',
      };

      toastEmitter.emit(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledWith(event);
    });
  });

  describe('emit', () => {
    it('emits success toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(toastEmitter.subscribe(listener));

      toastEmitter.emit({
        type: 'success',
        message: 'Operation successful',
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'success',
        message: 'Operation successful',
      });
    });

    it('emits warning toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(toastEmitter.subscribe(listener));

      toastEmitter.emit({
        type: 'warning',
        message: 'Maximum tabs reached',
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Maximum tabs reached',
      });
    });

    it('emits error toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(toastEmitter.subscribe(listener));

      toastEmitter.emit({
        type: 'error',
        message: 'Operation failed',
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'error',
        message: 'Operation failed',
      });
    });

    it('emits info toast events', () => {
      const listener = vi.fn();
      unsubscribeFns.push(toastEmitter.subscribe(listener));

      toastEmitter.emit({
        type: 'info',
        message: 'Layout already open',
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'info',
        message: 'Layout already open',
      });
    });

    it('supports optional description field', () => {
      const listener = vi.fn();
      unsubscribeFns.push(toastEmitter.subscribe(listener));

      const event: ToastEvent = {
        type: 'success',
        message: 'Task completed',
        description: 'All files processed successfully',
      };

      toastEmitter.emit(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it('does nothing when no listeners are subscribed', () => {
      // Should not throw
      expect(() => {
        toastEmitter.emit({
          type: 'info',
          message: 'No listeners',
        });
      }).not.toThrow();
    });

    it('handles multiple emissions', () => {
      const listener = vi.fn();
      unsubscribeFns.push(toastEmitter.subscribe(listener));

      toastEmitter.emit({ type: 'info', message: 'First' });
      toastEmitter.emit({ type: 'warning', message: 'Second' });
      toastEmitter.emit({ type: 'error', message: 'Third' });

      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenNthCalledWith(1, { type: 'info', message: 'First' });
      expect(listener).toHaveBeenNthCalledWith(2, { type: 'warning', message: 'Second' });
      expect(listener).toHaveBeenNthCalledWith(3, { type: 'error', message: 'Third' });
    });
  });
});

/**
 * Unit tests for prismToast - the one function that shows a toast in Prism
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { toast } from 'sonner';
import { prismToast } from './prismToast';
import { logger } from './logger';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('prismToast', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('shows the toast with a Dismiss button', () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    prismToast('success', 'Saved', { description: 'All good' });

    expect(toast.success).toHaveBeenCalledWith('Saved', {
      description: 'All good',
      cancel: { label: 'Dismiss', onClick: expect.any(Function) },
    });
  });

  it('logs the message at the level that matches the toast', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});

    prismToast('warning', 'Careful');
    prismToast('error', 'Broken');
    prismToast('success', 'Done');

    expect(warn).toHaveBeenCalledWith('Careful');
    expect(error).toHaveBeenCalledWith('Broken');
    expect(info).toHaveBeenCalledWith('Done');
  });

  it('logs at the level that the caller sets', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    prismToast('error', 'Invalid input', { logLevel: 'warn' });

    expect(warn).toHaveBeenCalledWith('Invalid input');
    expect(error).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Invalid input', expect.anything());
  });

  it('logs the log details in place of the message', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    prismToast('error', 'Short', { logDetails: 'Long details' });

    expect(error).toHaveBeenCalledWith('Long details');
    expect(toast.error).toHaveBeenCalledWith('Short', expect.anything());
  });

  it('shows the toast only in the Toaster that the caller names', () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    prismToast('success', 'Saved', { toasterId: 'prism-a' });

    expect(toast.success).toHaveBeenCalledWith(
      'Saved',
      expect.objectContaining({ toasterId: 'prism-a' })
    );
  });

  it('gives the toast an ID that holds the Toaster, so two instances do not share a toast', () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    prismToast('info', 'Closed', { toasterId: 'prism-a', id: 'notice' });
    prismToast('info', 'Closed', { toasterId: 'prism-b', id: 'notice' });

    expect(toast.info).toHaveBeenNthCalledWith(
      1,
      'Closed',
      expect.objectContaining({ id: 'prism-a:notice' })
    );
    expect(toast.info).toHaveBeenNthCalledWith(
      2,
      'Closed',
      expect.objectContaining({ id: 'prism-b:notice' })
    );
  });
});

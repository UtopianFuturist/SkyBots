import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock config
jest.unstable_mockModule('../config.js', () => ({
  default: {
    RENDER_API_KEY: 'test-key',
    RENDER_SERVICE_ID: 'test-id',
    RENDER_SERVICE_NAME: 'skybots',
    NVIDIA_NIM_API_KEY: 'nvidia-key',
    BLUESKY_APP_PASSWORD: 'bsky-password',
    MOLTBOOK_API_KEY: 'moltbook-key'
  }
}));

// Mock node-fetch
const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

const { renderService } = await import('../src/services/renderService.js');

describe('RenderService', () => {
  it('should correctly parse fragmented SSE log lines', async () => {
    const mockBody = new EventEmitter();
    // Simulate node-fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      body: mockBody
    });

    const logsPromise = renderService.getLogs(5);

    // Send data in fragments after a short delay to allow stream listeners to be attached
    setTimeout(() => {
      mockBody.emit('data', Buffer.from('data: {"timestamp": "2026-01-01", "message": "Line 1"}\n'));
      mockBody.emit('data', Buffer.from('data: {"timestamp": "2026-01-02", "message": "Line '));
      mockBody.emit('data', Buffer.from('2"}\ndata: {"timestamp": "2026-01-03", "message": "Line 3"}\n'));
      mockBody.emit('end');
    }, 100);

    const result = await logsPromise;
    expect(result).toContain('2026-01-01 Line 1');
    expect(result).toContain('2026-01-02 Line 2');
    expect(result).toContain('2026-01-03 Line 3');
  }, 10000);

  it('should redact sensitive keys from logs', async () => {
    const mockBody = new EventEmitter();
    mockFetch.mockResolvedValue({
      ok: true,
      body: mockBody
    });

    const logsPromise = renderService.getLogs(5);

    setTimeout(() => {
      mockBody.emit('data', Buffer.from('data: {"message": "Error with key test-key and password bsky-password"}\n'));
      mockBody.emit('end');
    }, 100);

    const result = await logsPromise;
    expect(result).not.toContain('test-key');
    expect(result).not.toContain('bsky-password');
    expect(result).toContain('[REDACTED]');
  }, 10000);
});

import { describe, expect, test } from 'bun:test';

import { readTaskSessionIdFromOutput, readTaskSessionIdFromRecord } from './taskSessionId';

describe('task session id parsing', () => {
  test('reads explicit session ids from metadata records', () => {
    expect(readTaskSessionIdFromRecord({ sessionID: 'ses_child' })).toBe('ses_child');
    expect(readTaskSessionIdFromRecord({ sessionId: 'ses_child_2' })).toBe('ses_child_2');
  });

  test('reads explicit session ids from tool output', () => {
    expect(readTaskSessionIdFromOutput('session_id: ses_child')).toBe('ses_child');
    expect(readTaskSessionIdFromOutput('session-id: ses_child_2')).toBe('ses_child_2');
  });

  test('does not treat task ids as session ids', () => {
    expect(readTaskSessionIdFromOutput('task_id: task_123')).toBe(undefined);
  });
});

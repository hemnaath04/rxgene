// Tests for agent utilities.
import { describe, it, expect } from 'vitest';
import { stripCodeFence } from './agent.js';

describe('stripCodeFence', () => {
  it('strips plain markdown code fence', () => {
    const input = '```\n{"key": "value"}\n```';
    const expected = '{"key": "value"}';
    expect(stripCodeFence(input)).toBe(expected);
  });

  it('strips json-labeled markdown code fence', () => {
    const input = '```json\n{"key": "value"}\n```';
    const expected = '{"key": "value"}';
    expect(stripCodeFence(input)).toBe(expected);
  });

  it('passes through content without fence', () => {
    const input = '{"key": "value"}';
    expect(stripCodeFence(input)).toBe(input);
  });

  it('handles whitespace around fence', () => {
    const input = '  ```json\n{"key": "value"}\n```  ';
    const expected = '{"key": "value"}';
    expect(stripCodeFence(input)).toBe(expected);
  });

  it('handles multiline JSON with fence', () => {
    const input = '```json\n{\n  "key": "value",\n  "nested": { "a": 1 }\n}\n```';
    const expected = '{\n  "key": "value",\n  "nested": { "a": 1 }\n}';
    expect(stripCodeFence(input)).toBe(expected);
  });

  it('returns original if fence is incomplete', () => {
    const input = '```json\n{"key": "value"}';
    expect(stripCodeFence(input)).toBe(input);
  });
});

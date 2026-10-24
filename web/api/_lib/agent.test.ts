// Tests for agent utilities.
import { describe, it, expect } from 'vitest';
import { stripCodeFence, extractNumbers } from './agent.js';

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


describe('extractNumbers', () => {
  it('extracts standalone numbers', () => {
    const text = 'activity score of 2.25';
    const numbers = extractNumbers(text);
    expect(numbers.has(2.25)).toBe(true);
    expect(numbers.size).toBe(1);
  });

  it('extracts activity score 0', () => {
    const text = 'activity score of 0';
    const numbers = extractNumbers(text);
    expect(numbers.has(0)).toBe(true);
    expect(numbers.size).toBe(1);
  });

  it('does NOT extract digits from CYP2C19', () => {
    const text = 'CYP2C19';
    const numbers = extractNumbers(text);
    expect(numbers.size).toBe(0);
  });

  it('does NOT extract digits from CYP2D6', () => {
    const text = 'CYP2D6';
    const numbers = extractNumbers(text);
    expect(numbers.size).toBe(0);
  });

  it('does NOT extract digits from allele names like *1, *4, *10', () => {
    const text = '*1/*4 or *10';
    const numbers = extractNumbers(text);
    expect(numbers.size).toBe(0);
  });

  it('does NOT extract digits from requirement IDs like R39', () => {
    const text = 'requirements: R39, R40, R41';
    const numbers = extractNumbers(text);
    expect(numbers.size).toBe(0);
  });

  it('extracts multiple standalone numbers', () => {
    const text = 'dose: 5 mg, titrate to 10 mg over 2 weeks';
    const numbers = extractNumbers(text);
    expect(numbers.has(5)).toBe(true);
    expect(numbers.has(10)).toBe(true);
    expect(numbers.has(2)).toBe(true);
    expect(numbers.size).toBe(3);
  });

  it('handles mixed gene names and real numbers', () => {
    const text = 'CYP2D6 activity score 1.5 and CYP2C19 score 2.0';
    const numbers = extractNumbers(text);
    expect(numbers.has(1.5)).toBe(true);
    expect(numbers.has(2.0)).toBe(true);
    expect(numbers.size).toBe(2);
  });
});
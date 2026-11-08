import type { FailReason, Report } from './types';

const EMPTY: Report = {
  ok: true,
  moved: [],
  shortened: [],
  covered: [],
  created: [],
  removed: [],
  startsMoved: 0,
  absorbed: 0,
};

export function report(partial: Partial<Report> = {}): Report {
  return { ...EMPTY, ...partial };
}

export function fail(reason: FailReason): Report {
  return { ...EMPTY, ok: false, reason };
}

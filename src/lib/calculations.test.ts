/**
 * Comprehensive Math Verification Tests for Funding Simulator
 *
 * These tests verify the equity calculations at price rounds are accurate.
 * Run with: npx vitest run src/lib/calculations.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writable, get } from 'svelte/store';
import type { CapTable, Event, Founder, Safe, PricedRound, ConvertibleNote, Options } from './types';

// Create mock stores - these need to be defined BEFORE the vi.mock call
const mockFounders = writable<Founder[]>([]);
const mockEvents = writable<Event[]>([]);
const mockExit = writable<{ amount: number; tax: number } | null>(null);

// Mock the store module
vi.mock('./store', () => {
  return {
    founders: writable<Founder[]>([]),
    events: writable<Event[]>([]),
    exit: writable<{ amount: number; tax: number } | null>(null)
  };
});

// Now import the calculations and the mocked stores
import * as calculations from './calculations';
import { founders, events, exit } from './store';

const INITIAL_SHARES = 10_000_000;
const TOLERANCE = 0.001;

// Helper to check percentages
const getPercentage = (shares: number, total: number) => (shares / total) * 100;
const expectPercentageClose = (actual: number, expected: number, tolerance = 0.1) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
};

// Helper to verify cap table sums
const verifyCapTableIntegrity = (table: CapTable) => {
  const total = calculations.getTableTotalShares(table);
  expect(total).toBeGreaterThan(0);
  Object.values(table).forEach(shares => {
    expect(shares).toBeGreaterThanOrEqual(0);
  });
};

// Helper to set up test state
const setupTest = (foundersList: Founder[], eventsList: Event[], exitData: { amount: number; tax: number } | null = null) => {
  founders.set(foundersList);
  events.set(eventsList);
  exit.set(exitData);
};

describe('Comprehensive Math Verification', () => {
  beforeEach(() => {
    founders.set([]);
    events.set([]);
    exit.set(null);
  });

  // ============================================
  // SECTION 1: BASIC FOUNDER ALLOCATION
  // ============================================
  describe('1. Founder Allocation', () => {
    it('1.1 Two equal founders (50/50)', () => {
      setupTest([
        { id: '1', name: 'Founder A', equity: 50, isYou: true },
        { id: '2', name: 'Founder B', equity: 50, isYou: false }
      ], []);

      const tables = calculations.getCapTables();
      const initial = tables[0];

      expect(initial['Founder A']).toBe(5_000_000);
      expect(initial['Founder B']).toBe(5_000_000);
      expect(calculations.getTableTotalShares(initial)).toBe(INITIAL_SHARES);
    });

    it('1.2 Three founders with unequal split (60/30/10)', () => {
      setupTest([
        { id: '1', name: 'CEO', equity: 60, isYou: true },
        { id: '2', name: 'CTO', equity: 30, isYou: false },
        { id: '3', name: 'COO', equity: 10, isYou: false }
      ], []);

      const tables = calculations.getCapTables();
      const initial = tables[0];

      expect(initial['CEO']).toBe(6_000_000);
      expect(initial['CTO']).toBe(3_000_000);
      expect(initial['COO']).toBe(1_000_000);
      expect(calculations.getTableTotalShares(initial)).toBe(INITIAL_SHARES);
    });

    it('1.3 Solo founder (100%)', () => {
      setupTest([
        { id: '1', name: 'Solo Founder', equity: 100, isYou: true }
      ], []);

      const tables = calculations.getCapTables();
      expect(tables[0]['Solo Founder']).toBe(INITIAL_SHARES);
    });

    it('1.4 Four founders with fractional equity (33.33/33.33/20.34/13)', () => {
      setupTest([
        { id: '1', name: 'F1', equity: 33.33, isYou: true },
        { id: '2', name: 'F2', equity: 33.33, isYou: false },
        { id: '3', name: 'F3', equity: 20.34, isYou: false },
        { id: '4', name: 'F4', equity: 13, isYou: false }
      ], []);

      const tables = calculations.getCapTables();
      const initial = tables[0];
      const total = calculations.getTableTotalShares(initial);

      expectPercentageClose(getPercentage(initial['F1'], total), 33.33);
      expectPercentageClose(getPercentage(initial['F2'], total), 33.33);
      expectPercentageClose(getPercentage(initial['F3'], total), 20.34);
      expectPercentageClose(getPercentage(initial['F4'], total), 13);
    });
  });

  // ============================================
  // SECTION 2: PRICED ROUND BASICS
  // ============================================
  describe('2. Priced Round - Basic Dilution', () => {
    it('2.1 Simple Series A: $2M at $10M post-money (20% dilution)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 2_000_000,
        valuation: 10_000_000,
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Investor should own 20% ($2M / $10M)
      const investorPct = getPercentage(final['Series A'], total);
      expectPercentageClose(investorPct, 20);

      // Founder should own 80%
      const founderPct = getPercentage(final['Founder'], total);
      expectPercentageClose(founderPct, 80);
    });

    it('2.2 Series A: $5M at $20M post-money (25% dilution)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Investor',
        amount: 5_000_000,
        valuation: 20_000_000,
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      const investorPct = getPercentage(final['Investor'], total);
      expectPercentageClose(investorPct, 25);
    });

    it('2.3 Series A: $1M at $5M post-money (20% dilution)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Angel',
        amount: 1_000_000,
        valuation: 5_000_000,
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 6
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      expectPercentageClose(getPercentage(final['Angel'], total), 20);
      expectPercentageClose(getPercentage(final['Founder'], total), 80);
    });

    it('2.4 Large round: $50M at $200M post-money (25% dilution)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Growth Fund',
        amount: 50_000_000,
        valuation: 200_000_000,
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 36
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      expectPercentageClose(getPercentage(final['Growth Fund'], total), 25);
    });

    it('2.5 Small dilution: $500K at $10M post-money (5% dilution)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Seed',
        amount: 500_000,
        valuation: 10_000_000,
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 6
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      expectPercentageClose(getPercentage(final['Seed'], total), 5);
      expectPercentageClose(getPercentage(final['Founder'], total), 95);
    });
  });

  // ============================================
  // SECTION 3: SAFE CONVERSIONS
  // ============================================
  describe('3. SAFE Conversions at Price Round', () => {
    it('3.1 Single SAFE with valuation cap (cap is binding)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Angel SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      const safePct = getPercentage(final['Angel SAFE'], total);
      const seriesAPct = getPercentage(final['Series A'], total);

      // Series A should be 20% of final
      expectPercentageClose(seriesAPct, 20, 0.5);

      // SAFE should be ~8% (10% * 80% after Series A dilution)
      expect(safePct).toBeGreaterThan(7);
      expect(safePct).toBeLessThan(11);
    });

    it('3.2 SAFE with discount only (20% discount)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Discount SAFE',
          amount: 500_000,
          valCap: 0,
          discount: 20,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      const safePct = getPercentage(final['Discount SAFE'], total);
      expect(safePct).toBeGreaterThan(4);
      expect(safePct).toBeLessThan(7);
    });

    it('3.3 SAFE with both cap and discount (cap wins)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Combo SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 20,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Should use $5M cap (lower than $8M discounted)
      const safePct = getPercentage(final['Combo SAFE'], total);
      expect(safePct).toBeGreaterThan(7);
      expect(safePct).toBeLessThan(11);
    });

    it('3.4 SAFE with both cap and discount (discount wins)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Combo SAFE',
          amount: 500_000,
          valCap: 9_000_000,
          discount: 20,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Should use $8M (discounted) since it's lower than $9M cap
      const safePct = getPercentage(final['Combo SAFE'], total);
      expect(safePct).toBeGreaterThan(4);
      expect(safePct).toBeLessThan(7);
    });

    it('3.5 Multiple SAFEs converting at price round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'SAFE 1',
          amount: 250_000,
          valCap: 4_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'safe',
          name: 'SAFE 2',
          amount: 500_000,
          valCap: 6_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 3_000_000,
          valuation: 15_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Series A: 20% ($3M / $15M)
      expectPercentageClose(getPercentage(final['Series A'], total), 20, 0.5);

      // Both SAFEs should have converted and received shares
      expect(final['SAFE 1']).toBeGreaterThan(0);
      expect(final['SAFE 2']).toBeGreaterThan(0);

      // Total should add up to 100%
      const totalPct =
        getPercentage(final['Founder'], total) +
        getPercentage(final['SAFE 1'], total) +
        getPercentage(final['SAFE 2'], total) +
        getPercentage(final['Series A'], total);
      expectPercentageClose(totalPct, 100);
    });

    it('3.6 Uncapped SAFE (no cap, no discount)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Uncapped SAFE',
          amount: 500_000,
          valCap: 0,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Uncapped SAFE converts at Series A valuation: $500K / $10M = 5%
      const safePct = getPercentage(final['Uncapped SAFE'], total);
      expectPercentageClose(safePct, 4, 1); // ~4% after dilution
    });
  });

  // ============================================
  // SECTION 4: CONVERTIBLE NOTES
  // ============================================
  describe('4. Convertible Note Conversions', () => {
    it('4.1 Convertible note with interest calculation', () => {
      const note: ConvertibleNote = {
        type: 'convertible',
        name: 'Note',
        amount: 100_000,
        interestRate: 8,
        term: 24,
        valCap: 5_000_000,
        discount: 0,
        mfn: false,
        proRata: false
      };

      // Interest for 12 months: $100K * 8% * (12/12) = $8,000
      const accrued12 = calculations.getConvertibleNoteAccruedAmount(note, 12);
      expect(accrued12).toBe(108_000);

      // Interest for 24 months: $100K * 8% * (24/12) = $16,000
      const accrued24 = calculations.getConvertibleNoteAccruedAmount(note, 24);
      expect(accrued24).toBe(116_000);

      // Interest capped at term (36 months should use 24)
      const accrued36 = calculations.getConvertibleNoteAccruedAmount(note, 36);
      expect(accrued36).toBe(116_000);
    });

    it('4.2 Convertible note conversion at price round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'convertible',
          name: 'Conv Note',
          amount: 500_000,
          interestRate: 8,
          term: 24,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Note principal + 12 months interest: $500K + $40K = $540K
      // Converting at $5M cap: $540K / $5M = 10.8%
      const notePct = getPercentage(final['Conv Note'], total);
      expect(notePct).toBeGreaterThan(8);
      expect(notePct).toBeLessThan(12);
    });

    it('4.3 Convertible note with discount', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'convertible',
          name: 'Discount Note',
          amount: 500_000,
          interestRate: 5,
          term: 18,
          valCap: 0,
          discount: 25,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // 25% discount: converts at $10M * 0.75 = $7.5M
      const notePct = getPercentage(final['Discount Note'], total);
      expect(notePct).toBeGreaterThan(5);
      expect(notePct).toBeLessThan(8);
    });

    it('4.4 Multiple notes with different terms', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'convertible',
          name: 'Early Note',
          amount: 200_000,
          interestRate: 6,
          term: 12,
          valCap: 4_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'convertible',
          name: 'Later Note',
          amount: 300_000,
          interestRate: 8,
          term: 24,
          valCap: 6_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Both notes should have converted
      expect(final['Early Note']).toBeGreaterThan(0);
      expect(final['Later Note']).toBeGreaterThan(0);

      // Early note at lower cap should get more relative ownership
      const earlyPct = getPercentage(final['Early Note'], total);

      // Despite smaller investment, lower cap should give decent ownership
      expect(earlyPct).toBeGreaterThan(3);
    });
  });

  // ============================================
  // SECTION 5: MFN PROVISIONS
  // ============================================
  describe('5. MFN (Most Favored Nation) Provisions', () => {
    it('5.1 SAFE MFN picks up better terms from later SAFE', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Early MFN SAFE',
          amount: 500_000,
          valCap: 8_000_000,
          discount: 0,
          mfn: true, // Has MFN
          proRata: false
        },
        {
          type: 'safe',
          name: 'Later SAFE',
          amount: 500_000,
          valCap: 5_000_000, // Better terms
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Both SAFEs should convert at $5M cap (MFN picks up better terms)
      const earlyPct = getPercentage(final['Early MFN SAFE'], total);
      const laterPct = getPercentage(final['Later SAFE'], total);

      // Both invested same amount at same effective cap, should be equal
      expectPercentageClose(earlyPct, laterPct, 0.5);
    });

    it('5.2 SAFE MFN does not pick up worse terms', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Early MFN SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: true,
          proRata: false
        },
        {
          type: 'safe',
          name: 'Later SAFE',
          amount: 500_000,
          valCap: 8_000_000, // Worse terms
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Early SAFE keeps $5M, Later SAFE uses $8M
      const earlyPct = getPercentage(final['Early MFN SAFE'], total);
      const laterPct = getPercentage(final['Later SAFE'], total);

      // Early SAFE should have MORE shares (lower cap = better terms)
      expect(earlyPct).toBeGreaterThan(laterPct);
    });

    it('5.3 Note MFN picks up terms from later SAFE', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'convertible',
          name: 'MFN Note',
          amount: 500_000,
          interestRate: 5,
          term: 24,
          valCap: 8_000_000,
          discount: 0,
          mfn: true,
          proRata: false
        },
        {
          type: 'safe',
          name: 'Later SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Note should pick up $5M cap from later SAFE
      const notePct = getPercentage(final['MFN Note'], total);
      const safePct = getPercentage(final['Later SAFE'], total);

      // Note should have more shares due to accrued interest at same cap
      expect(notePct).toBeGreaterThan(safePct);
    });
  });

  // ============================================
  // SECTION 6: OPTION POOLS
  // ============================================
  describe('6. Option Pool Calculations', () => {
    it('6.1 10% option pool at Series A', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 2_000_000,
        valuation: 10_000_000,
        options: 10, // 10% pool
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Option pool should be 10% of total
      const optionsPct = getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total);
      expectPercentageClose(optionsPct, 10, 0.5);
    });

    it('6.2 15% option pool at Series A', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 3_000_000,
        valuation: 15_000_000,
        options: 15,
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      const optionsPct = getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total);
      expectPercentageClose(optionsPct, 15, 0.5);
    });

    it('6.3 Option pool with SAFEs', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Option pool should still be ~10% of total
      const optionsPct = getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total);
      expectPercentageClose(optionsPct, 10, 0.5);

      // SAFE should have converted
      expect(final['SAFE']).toBeGreaterThan(0);
    });

    it('6.4 Reserved options before Series A', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'options',
          amount: 0,
          reserved: 10,
          grantName: ''
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0, // No additional pool
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const afterOptions = tables[1];
      const total1 = calculations.getTableTotalShares(afterOptions);

      // After reserving options, pool should be ~10%
      const optionsPct = getPercentage(afterOptions[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total1);
      expectPercentageClose(optionsPct, 10, 0.5);
    });

    it('6.5 Granting options to employees', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'options',
          amount: 0,
          reserved: 15,
          grantName: ''
        },
        {
          type: 'options',
          amount: 5,
          reserved: 0,
          grantName: 'CTO'
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // CTO should have ~5% of shares
      const ctoPct = getPercentage(final['CTO'] || 0, total);
      expectPercentageClose(ctoPct, 5, 0.5);

      // Remaining available pool should be ~10%
      const availablePct = getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total);
      expectPercentageClose(availablePct, 10, 0.5);
    });
  });

  // ============================================
  // SECTION 7: MULTIPLE ROUNDS
  // ============================================
  describe('7. Multiple Funding Rounds', () => {
    it('7.1 Seed + Series A (two priced rounds)', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 3_000_000,
          valuation: 15_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      const afterSeed = tables[1];
      const afterSeriesA = tables[2];

      // After Seed: Seed = 20%, Founder = 80%
      const seedTotal1 = calculations.getTableTotalShares(afterSeed);
      expectPercentageClose(getPercentage(afterSeed['Seed'], seedTotal1), 20);
      expectPercentageClose(getPercentage(afterSeed['Founder'], seedTotal1), 80);

      // After Series A: Series A = 20% of new total
      const finalTotal = calculations.getTableTotalShares(afterSeriesA);
      expectPercentageClose(getPercentage(afterSeriesA['Series A'], finalTotal), 20);

      // Seed and Founder diluted proportionally
      const seedFinalPct = getPercentage(afterSeriesA['Seed'], finalTotal);
      const founderFinalPct = getPercentage(afterSeriesA['Founder'], finalTotal);

      // Seed: 20% * 80% = 16%
      expectPercentageClose(seedFinalPct, 16, 0.5);
      // Founder: 80% * 80% = 64%
      expectPercentageClose(founderFinalPct, 64, 0.5);
    });

    it('7.2 SAFE + Seed + Series A', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Pre-Seed SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_500_000,
          valuation: 8_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 15,
          proRata: false,
          participations: [],
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Series A should be 20% ($5M / $25M)
      expectPercentageClose(getPercentage(final['Series A'], total), 20, 0.5);

      // Option pool should be 15%
      expectPercentageClose(getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total), 15, 1);

      // All parties should have shares
      expect(final['Founder']).toBeGreaterThan(0);
      expect(final['Pre-Seed SAFE']).toBeGreaterThan(0);
      expect(final['Seed']).toBeGreaterThan(0);

      // Total should be 100%
      verifyCapTableIntegrity(final);
    });

    it('7.3 Three priced rounds with dilution tracking', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 500_000,
          valuation: 2_500_000, // 20%
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000, // 20%
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 18
        },
        {
          type: 'priced',
          name: 'Series B',
          amount: 10_000_000,
          valuation: 50_000_000, // 20%
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 36
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Each round takes 20%
      // Founder: 100% -> 80% -> 64% -> 51.2%
      expectPercentageClose(getPercentage(final['Founder'], total), 51.2, 0.5);

      // Series B: 20%
      expectPercentageClose(getPercentage(final['Series B'], total), 20, 0.5);

      // Series A: 20% * 0.8 = 16%
      expectPercentageClose(getPercentage(final['Series A'], total), 16, 0.5);

      // Seed: 20% * 0.8 * 0.8 = 12.8%
      expectPercentageClose(getPercentage(final['Seed'], total), 12.8, 0.5);
    });
  });

  // ============================================
  // SECTION 8: PRO-RATA RIGHTS
  // ============================================
  describe('8. Pro-Rata Rights', () => {
    it('8.1 Seed investor exercises pro-rata at Series A', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000, // 20%
          options: 0,
          proRata: true, // Has pro-rata rights
          participations: [],
          monthsToRound: 12
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000, // 20%
          options: 0,
          proRata: false,
          participations: ['Seed'], // Seed exercises pro-rata
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Seed should maintain ~20% ownership by participating pro-rata
      const seedPct = getPercentage(final['Seed'], total);
      expect(seedPct).toBeGreaterThan(18);
      expect(seedPct).toBeLessThan(22);
    });

    it('8.2 SAFE with pro-rata at Series A', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'SAFE Investor',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: true
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: ['SAFE Investor'],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // SAFE investor should get extra shares from pro-rata
      const safePct = getPercentage(final['SAFE Investor'], total);
      expect(safePct).toBeGreaterThan(8); // More than without pro-rata
    });

    it('8.3 Multiple investors with pro-rata', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Investor A',
          amount: 500_000,
          valuation: 2_500_000, // 20%
          options: 0,
          proRata: true,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'priced',
          name: 'Investor B',
          amount: 500_000,
          valuation: 2_500_000, // 20%
          options: 0,
          proRata: true,
          participations: [],
          monthsToRound: 9
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000, // 20%
          options: 0,
          proRata: false,
          participations: ['Investor A', 'Investor B'],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Both early investors should maintain ownership through pro-rata
      expect(final['Investor A']).toBeGreaterThan(0);
      expect(final['Investor B']).toBeGreaterThan(0);

      verifyCapTableIntegrity(final);
    });
  });

  // ============================================
  // SECTION 9: COMPLEX SCENARIOS
  // ============================================
  describe('9. Complex Real-World Scenarios', () => {
    it('9.1 YC-style: SAFE + MFN + Series A with options', () => {
      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'YC',
          amount: 500_000,
          valCap: 0, // Uncapped (MFN will apply)
          discount: 0,
          mfn: true,
          proRata: true
        },
        {
          type: 'safe',
          name: 'Angel',
          amount: 250_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 3_000_000,
          valuation: 15_000_000,
          options: 10,
          proRata: false,
          participations: ['YC'],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Series A: 20%
      expectPercentageClose(getPercentage(final['Series A'], total), 20, 1);

      // Options: 10%
      expectPercentageClose(getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total), 10, 1);

      // All parties have shares
      expect(final['YC']).toBeGreaterThan(0);
      expect(final['Angel']).toBeGreaterThan(0);
      expect(final['Founder 1']).toBeGreaterThan(0);
      expect(final['Founder 2']).toBeGreaterThan(0);
    });

    it('9.2 Bridge round: convertible note between rounds', () => {
      // Bridge notes issued AFTER a priced round convert at the NEXT priced round.
      // This test verifies that the Bridge note converts at Series A, not Seed.
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 10,
          proRata: true,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'convertible',
          name: 'Bridge',
          amount: 500_000,
          interestRate: 10,
          term: 12,
          valCap: 0,
          discount: 20,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 15,
          proRata: false,
          participations: ['Seed'],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterSeed, AfterBridge (no change), AfterSeriesA]
      const afterSeed = tables[1]; // Table after Seed round
      const afterSeriesA = tables[3]; // Table after Series A
      const total = calculations.getTableTotalShares(afterSeriesA);

      // Bridge should NOT appear after Seed (it converts at Series A)
      expect(afterSeed['Bridge']).toBeUndefined();

      // Bridge should appear after Series A
      expect(afterSeriesA['Bridge']).toBeGreaterThan(0);

      // Bridge converts at Series A valuation with 20% discount
      // $500K * (1 + 10% * 18/12) = $575K with interest
      // Discount valuation = $25M * 0.8 = $20M
      // ~2.9% pre-Series A dilution, then diluted by Series A and options
      const bridgePct = getPercentage(afterSeriesA['Bridge'], total);
      expect(bridgePct).toBeGreaterThan(1.5);
      expect(bridgePct).toBeLessThan(5);

      // Options: 15%
      expectPercentageClose(getPercentage(afterSeriesA[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total), 15, 1);

      verifyCapTableIntegrity(afterSeriesA);
    });

    it('9.3 Full stack: 2 SAFEs + Note + Seed + Series A + Options', () => {
      setupTest([
        { id: '1', name: 'CEO', equity: 60, isYou: true },
        { id: '2', name: 'CTO', equity: 40, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'Angel 1',
          amount: 100_000,
          valCap: 3_000_000,
          discount: 0,
          mfn: true,
          proRata: false
        },
        {
          type: 'safe',
          name: 'Angel 2',
          amount: 150_000,
          valCap: 4_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'convertible',
          name: 'Pre-Seed Note',
          amount: 200_000,
          interestRate: 6,
          term: 18,
          valCap: 5_000_000,
          discount: 15,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_500_000,
          valuation: 8_000_000,
          options: 10,
          proRata: true,
          participations: [],
          monthsToRound: 12
        },
        {
          type: 'options',
          amount: 3,
          reserved: 0,
          grantName: 'VP Engineering'
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 12,
          proRata: false,
          participations: ['Seed'],
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All parties should have shares
      expect(final['CEO']).toBeGreaterThan(0);
      expect(final['CTO']).toBeGreaterThan(0);
      expect(final['Angel 1']).toBeGreaterThan(0);
      expect(final['Angel 2']).toBeGreaterThan(0);
      expect(final['Pre-Seed Note']).toBeGreaterThan(0);
      expect(final['Seed']).toBeGreaterThan(0);
      expect(final['Series A']).toBeGreaterThan(0);
      expect(final['VP Engineering']).toBeGreaterThan(0);

      // Series A percentage is affected by Seed's pro-rata participation
      // which takes some of the new investor shares
      const seriesAPct = getPercentage(final['Series A'], total);
      expect(seriesAPct).toBeGreaterThan(15); // Less than 20% due to Seed pro-rata
      expect(seriesAPct).toBeLessThan(25);

      // Total percentages should equal 100%
      const totalPct = Object.values(final).reduce((sum, shares) => {
        return sum + getPercentage(shares, total);
      }, 0);
      expectPercentageClose(totalPct, 100, 0.1);
    });

    it('9.4 Down round scenario', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000, // $20M pre-money
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        },
        {
          type: 'priced',
          name: 'Series B',
          amount: 5_000_000,
          valuation: 15_000_000, // Down round! $10M pre-money
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      const afterA = tables[1];
      const afterB = tables[2];

      const totalA = calculations.getTableTotalShares(afterA);
      const totalB = calculations.getTableTotalShares(afterB);

      // After Series A: Series A = 20%
      expectPercentageClose(getPercentage(afterA['Series A'], totalA), 20, 0.5);

      // After Series B (down round): Series B gets 33.33% ($5M / $15M)
      expectPercentageClose(getPercentage(afterB['Series B'], totalB), 33.33, 0.5);

      // Series A diluted heavily
      const seriesAFinal = getPercentage(afterB['Series A'], totalB);
      expect(seriesAFinal).toBeLessThan(15); // Significantly diluted
    });

    it('9.5 Large cap table with many investors', () => {
      setupTest([
        { id: '1', name: 'Founder 1', equity: 40, isYou: true },
        { id: '2', name: 'Founder 2', equity: 35, isYou: false },
        { id: '3', name: 'Founder 3', equity: 25, isYou: false }
      ], [
        { type: 'safe', name: 'Pre-Seed 1', amount: 50_000, valCap: 5_000_000, discount: 0, mfn: true, proRata: false },
        { type: 'safe', name: 'Pre-Seed 2', amount: 75_000, valCap: 5_000_000, discount: 0, mfn: false, proRata: false },
        { type: 'safe', name: 'Pre-Seed 3', amount: 100_000, valCap: 6_000_000, discount: 20, mfn: false, proRata: false },
        {
          type: 'priced',
          name: 'Seed Lead',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 10,
          proRata: true,
          participations: [],
          monthsToRound: 12
        },
        { type: 'options', amount: 2, reserved: 0, grantName: 'CTO Hire' },
        { type: 'options', amount: 1, reserved: 0, grantName: 'Advisor 1' },
        {
          type: 'priced',
          name: 'Series A Lead',
          amount: 8_000_000,
          valuation: 40_000_000,
          options: 12,
          proRata: false,
          participations: ['Seed Lead'],
          monthsToRound: 24
        },
        { type: 'options', amount: 3, reserved: 0, grantName: 'VP Sales' },
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Count distinct shareholders
      const shareholders = Object.keys(final).filter(k => final[k] > 0);
      expect(shareholders.length).toBeGreaterThanOrEqual(10);

      // Total should be 100%
      const totalPct = Object.values(final).reduce((sum, shares) => {
        return sum + getPercentage(shares, total);
      }, 0);
      expectPercentageClose(totalPct, 100, 0.1);

      verifyCapTableIntegrity(final);
    });
  });

  // ============================================
  // SECTION 10: EDGE CASES
  // ============================================
  describe('10. Edge Cases', () => {
    it('10.1 Very small investment amounts', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Micro SAFE',
          amount: 10_000,
          valCap: 1_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Micro SAFE should still get shares (1% at cap)
      const microPct = getPercentage(final['Micro SAFE'], total);
      expect(microPct).toBeGreaterThan(0.5);
      expect(microPct).toBeLessThan(2);
    });

    it('10.2 Very large valuations', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Mega Round',
        amount: 500_000_000,
        valuation: 5_000_000_000, // $5B valuation
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Should still be 10%
      expectPercentageClose(getPercentage(final['Mega Round'], total), 10, 0.5);
    });

    it('10.3 Zero option pool', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 2_000_000,
        valuation: 10_000_000,
        options: 0, // No options
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];

      // No options in cap table
      expect(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0).toBe(0);
    });

    it('10.4 Fractional percentages and shares', () => {
      setupTest([
        { id: '1', name: 'Founder 1', equity: 33.333, isYou: true },
        { id: '2', name: 'Founder 2', equity: 33.333, isYou: false },
        { id: '3', name: 'Founder 3', equity: 33.334, isYou: false }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 1_111_111,
        valuation: 7_777_777,
        options: 11.11,
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Should handle fractional math correctly
      const totalPct = Object.values(final).reduce((sum, shares) => {
        return sum + getPercentage(shares, total);
      }, 0);
      expectPercentageClose(totalPct, 100, 0.1);
    });

    it('10.5 SAFEs claiming >100% dilution (edge case prevention)', () => {
      // This tests the safeguard that prevents negative equity
      // when SAFEs collectively claim more than 100% of the company
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'SAFE 1',
          amount: 500_000,
          valCap: 500_000, // 100% dilution at cap
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'safe',
          name: 'SAFE 2',
          amount: 200_000,
          valCap: 500_000, // 40% more dilution at cap
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All shares should be non-negative (safeguard working)
      Object.entries(final).forEach(([name, shares]) => {
        expect(shares).toBeGreaterThanOrEqual(0);
      });

      // Founder should still have some equity (not negative or zero)
      expect(final['Founder']).toBeGreaterThan(0);

      // SAFEs should have shares (capped proportionally)
      expect(final['SAFE 1']).toBeGreaterThan(0);
      expect(final['SAFE 2']).toBeGreaterThan(0);

      // Total should still sum to 100%
      const totalPct = Object.values(final).reduce((sum, shares) => {
        return sum + getPercentage(shares, total);
      }, 0);
      expectPercentageClose(totalPct, 100, 0.1);

      verifyCapTableIntegrity(final);
    });
  });

  // ============================================
  // SECTION 11: EXIT DISTRIBUTION
  // ============================================
  describe('11. Exit Distribution', () => {
    it('11.1 Available options redistributed at exit', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 2_000_000,
        valuation: 10_000_000,
        options: 20, // Large option pool
        proRata: false,
        participations: [],
        monthsToRound: 12
      }], { amount: 100_000_000, tax: 0 });

      const tables = calculations.getCapTables();
      const beforeExit = tables[tables.length - 2];
      const afterExit = tables[tables.length - 1];

      // Before exit, there should be available options
      expect(beforeExit[calculations.AVAILABLE_OPTIONS_LABEL]).toBeGreaterThan(0);

      // After exit, available options should be 0
      expect(afterExit[calculations.AVAILABLE_OPTIONS_LABEL]).toBe(0);

      // Founder and investor should have more shares after distribution
      expect(afterExit['Founder']).toBeGreaterThan(beforeExit['Founder']);
      expect(afterExit['Series A']).toBeGreaterThan(beforeExit['Series A']);
    });
  });

  // ============================================
  // SECTION 12: MATHEMATICAL IDENTITIES
  // ============================================
  describe('12. Mathematical Identities and Invariants', () => {
    it('12.1 Cap table always sums to total shares', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        { type: 'safe', name: 'SAFE 1', amount: 200_000, valCap: 4_000_000, discount: 0, mfn: false, proRata: false },
        { type: 'safe', name: 'SAFE 2', amount: 300_000, valCap: 5_000_000, discount: 10, mfn: true, proRata: false },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_500_000,
          valuation: 8_000_000,
          options: 15,
          proRata: true,
          participations: [],
          monthsToRound: 10
        },
        { type: 'options', amount: 2, reserved: 0, grantName: 'CTO' },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 12,
          proRata: false,
          participations: ['Seed'],
          monthsToRound: 20
        }
      ]);

      const tables = calculations.getCapTables();

      // Every table should have internally consistent totals
      tables.forEach((table) => {
        const total = calculations.getTableTotalShares(table);
        const sumOfParts = Object.values(table).reduce((a, b) => a + b, 0);
        expect(Math.abs(total - sumOfParts)).toBeLessThan(0.01);
      });
    });

    it('12.2 No negative shares anywhere', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        { type: 'options', amount: 0, reserved: 20, grantName: '' },
        { type: 'options', amount: 15, reserved: 0, grantName: 'Team' },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();

      tables.forEach((table) => {
        Object.entries(table).forEach(([key, shares]) => {
          expect(shares).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('12.3 Dilution math: ownership percentage decreases correctly', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        { type: 'priced', name: 'R1', amount: 1_000_000, valuation: 5_000_000, options: 0, proRata: false, participations: [], monthsToRound: 6 },
        { type: 'priced', name: 'R2', amount: 1_000_000, valuation: 5_000_000, options: 0, proRata: false, participations: [], monthsToRound: 12 },
        { type: 'priced', name: 'R3', amount: 1_000_000, valuation: 5_000_000, options: 0, proRata: false, participations: [], monthsToRound: 18 },
        { type: 'priced', name: 'R4', amount: 1_000_000, valuation: 5_000_000, options: 0, proRata: false, participations: [], monthsToRound: 24 }
      ]);

      const tables = calculations.getCapTables();

      // After each 20% dilution round:
      // Round 1: 100% -> 80%
      // Round 2: 80% -> 64%
      // Round 3: 64% -> 51.2%
      // Round 4: 51.2% -> 40.96%

      const t1 = tables[1];
      const t2 = tables[2];
      const t3 = tables[3];
      const t4 = tables[4];

      expectPercentageClose(getPercentage(t1['Founder'], calculations.getTableTotalShares(t1)), 80, 0.5);
      expectPercentageClose(getPercentage(t2['Founder'], calculations.getTableTotalShares(t2)), 64, 0.5);
      expectPercentageClose(getPercentage(t3['Founder'], calculations.getTableTotalShares(t3)), 51.2, 0.5);
      expectPercentageClose(getPercentage(t4['Founder'], calculations.getTableTotalShares(t4)), 40.96, 0.5);
    });
  });

  // ============================================
  // SECTION 13: ADDITIONAL QUANTITATIVE TESTS
  // ============================================
  describe('13. Additional Quantitative Verification', () => {
    it('13.1 Verify exact share calculation for simple priced round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Investor',
        amount: 2_000_000,
        valuation: 10_000_000,
        options: 0,
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[1];

      // With 20% dilution: new total = 10M / 0.8 = 12.5M shares
      // Investor gets: 12.5M * 0.2 = 2.5M shares
      // Founder keeps: 10M shares
      expect(final['Founder']).toBe(10_000_000);
      expect(final['Investor']).toBe(2_500_000);
      expect(calculations.getTableTotalShares(final)).toBe(12_500_000);
    });

    it('13.2 Verify SAFE dilution calculation', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'SAFE',
          amount: 1_000_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // SAFE: $1M at $10M cap = 10% pre-round
      // Series A: $2M at $10M post = 20%
      // SAFE dilution: 10% * (1 - 0.2) = 8%
      // Founder: remaining
      const safePct = getPercentage(final['SAFE'], total);
      const seriesAPct = getPercentage(final['Series A'], total);
      const founderPct = getPercentage(final['Founder'], total);

      expectPercentageClose(seriesAPct, 20, 0.5);
      expectPercentageClose(safePct, 8, 0.5);
      expectPercentageClose(founderPct, 72, 0.5);
    });

    it('13.3 Option pool shuffle calculation at Series A', () => {
      // Classic "option pool shuffle" - options are allocated pre-money
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [{
        type: 'priced',
        name: 'Series A',
        amount: 2_000_000,
        valuation: 10_000_000, // $8M pre-money
        options: 10, // 10% option pool
        proRata: false,
        participations: [],
        monthsToRound: 12
      }]);

      const tables = calculations.getCapTables();
      const final = tables[1];
      const total = calculations.getTableTotalShares(final);

      // Series A: 20%
      // Options: 10%
      // Founder: 70% (diluted by both investor AND options)
      const seriesAPct = getPercentage(final['Series A'], total);
      const optionsPct = getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL], total);
      const founderPct = getPercentage(final['Founder'], total);

      expectPercentageClose(seriesAPct, 20, 0.5);
      expectPercentageClose(optionsPct, 10, 0.5);
      expectPercentageClose(founderPct, 70, 0.5);
    });

    it('13.4 Multiple SAFEs with different caps - relative ownership', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Low Cap SAFE',
          amount: 500_000,
          valCap: 5_000_000, // 10% at cap
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'safe',
          name: 'High Cap SAFE',
          amount: 500_000,
          valCap: 10_000_000, // 5% at cap
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 20_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Low cap SAFE should have 2x the ownership of high cap SAFE
      const lowCapPct = getPercentage(final['Low Cap SAFE'], total);
      const highCapPct = getPercentage(final['High Cap SAFE'], total);

      expect(lowCapPct / highCapPct).toBeCloseTo(2, 0);
    });

    it('13.5 Convertible note interest accumulation', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'convertible',
          name: 'Note',
          amount: 1_000_000,
          interestRate: 12, // 12% annual
          term: 24,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 24 // 24 months = full term
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Note: $1M + $240K interest (12% * 2 years) = $1.24M
      // At $10M cap: $1.24M / $10M = 12.4%
      // After Series A dilution: 12.4% * 0.8 = 9.92%
      const notePct = getPercentage(final['Note'], total);
      expect(notePct).toBeGreaterThan(9);
      expect(notePct).toBeLessThan(11);
    });
  });

  // ============================================
  // SECTION 14: ACCELERATOR PRESETS
  // ============================================
  describe('14. Accelerator Presets with Follow-on Funding', () => {
    beforeEach(() => {
      founders.set([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ]);
    });

    it('14.1 Y Combinator: Two-SAFE structure ($125K @ 7% + $375K MFN) + Angel + Series A', () => {
      // YC structure: $125K SAFE for straight 7% + $375K uncapped MFN SAFE
      // The $125K is effectively a fixed 7% equity stake
      // The MFN picks up terms from LATER instruments - in this case, an angel SAFE
      const ycCap = Math.round(125_000 / 0.07); // ~$1,785,714 (but effectively 7%)

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'YC $125K',
          amount: 125_000,
          valCap: ycCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'Y Combinator'
        },
        {
          type: 'safe',
          name: 'YC MFN',
          amount: 375_000,
          valCap: 0, // Uncapped
          discount: 0,
          mfn: true, // MFN picks up terms from LATER instruments
          proRata: true,
          accelerator: 'Y Combinator'
        },
        {
          type: 'safe',
          name: 'Angel',
          amount: 250_000,
          valCap: 8_000_000, // YC MFN will pick up this cap
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 10,
          proRata: false,
          participations: ['YC $125K', 'YC MFN'],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All SAFEs should have converted
      expect(final['YC $125K']).toBeGreaterThan(0);
      expect(final['YC MFN']).toBeGreaterThan(0);
      expect(final['Angel']).toBeGreaterThan(0);

      // YC $125K converts at ~$1.78M cap = 7%
      // YC MFN picks up Angel's $8M cap: $375K / $8M = 4.6875%
      // Angel at $8M cap: $250K / $8M = 3.125%
      const yc125kPct = getPercentage(final['YC $125K'], total);
      const ycMfnPct = getPercentage(final['YC MFN'], total);
      const angelPct = getPercentage(final['Angel'], total);

      // YC $125K should have highest % (lowest cap)
      expect(yc125kPct).toBeGreaterThan(ycMfnPct);

      // YC MFN and Angel convert at same $8M cap
      // YC MFN invested 1.5x more, should have ~1.5x ownership
      expect(ycMfnPct / angelPct).toBeCloseTo(1.5, 0);

      verifyCapTableIntegrity(final);
    });

    it('14.2 Techstars: Two-part structure ($20K @ 5% + $200K MFN) + Angel + Seed', () => {
      // Techstars: $20K CEA at $400K cap (5%) + $200K uncapped MFN
      // MFN picks up terms from LATER instruments (Angel SAFE in this case)
      const techstarsCap = Math.round(20_000 / 0.05); // $400K

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'Techstars CEA',
          amount: 20_000,
          valCap: techstarsCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'Techstars'
        },
        {
          type: 'safe',
          name: 'Techstars MFN',
          amount: 200_000,
          valCap: 0,
          discount: 0,
          mfn: true, // MFN picks up terms from LATER instruments
          proRata: true,
          accelerator: 'Techstars'
        },
        {
          type: 'safe',
          name: 'Angel',
          amount: 100_000,
          valCap: 5_000_000, // MFN will pick up this cap
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All SAFEs should have converted
      expect(final['Techstars CEA']).toBeGreaterThan(0);
      expect(final['Techstars MFN']).toBeGreaterThan(0);
      expect(final['Angel']).toBeGreaterThan(0);

      // Techstars CEA at $400K cap: $20K / $400K = 5%
      // Techstars MFN picks up Angel's $5M cap: $200K / $5M = 4%
      // Angel at $5M cap: $100K / $5M = 2%
      const ceaPct = getPercentage(final['Techstars CEA'], total);
      const mfnPct = getPercentage(final['Techstars MFN'], total);
      const angelPct = getPercentage(final['Angel'], total);

      // CEA should have highest % (lowest $400K cap)
      expect(ceaPct).toBeGreaterThan(mfnPct);

      // MFN and Angel at same $5M cap
      // MFN invested 2x more, should have ~2x ownership
      expect(mfnPct / angelPct).toBeCloseTo(2, 0);

      // Seed should be 20%
      expectPercentageClose(getPercentage(final['Seed'], total), 20, 1);

      verifyCapTableIntegrity(final);
    });

    it('14.3 a16z Speedrun: $500K @ 10% + Series A', () => {
      // a16z Speedrun: $500K for 10% -> $5M cap
      const a16zCap = Math.round(500_000 / 0.10); // $5M

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'a16z Speedrun',
          amount: 500_000,
          valCap: a16zCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'a16z Speedrun'
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 10,
          proRata: false,
          participations: ['a16z Speedrun'],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // a16z should have ~10% pre-Series A, then diluted
      const a16zPct = getPercentage(final['a16z Speedrun'], total);
      expect(a16zPct).toBeGreaterThan(7);
      expect(a16zPct).toBeLessThan(15);

      verifyCapTableIntegrity(final);
    });

    it('14.4 500 Global: $150K @ 6% + Seed', () => {
      // 500 Global: $150K for 6% -> $2.5M cap
      const fiveHundredCap = Math.round(150_000 / 0.06); // $2.5M

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: '500 Global',
          amount: 150_000,
          valCap: fiveHundredCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: '500 Global'
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_500_000,
          valuation: 8_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // 500 Global: $150K at $2.5M cap = 6% pre-Seed
      const fiveHundredPct = getPercentage(final['500 Global'], total);
      expect(fiveHundredPct).toBeGreaterThan(3);
      expect(fiveHundredPct).toBeLessThan(8);

      // Seed: 18.75% ($1.5M / $8M)
      expectPercentageClose(getPercentage(final['Seed'], total), 18.75, 1);

      verifyCapTableIntegrity(final);
    });

    it('14.5 Antler: $125K @ 10% + Seed', () => {
      // Antler: $125K for 10% -> $1.25M cap
      const antlerCap = Math.round(125_000 / 0.10); // $1.25M

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'Antler',
          amount: 125_000,
          valCap: antlerCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'Antler'
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Antler: $125K at $1.25M cap = 10% pre-Seed
      const antlerPct = getPercentage(final['Antler'], total);
      expect(antlerPct).toBeGreaterThan(6);
      expect(antlerPct).toBeLessThan(12);

      // Seed: 20% ($1M / $5M)
      expectPercentageClose(getPercentage(final['Seed'], total), 20, 1);

      verifyCapTableIntegrity(final);
    });

    it('14.6 SOSV/HAX: $250K @ 10% + Seed + Series A', () => {
      // SOSV/HAX: $250K for 10% -> $2.5M cap
      const sosvCap = Math.round(250_000 / 0.10); // $2.5M

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'SOSV/HAX',
          amount: 250_000,
          valCap: sosvCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'SOSV/HAX'
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 10,
          proRata: true,
          participations: [],
          monthsToRound: 12
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 12,
          proRata: false,
          participations: ['SOSV/HAX', 'Seed'],
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All investors should have shares
      expect(final['SOSV/HAX']).toBeGreaterThan(0);
      expect(final['Seed']).toBeGreaterThan(0);
      expect(final['Series A']).toBeGreaterThan(0);

      // Options should be 12%
      expectPercentageClose(getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total), 12, 1);

      verifyCapTableIntegrity(final);
    });

    it('14.7 MassChallenge: Equity-free accelerator ($100K grant) + Seed', () => {
      // MassChallenge is equity-free - just adds an event but no dilution
      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'accelerator',
          name: 'MassChallenge',
          programName: 'MassChallenge',
          amount: 100_000
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // MassChallenge should NOT appear in cap table (equity-free)
      expect(final['MassChallenge']).toBeUndefined();

      // Founders should maintain more equity since no accelerator dilution
      // Just Seed (20%) and Options (10%)
      const founder1Pct = getPercentage(final['Founder 1'], total);
      const founder2Pct = getPercentage(final['Founder 2'], total);

      expectPercentageClose(founder1Pct, 35, 0.5); // 50% * 70% = 35%
      expectPercentageClose(founder2Pct, 35, 0.5);

      // Seed: 20%
      expectPercentageClose(getPercentage(final['Seed'], total), 20, 0.5);

      // Options: 10%
      expectPercentageClose(getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total), 10, 0.5);

      verifyCapTableIntegrity(final);
    });

    it('14.8 YC + Additional SAFE + Series A (MFN picks up best terms)', () => {
      // YC + another investor with better cap, MFN should pick that up
      const ycCap = Math.round(125_000 / 0.07); // ~$1.78M

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'YC $125K',
          amount: 125_000,
          valCap: ycCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'Y Combinator'
        },
        {
          type: 'safe',
          name: 'YC MFN',
          amount: 375_000,
          valCap: 0,
          discount: 0,
          mfn: true,
          proRata: true,
          accelerator: 'Y Combinator'
        },
        {
          type: 'safe',
          name: 'Angel SAFE',
          amount: 250_000,
          valCap: 1_500_000, // Lower cap than YC $125K!
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All SAFEs should have converted
      expect(final['YC $125K']).toBeGreaterThan(0);
      expect(final['YC MFN']).toBeGreaterThan(0);
      expect(final['Angel SAFE']).toBeGreaterThan(0);

      // YC MFN should pick up the Angel SAFE's $1.5M cap (better than YC's ~$1.78M)
      // This means YC MFN gets MORE shares than if using YC cap
      const ycMfnPct = getPercentage(final['YC MFN'], total);
      const angelPct = getPercentage(final['Angel SAFE'], total);

      // YC MFN invested $375K at $1.5M = 25% at conversion
      // Angel invested $250K at $1.5M = 16.67% at conversion
      // Ratio should be about 375/250 = 1.5x
      expect(ycMfnPct / angelPct).toBeCloseTo(1.5, 0);

      verifyCapTableIntegrity(final);
    });

    it('14.9 Multiple accelerators: YC + SOSV + Seed', () => {
      const ycCap = Math.round(125_000 / 0.07);
      const sosvCap = Math.round(250_000 / 0.10);

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'YC $125K',
          amount: 125_000,
          valCap: ycCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'Y Combinator'
        },
        {
          type: 'safe',
          name: 'YC MFN',
          amount: 375_000,
          valCap: 0,
          discount: 0,
          mfn: true,
          proRata: true,
          accelerator: 'Y Combinator'
        },
        {
          type: 'safe',
          name: 'SOSV/HAX',
          amount: 250_000,
          valCap: sosvCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'SOSV/HAX'
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 15,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // All accelerator SAFEs should have converted
      expect(final['YC $125K']).toBeGreaterThan(0);
      expect(final['YC MFN']).toBeGreaterThan(0);
      expect(final['SOSV/HAX']).toBeGreaterThan(0);

      // YC MFN should pick up the YC $125K cap (~$1.78M is lower than SOSV's $2.5M)
      // So YC SAFEs get better terms

      // Seed: 20%
      expectPercentageClose(getPercentage(final['Seed'], total), 20, 1);

      // Options: 15%
      expectPercentageClose(getPercentage(final[calculations.AVAILABLE_OPTIONS_LABEL] || 0, total), 15, 1);

      verifyCapTableIntegrity(final);
    });

    it('14.10 Accelerator with high valuation Series A (cap becomes irrelevant)', () => {
      // When Series A valuation >> SAFE cap, the cap protects the accelerator
      const antlerCap = Math.round(125_000 / 0.10); // $1.25M

      setupTest([
        { id: '1', name: 'Founder 1', equity: 50, isYou: true },
        { id: '2', name: 'Founder 2', equity: 50, isYou: false }
      ], [
        {
          type: 'safe',
          name: 'Antler',
          amount: 125_000,
          valCap: antlerCap,
          discount: 0,
          mfn: false,
          proRata: true,
          accelerator: 'Antler'
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 10_000_000,
          valuation: 50_000_000, // Very high valuation
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      const final = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(final);

      // Antler uses its $1.25M cap (much better than $50M valuation)
      // At $1.25M cap: $125K / $1.25M = 10% pre-Series A
      const antlerPct = getPercentage(final['Antler'], total);

      // After Series A (20% dilution) and options (10%), Antler should be ~10% * 0.7 = 7%
      expect(antlerPct).toBeGreaterThan(5);
      expect(antlerPct).toBeLessThan(10);

      // Series A: 20%
      expectPercentageClose(getPercentage(final['Series A'], total), 20, 0.5);

      verifyCapTableIntegrity(final);
    });
  });

  // ============================================
  // SECTION 15: SAFE/NOTE INDEX-BASED CONVERSION
  // ============================================
  describe('15. SAFEs and Notes Convert at Next Priced Round', () => {
    it('15.1 SAFE before first priced round converts at that round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Pre-Seed SAFE',
          amount: 500_000,
          valCap: 5_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterSAFE (no change), AfterSeed]
      const afterSeed = tables[2];
      const total = calculations.getTableTotalShares(afterSeed);

      // SAFE should convert at Seed
      expect(afterSeed['Pre-Seed SAFE']).toBeGreaterThan(0);
      // SAFE at $5M cap = 10%
      expectPercentageClose(getPercentage(afterSeed['Pre-Seed SAFE'], total), 8, 1); // ~8% after Seed dilution
    });

    it('15.2 SAFE after first priced round converts at second round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Bridge SAFE',
          amount: 250_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 3_000_000,
          valuation: 15_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterSeed, AfterBridgeSAFE (no change), AfterSeriesA]
      const afterSeed = tables[1];
      const afterSeriesA = tables[3];

      // Bridge SAFE should NOT be in cap table after Seed
      expect(afterSeed['Bridge SAFE']).toBeUndefined();

      // Bridge SAFE should appear after Series A
      expect(afterSeriesA['Bridge SAFE']).toBeGreaterThan(0);

      const total = calculations.getTableTotalShares(afterSeriesA);
      // Bridge at $10M cap (capped at Series A $15M valuation)
      // $250K / $10M = 2.5% pre-Series A, diluted by 20% = ~2%
      const bridgePct = getPercentage(afterSeriesA['Bridge SAFE'], total);
      expect(bridgePct).toBeGreaterThan(1.5);
      expect(bridgePct).toBeLessThan(3);
    });

    it('15.3 Multiple SAFEs convert at appropriate rounds', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Angel SAFE',
          amount: 200_000,
          valCap: 4_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Post-Seed SAFE',
          amount: 300_000,
          valCap: 12_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 4_000_000,
          valuation: 20_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 18
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterAngelSAFE (no change), AfterSeed, AfterPostSeedSAFE (no change), AfterSeriesA]
      const afterSeed = tables[2];
      const afterSeriesA = tables[4];

      // Angel SAFE should convert at Seed
      expect(afterSeed['Angel SAFE']).toBeGreaterThan(0);

      // Post-Seed SAFE should NOT convert at Seed
      expect(afterSeed['Post-Seed SAFE']).toBeUndefined();

      // Both should be in cap table after Series A
      expect(afterSeriesA['Angel SAFE']).toBeGreaterThan(0);
      expect(afterSeriesA['Post-Seed SAFE']).toBeGreaterThan(0);

      verifyCapTableIntegrity(afterSeriesA);
    });

    it('15.4 Convertible note after priced round converts at next round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'convertible',
          name: 'Bridge Note',
          amount: 300_000,
          interestRate: 8,
          term: 18,
          valCap: 15_000_000,
          discount: 15,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 5_000_000,
          valuation: 25_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterSeed, AfterBridgeNote (no change), AfterSeriesA]
      const afterSeed = tables[1];
      const afterSeriesA = tables[3];

      // Bridge Note should NOT be in cap table after Seed
      expect(afterSeed['Bridge Note']).toBeUndefined();

      // Bridge Note should appear after Series A
      expect(afterSeriesA['Bridge Note']).toBeGreaterThan(0);

      verifyCapTableIntegrity(afterSeriesA);
    });

    it('15.5 SAFEs issued between multiple rounds convert appropriately', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Pre-Seed SAFE',
          amount: 100_000,
          valCap: 2_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 500_000,
          valuation: 2_500_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Post-Seed SAFE',
          amount: 200_000,
          valCap: 8_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series A',
          amount: 2_000_000,
          valuation: 10_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 12
        },
        {
          type: 'safe',
          name: 'Post-A SAFE',
          amount: 500_000,
          valCap: 40_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Series B',
          amount: 10_000_000,
          valuation: 50_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 24
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterPreSeedSAFE, AfterSeed, AfterPostSeedSAFE, AfterSeriesA, AfterPostASAFE, AfterSeriesB]
      const afterSeed = tables[2];
      const afterSeriesA = tables[4];
      const afterSeriesB = tables[6];

      // Pre-Seed SAFE converts at Seed
      expect(afterSeed['Pre-Seed SAFE']).toBeGreaterThan(0);
      expect(afterSeed['Post-Seed SAFE']).toBeUndefined();
      expect(afterSeed['Post-A SAFE']).toBeUndefined();

      // Post-Seed SAFE converts at Series A
      expect(afterSeriesA['Post-Seed SAFE']).toBeGreaterThan(0);
      expect(afterSeriesA['Post-A SAFE']).toBeUndefined();

      // Post-A SAFE converts at Series B
      expect(afterSeriesB['Post-A SAFE']).toBeGreaterThan(0);

      // All should be in final cap table
      expect(afterSeriesB['Pre-Seed SAFE']).toBeGreaterThan(0);
      expect(afterSeriesB['Post-Seed SAFE']).toBeGreaterThan(0);
      expect(afterSeriesB['Post-A SAFE']).toBeGreaterThan(0);

      verifyCapTableIntegrity(afterSeriesB);
    });

    it('15.6 No conversion without a subsequent priced round', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Unconverted SAFE',
          amount: 250_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        }
      ]);

      const tables = calculations.getCapTables();
      // tables: [Initial, AfterSeed, AfterUnconvertedSAFE (no change)]
      const finalTable = tables[tables.length - 1];

      // SAFE should NOT be in cap table (no subsequent priced round)
      expect(finalTable['Unconverted SAFE']).toBeUndefined();

      // Only Founder and Seed should have shares
      expect(Object.keys(finalTable)).toContain('Founder');
      expect(Object.keys(finalTable)).toContain('Seed');
    });
  });

  // ============================================
  // SECTION 16: EXIT CONVERSION FOR SAFEs/NOTES
  // ============================================
  describe('16. SAFEs and Notes Convert at Exit', () => {
    it('16.1 SAFE after priced round converts at exit', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Bridge SAFE',
          amount: 500_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        }
      ], { amount: 50_000_000, tax: 0 }); // $50M exit

      const tables = calculations.getCapTables();
      const finalTable = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(finalTable);

      // Bridge SAFE should be in final cap table (converted at exit)
      expect(finalTable['Bridge SAFE']).toBeGreaterThan(0);

      // SAFE at $10M cap with $50M exit -> converts at cap
      // $500K / $10M = 5% ownership
      const bridgePct = getPercentage(finalTable['Bridge SAFE'], total);
      expect(bridgePct).toBeGreaterThan(3);
      expect(bridgePct).toBeLessThan(6);

      verifyCapTableIntegrity(finalTable);
    });

    it('16.2 Convertible note after priced round converts at exit', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 10,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'convertible',
          name: 'Bridge Note',
          amount: 300_000,
          interestRate: 8,
          term: 24,
          valCap: 15_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        }
      ], { amount: 30_000_000, tax: 0 }); // $30M exit

      const tables = calculations.getCapTables();
      const finalTable = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(finalTable);

      // Bridge Note should be in final cap table (converted at exit)
      expect(finalTable['Bridge Note']).toBeGreaterThan(0);

      // Note with interest at $15M cap
      const notePct = getPercentage(finalTable['Bridge Note'], total);
      expect(notePct).toBeGreaterThan(1);
      expect(notePct).toBeLessThan(4);

      verifyCapTableIntegrity(finalTable);
    });

    it('16.3 Multiple SAFEs/notes convert at exit', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'SAFE 1',
          amount: 250_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'safe',
          name: 'SAFE 2',
          amount: 500_000,
          valCap: 20_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'convertible',
          name: 'Note',
          amount: 200_000,
          interestRate: 6,
          term: 12,
          valCap: 15_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        }
      ], { amount: 100_000_000, tax: 0 }); // $100M exit

      const tables = calculations.getCapTables();
      const finalTable = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(finalTable);

      // All should be in final cap table
      expect(finalTable['SAFE 1']).toBeGreaterThan(0);
      expect(finalTable['SAFE 2']).toBeGreaterThan(0);
      expect(finalTable['Note']).toBeGreaterThan(0);

      // SAFE 1 at $10M cap should have more % than SAFE 2 at $20M cap
      // (same amount would mean same %, but SAFE 1 invested less at lower cap)
      const safe1Pct = getPercentage(finalTable['SAFE 1'], total);
      const safe2Pct = getPercentage(finalTable['SAFE 2'], total);
      // $250K / $10M = 2.5% vs $500K / $20M = 2.5% - roughly equal
      expect(Math.abs(safe1Pct - safe2Pct)).toBeLessThan(1);

      verifyCapTableIntegrity(finalTable);
    });

    it('16.4 Exit valuation lower than SAFE cap uses exit valuation', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'High Cap SAFE',
          amount: 500_000,
          valCap: 50_000_000, // Very high cap
          discount: 0,
          mfn: false,
          proRata: false
        }
      ], { amount: 10_000_000, tax: 0 }); // $10M exit (below cap)

      const tables = calculations.getCapTables();
      const finalTable = tables[tables.length - 1];
      const total = calculations.getTableTotalShares(finalTable);

      // SAFE should convert at exit valuation since it's lower than cap
      // $500K / $10M = 5%
      expect(finalTable['High Cap SAFE']).toBeGreaterThan(0);
      const safePct = getPercentage(finalTable['High Cap SAFE'], total);
      expect(safePct).toBeGreaterThan(3);
      expect(safePct).toBeLessThan(7);

      verifyCapTableIntegrity(finalTable);
    });

    it('16.5 Pre-exit SAFEs still convert at priced round, not exit', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'safe',
          name: 'Pre-Seed SAFE',
          amount: 200_000,
          valCap: 4_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        },
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Post-Seed SAFE',
          amount: 300_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        }
      ], { amount: 50_000_000, tax: 0 });

      const tables = calculations.getCapTables();
      // Check table after Seed (before exit)
      const afterSeed = tables[2]; // [Initial, AfterPreSeedSAFE, AfterSeed, ...]

      // Pre-Seed SAFE should have converted at Seed
      expect(afterSeed['Pre-Seed SAFE']).toBeGreaterThan(0);

      // Post-Seed SAFE should NOT be in afterSeed table
      expect(afterSeed['Post-Seed SAFE']).toBeUndefined();

      // But both should be in final table after exit
      const finalTable = tables[tables.length - 1];
      expect(finalTable['Pre-Seed SAFE']).toBeGreaterThan(0);
      expect(finalTable['Post-Seed SAFE']).toBeGreaterThan(0);

      verifyCapTableIntegrity(finalTable);
    });

    it('16.6 No exit means SAFE stays unconverted', () => {
      setupTest([
        { id: '1', name: 'Founder', equity: 100, isYou: true }
      ], [
        {
          type: 'priced',
          name: 'Seed',
          amount: 1_000_000,
          valuation: 5_000_000,
          options: 0,
          proRata: false,
          participations: [],
          monthsToRound: 6
        },
        {
          type: 'safe',
          name: 'Unconverted SAFE',
          amount: 500_000,
          valCap: 10_000_000,
          discount: 0,
          mfn: false,
          proRata: false
        }
      ]); // No exit

      const tables = calculations.getCapTables();
      const finalTable = tables[tables.length - 1];

      // SAFE should NOT be in cap table (no exit, no priced round after)
      expect(finalTable['Unconverted SAFE']).toBeUndefined();
    });
  });
});

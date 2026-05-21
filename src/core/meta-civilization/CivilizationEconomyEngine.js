/**
 * CivilizationEconomyEngine.js — Operational Economy
 *
 * Computes:
 * - Worker economy
 * - Execution cost
 * - Innovation value
 * - Optimization ROI
 * - Strategic investment
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationEconomyEngine extends EventEmitter {
    #config;
    #accounts = new Map();
    #transactions = [];
    #stats = { transactionsRecorded: 0, totalInvestment: 0, totalReturn: 0, roi: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            accounts: config.accounts || ['worker-cost', 'execution-cost', 'innovation-value', 'optimization-roi', 'strategic-investment', 'infra-cost'],
            maxTransactions: config.maxTransactions || 500,
            ...config,
        };
        for (const acc of this.#config.accounts) this.#accounts.set(acc, { balance: 0, history: [] });
    }

    credit(account, amount, reason = '') {
        const acc = this.#accounts.get(account) || { balance: 0, history: [] };
        acc.balance += amount;
        acc.history.push({ type: 'credit', amount, reason, timestamp: Date.now() });
        if (acc.history.length > 50) acc.history = acc.history.slice(-50);
        this.#accounts.set(account, acc);
        this.#recordTransaction('credit', account, amount, reason);
        this.#stats.totalReturn += amount;
    }

    debit(account, amount, reason = '') {
        const acc = this.#accounts.get(account) || { balance: 0, history: [] };
        acc.balance -= amount;
        acc.history.push({ type: 'debit', amount, reason, timestamp: Date.now() });
        if (acc.history.length > 50) acc.history = acc.history.slice(-50);
        this.#accounts.set(account, acc);
        this.#recordTransaction('debit', account, amount, reason);
        this.#stats.totalInvestment += amount;
    }

    computeROI() {
        this.#stats.roi = this.#stats.totalInvestment > 0 ? this.#stats.totalReturn / this.#stats.totalInvestment : 0;
        return this.#stats.roi;
    }

    getBalance(account) { return this.#accounts.get(account)?.balance ?? 0; }
    getAllBalances() { const r = {}; for (const [k, v] of this.#accounts) r[k] = v.balance; return r; }
    getTransactions(limit = 50) { return this.#transactions.slice(-limit); }
    getStats() { return { ...this.#stats, roi: this.computeROI() }; }

    #recordTransaction(type, account, amount, reason) {
        this.#transactions.push({ id: randomUUID(), type, account, amount, reason, timestamp: Date.now() });
        this.#stats.transactionsRecorded++;
        if (this.#transactions.length > this.#config.maxTransactions) this.#transactions = this.#transactions.slice(-this.#config.maxTransactions);
    }
}

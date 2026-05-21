/**
 * SelfReflectionEngine.js — AI Self-Review & Learning
 *
 * AI reviews:
 * - Failures
 * - Strategies
 * - Architecture decisions
 * - Rollback history
 *
 * Learns from the past to improve future decisions.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class SelfReflectionEngine extends EventEmitter {
    #config;
    #reflections = [];
    #lessons = [];
    #reviews = [];
    #stats = {
        reflectionsPerformed: 0,
        lessonsLearned: 0,
        reviewsCompleted: 0,
        improvementsIdentified: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxReflections: config.maxReflections || 300,
            maxLessons: config.maxLessons || 200,
            categories: config.categories || [
                'failure',
                'strategy',
                'architecture',
                'rollback',
                'optimization',
                'governance',
            ],
            ...config,
        };
    }

    /**
     * Perform a reflection on a past event.
     */
    reflect(event) {
        const reflection = {
            id: randomUUID(),
            category: event.category || 'general',
            subject: event.subject,
            whatHappened: event.whatHappened,
            whyItHappened: event.whyItHappened,
            whatWeLearned: event.whatWeLearned,
            whatToImprove: event.whatToImprove,
            severity: event.severity || 'medium',
            timestamp: Date.now(),
        };

        this.#reflections.push(reflection);
        this.#stats.reflectionsPerformed++;

        if (this.#reflections.length > this.#config.maxReflections) {
            this.#reflections = this.#reflections.slice(-this.#config.maxReflections);
        }

        // Extract lesson
        if (event.whatWeLearned) {
            this.#extractLesson(reflection);
        }

        this.emit('reflection:completed', reflection);
        return reflection;
    }

    /**
     * Review a category of past events.
     */
    review(category, events) {
        this.#stats.reviewsCompleted++;

        const patterns = this.#findPatterns(events);
        const improvements = this.#identifyImprovements(patterns);

        const reviewRecord = {
            id: randomUUID(),
            category,
            eventsReviewed: events.length,
            patterns,
            improvements,
            timestamp: Date.now(),
        };

        this.#reviews.push(reviewRecord);
        this.#stats.improvementsIdentified += improvements.length;

        this.emit('review:completed', reviewRecord);
        return reviewRecord;
    }

    /**
     * Get lessons learned.
     */
    getLessons(category) {
        if (category) return this.#lessons.filter(l => l.category === category);
        return [...this.#lessons];
    }

    /**
     * Get reflections.
     */
    getReflections(options = {}) {
        let results = [...this.#reflections];
        if (options.category) results = results.filter(r => r.category === options.category);
        if (options.severity) results = results.filter(r => r.severity === options.severity);
        return results.slice(-(options.limit || 20));
    }

    /**
     * Get reviews.
     */
    getReviews(limit = 10) {
        return this.#reviews.slice(-limit);
    }

    /**
     * Check if a similar failure has occurred before.
     */
    checkPrecedent(event) {
        const similar = this.#reflections.filter(r =>
            r.category === event.category &&
            r.subject === event.subject
        );

        if (similar.length > 0) {
            return {
                hasPrecedent: true,
                occurrences: similar.length,
                lastOccurrence: similar[similar.length - 1],
                lessons: this.#lessons.filter(l => l.category === event.category),
            };
        }

        return { hasPrecedent: false, occurrences: 0 };
    }

    getStats() {
        return { ...this.#stats, totalLessons: this.#lessons.length };
    }

    // --- Internal ---

    #extractLesson(reflection) {
        const lesson = {
            id: randomUUID(),
            category: reflection.category,
            lesson: reflection.whatWeLearned,
            improvement: reflection.whatToImprove,
            source: reflection.id,
            learnedAt: Date.now(),
        };

        this.#lessons.push(lesson);
        this.#stats.lessonsLearned++;

        if (this.#lessons.length > this.#config.maxLessons) {
            this.#lessons = this.#lessons.slice(-this.#config.maxLessons);
        }

        this.emit('lesson:learned', lesson);
    }

    #findPatterns(events) {
        const subjectCount = new Map();
        for (const event of events) {
            const key = event.subject || event.type || 'unknown';
            subjectCount.set(key, (subjectCount.get(key) || 0) + 1);
        }

        const patterns = [];
        for (const [subject, count] of subjectCount) {
            if (count >= 2) {
                patterns.push({ subject, frequency: count, ratio: count / events.length });
            }
        }
        return patterns;
    }

    #identifyImprovements(patterns) {
        return patterns
            .filter(p => p.ratio > 0.2)
            .map(p => ({
                area: p.subject,
                priority: p.ratio > 0.5 ? 'high' : 'medium',
                suggestion: `Recurring pattern in '${p.subject}' — needs systematic fix`,
            }));
    }
}

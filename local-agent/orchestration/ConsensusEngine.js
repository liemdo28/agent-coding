/**
 * local-agent/orchestration/ConsensusEngine.js
 * Phase 23: Consensus Engine for Multi-Agent Decision Making
 */
import { EventEmitter } from 'events';

export class ConsensusEngine extends EventEmitter {
    constructor({ workspaceRoot, config = {} } = {}) {
        super();
        this.root = workspaceRoot;
        this.config = {
            quorumThreshold: 0.5,
            timeoutMs: 30000,
            maxRounds: 5,
            ...config,
        };
        this.sessions = new Map();
        this.history = [];
    }

    createSession({ topic, participants, options = {} }) {
        const session = {
            id: crypto.randomUUID(),
            topic,
            participants: new Set(participants),
            options: { ...this.config, ...options },
            state: 'voting',
            round: 0,
            votes: new Map(),
            position: null,
            createdAt: Date.now(),
        };
        this.sessions.set(session.id, session);
        this.emit('session-created', session);
        return session;
    }

    castVote(sessionId, participantId, position) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);
        if (!session.participants.has(participantId)) throw new Error(`Participant ${participantId} not in session`);
        if (session.state !== 'voting') throw new Error(`Session not in voting state`);

        session.votes.set(participantId, { position, timestamp: Date.now() });
        this.emit('vote-cast', { session, participant: participantId, position });

        if (this._checkQuorum(session)) {
            return this._finalize(session);
        }
        return { session, votes: session.votes.size, quorum: false };
    }

    _checkQuorum(session) {
        const votes = session.votes.size;
        const participants = session.participants.size;
        const ratio = votes / participants;
        return ratio >= session.options.quorumThreshold;
    }

    _finalize(session) {
        const positions = {};
        session.votes.forEach((vote) => {
            positions[vote.position] = (positions[vote.position] || 0) + 1;
        });

        let winner = null;
        let maxVotes = 0;
        Object.entries(positions).forEach(([pos, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                winner = pos;
            }
        });

        session.state = 'decided';
        session.position = winner;
        session.voteCount = maxVotes;
        session.decidedAt = Date.now();

        this.history.push({ ...session });
        this.emit('consensus-reached', session);
        return { session, consensus: true, position: winner, votes: maxVotes };
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    getHistory(limit = 100) {
        return this.history.slice(-limit);
    }

    getStats() {
        return {
            activeSessions: [...this.sessions.values()].filter(s => s.state === 'voting').length,
            totalSessions: this.sessions.size,
            decidedSessions: this.history.length,
        };
    }
}

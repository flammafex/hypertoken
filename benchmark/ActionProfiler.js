/**
 * Action Profiler - Measure action execution performance
 *
 * Phase 3C: Hybrid Integration - Profiling & Planning
 *
 * This profiler measures the execution time of all HyperToken actions
 * to identify bottlenecks and prioritize Rust porting efforts.
 */
import { performance } from 'perf_hooks';
/**
 * ActionProfiler - Tracks action performance
 */
export class ActionProfiler {
    profiles = new Map();
    startTime = 0;
    enabled = true;
    constructor(enabled = true) {
        this.enabled = enabled;
    }
    /**
     * Start profiling session
     */
    start() {
        this.profiles.clear();
        this.startTime = performance.now();
    }
    /**
     * Record action execution
     */
    record(actionType, fn) {
        if (!this.enabled) {
            return fn();
        }
        const start = performance.now();
        try {
            return fn();
        }
        finally {
            const end = performance.now();
            const duration = end - start;
            this.recordTiming(actionType, duration);
        }
    }
    /**
     * Record async action execution
     */
    async recordAsync(actionType, fn) {
        if (!this.enabled) {
            return fn();
        }
        const start = performance.now();
        try {
            return await fn();
        }
        finally {
            const end = performance.now();
            const duration = end - start;
            this.recordTiming(actionType, duration);
        }
    }
    /**
     * Record timing data
     */
    recordTiming(actionType, duration) {
        let profile = this.profiles.get(actionType);
        if (!profile) {
            profile = {
                actionType,
                callCount: 0,
                totalTime: 0,
                avgTime: 0,
                minTime: Infinity,
                maxTime: 0,
                samples: [],
            };
            this.profiles.set(actionType, profile);
        }
        profile.callCount++;
        profile.totalTime += duration;
        profile.minTime = Math.min(profile.minTime, duration);
        profile.maxTime = Math.max(profile.maxTime, duration);
        profile.samples.push(duration);
        profile.avgTime = profile.totalTime / profile.callCount;
    }
    /**
     * Generate profiling report
     */
    getReport() {
        const endTime = performance.now();
        const totalTime = endTime - this.startTime;
        const totalActions = Array.from(this.profiles.values()).reduce((sum, p) => sum + p.callCount, 0);
        return {
            profiles: this.profiles,
            totalActions,
            totalTime,
            startTime: this.startTime,
            endTime,
        };
    }
    /**
     * Get sorted list of actions by various metrics
     */
    getSortedActions(sortBy = 'total') {
        const actions = Array.from(this.profiles.values());
        switch (sortBy) {
            case 'total':
                return actions.sort((a, b) => b.totalTime - a.totalTime);
            case 'avg':
                return actions.sort((a, b) => b.avgTime - a.avgTime);
            case 'max':
                return actions.sort((a, b) => b.maxTime - a.maxTime);
            case 'calls':
                return actions.sort((a, b) => b.callCount - a.callCount);
            default:
                return actions;
        }
    }
    /**
     * Print detailed report
     */
    printReport() {
        const report = this.getReport();
        console.log('='.repeat(80));
        console.log('ACTION PROFILER REPORT');
        console.log('='.repeat(80));
        console.log('');
        console.log(`Total Actions Executed: ${report.totalActions}`);
        console.log(`Total Time: ${report.totalTime.toFixed(2)}ms`);
        console.log(`Unique Action Types: ${report.profiles.size}`);
        console.log('');
        // Top 10 by total time
        console.log('━'.repeat(80));
        console.log('TOP 10 ACTIONS BY TOTAL TIME (Cumulative Impact)');
        console.log('━'.repeat(80));
        console.log('');
        console.log('Rank │ Action Type                    │ Calls │ Total Time │ Avg Time │ % of Total');
        console.log('─'.repeat(80));
        const byTotal = this.getSortedActions('total').slice(0, 10);
        byTotal.forEach((profile, index) => {
            const pct = ((profile.totalTime / report.totalTime) * 100).toFixed(1);
            console.log(`${(index + 1).toString().padStart(4)} │ ` +
                `${profile.actionType.padEnd(30)} │ ` +
                `${profile.callCount.toString().padStart(5)} │ ` +
                `${profile.totalTime.toFixed(2).padStart(10)}ms │ ` +
                `${profile.avgTime.toFixed(2).padStart(8)}ms │ ` +
                `${pct.padStart(7)}%`);
        });
        console.log('');
        // Top 10 by avg time
        console.log('━'.repeat(80));
        console.log('TOP 10 ACTIONS BY AVG TIME (Per-Call Slowness)');
        console.log('━'.repeat(80));
        console.log('');
        console.log('Rank │ Action Type                    │ Calls │   Avg Time │  Min Time │  Max Time');
        console.log('─'.repeat(80));
        const byAvg = this.getSortedActions('avg').slice(0, 10);
        byAvg.forEach((profile, index) => {
            console.log(`${(index + 1).toString().padStart(4)} │ ` +
                `${profile.actionType.padEnd(30)} │ ` +
                `${profile.callCount.toString().padStart(5)} │ ` +
                `${profile.avgTime.toFixed(2).padStart(10)}ms │ ` +
                `${profile.minTime.toFixed(2).padStart(9)}ms │ ` +
                `${profile.maxTime.toFixed(2).padStart(9)}ms`);
        });
        console.log('');
        // Recommendations
        console.log('━'.repeat(80));
        console.log('OPTIMIZATION RECOMMENDATIONS');
        console.log('━'.repeat(80));
        console.log('');
        this.printRecommendations(report);
        console.log('');
        console.log('='.repeat(80));
    }
    /**
     * Generate optimization recommendations
     */
    printRecommendations(report) {
        const byTotal = this.getSortedActions('total');
        const byAvg = this.getSortedActions('avg');
        // High cumulative impact (>5% of total time)
        const highImpact = byTotal.filter(p => (p.totalTime / report.totalTime) > 0.05);
        // Slow per-call (>10ms avg)
        const slowPerCall = byAvg.filter(p => p.avgTime > 10);
        // Frequently called (>100 calls)
        const frequent = Array.from(report.profiles.values())
            .filter(p => p.callCount > 100)
            .sort((a, b) => b.callCount - a.callCount);
        console.log('🎯 PRIORITY 1: Port to Rust (High Cumulative Impact)');
        console.log('   Actions consuming >5% of total execution time:');
        console.log('');
        if (highImpact.length > 0) {
            highImpact.forEach(p => {
                const pct = ((p.totalTime / report.totalTime) * 100).toFixed(1);
                console.log(`   • ${p.actionType.padEnd(35)} ${pct.padStart(6)}% (${p.callCount} calls)`);
            });
        }
        else {
            console.log('   ✓ No single action dominates (good distribution)');
        }
        console.log('');
        console.log('🐌 PRIORITY 2: Optimize (Slow Per-Call)');
        console.log('   Actions taking >10ms on average:');
        console.log('');
        if (slowPerCall.length > 0) {
            slowPerCall.slice(0, 10).forEach(p => {
                console.log(`   • ${p.actionType.padEnd(35)} ${p.avgTime.toFixed(2).padStart(8)}ms avg`);
            });
        }
        else {
            console.log('   ✓ All actions execute quickly (<10ms avg)');
        }
        console.log('');
        console.log('🔥 PRIORITY 3: Consider Batching (High Frequency)');
        console.log('   Actions called >100 times:');
        console.log('');
        if (frequent.length > 0) {
            frequent.slice(0, 10).forEach(p => {
                console.log(`   • ${p.actionType.padEnd(35)} ${p.callCount.toString().padStart(6)} calls`);
            });
        }
        else {
            console.log('   ✓ No actions called excessively');
        }
        console.log('');
        console.log('💡 SUGGESTED STRATEGY:');
        console.log('');
        if (highImpact.length > 0) {
            console.log(`   1. Port ${highImpact.slice(0, 3).map(p => p.actionType).join(', ')} to Rust`);
            console.log(`      Expected impact: ~${highImpact.slice(0, 3).reduce((sum, p) => sum + (p.totalTime / report.totalTime) * 100, 0).toFixed(1)}% time reduction`);
        }
        if (slowPerCall.length > 0) {
            console.log(`   2. Optimize algorithmic complexity of slow actions`);
            console.log(`      Target: Reduce avg time from ${slowPerCall[0].avgTime.toFixed(2)}ms to <5ms`);
        }
        if (frequent.length > 0) {
            console.log(`   3. Implement batch operations for frequently-called actions`);
            console.log(`      Batch size: ~10-100 calls to reduce overhead`);
        }
    }
    /**
     * Export data as JSON for further analysis
     */
    exportJSON() {
        const report = this.getReport();
        const data = {
            summary: {
                totalActions: report.totalActions,
                totalTime: report.totalTime,
                uniqueActions: report.profiles.size,
                duration: report.endTime - report.startTime,
            },
            actions: Array.from(report.profiles.values()).map(p => ({
                type: p.actionType,
                calls: p.callCount,
                total: p.totalTime,
                avg: p.avgTime,
                min: p.minTime,
                max: p.maxTime,
                percentile95: this.getPercentile(p.samples, 0.95),
                percentile99: this.getPercentile(p.samples, 0.99),
            })),
        };
        return JSON.stringify(data, null, 2);
    }
    /**
     * Calculate percentile from samples
     */
    getPercentile(samples, percentile) {
        if (samples.length === 0)
            return 0;
        const sorted = [...samples].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[index];
    }
    /**
     * Reset profiler
     */
    reset() {
        this.profiles.clear();
        this.startTime = performance.now();
    }
    /**
     * Enable/disable profiling
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
/**
 * Global profiler instance
 */
export const globalProfiler = new ActionProfiler(false);
/**
 * Convenience function to enable profiling
 */
export function enableProfiling() {
    globalProfiler.setEnabled(true);
    globalProfiler.start();
}
/**
 * Convenience function to disable profiling
 */
export function disableProfiling() {
    globalProfiler.setEnabled(false);
}
/**
 * Convenience function to get report
 */
export function getProfilingReport() {
    globalProfiler.printReport();
}

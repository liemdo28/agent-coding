/**
 * Phase 29: AI Strategic System - Corporate Decision Engine
 * CEO_AI can reallocate resources, pause risky projects, accelerate initiatives, restructure agent hierarchy
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} status
 * @property {number} priority
 * @property {number} health
 * @property {number} risk
 * @property {number} resources
 * @property {string[]} team
 * @property {Object} metrics
 */

/**
 * @typedef {Object} Decision
 * @property {string} id
 * @property {string} type
 * @property {string} action
 * @property {Object} target
 * @property {string} rationale
 * @property {number} impact
 * @property {string[]} risks
 * @property {string[]} benefits
 * @property {string} status
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ResourceAllocation
 * @property {string} projectId
 * @property {number} currentResources
 * @property {number} suggestedResources
 * @property {string[]} reallocationReason
 */

/**
 * @typedef {Object} CorporateDecisionReport
 * @property {Decision[]} decisions
 * @property {ResourceAllocation[]} reallocations
 * @property {Object} portfolioHealth
 * @property {string[]} recommendations
 */

/**
 * Suggest resource reallocation across projects
 * @param {Project[]} portfolio - Array of project objects
 * @param {Object} context - Decision context
 * @returns {Object} Resource reallocation suggestions
 */
export async function suggestResourceReallocation(portfolio, context = {}) {
    try {
        // Analyze project performance and health
        const analysis = analyzeProjectPerformance(portfolio);

        // Calculate resource efficiency
        const efficiency = calculateResourceEfficiency(portfolio, analysis);

        // Identify underutilized resources
        const underutilized = efficiency.filter(p => p.efficiency < 0.5);

        // Identify overutilized/overloaded resources
        const overloaded = efficiency.filter(p => p.utilization > 0.9);

        // Generate reallocation suggestions
        const reallocations = generateReallocations(portfolio, analysis, efficiency);

        // Calculate impact of proposed changes
        const impact = calculateReallocationImpact(reallocations, portfolio);

        return {
            analyzedAt: new Date().toISOString(),
            portfolioSize: portfolio.length,
            analysis,
            efficiency,
            underutilizedProjects: underutilized.map(p => ({
                projectId: p.id,
                projectName: p.name,
                efficiency: p.efficiency,
                suggestedAction: 'reallocate'
            })),
            overloadedProjects: overloaded.map(p => ({
                projectId: p.id,
                projectName: p.name,
                utilization: p.utilization,
                suggestedAction: 'add-resources'
            })),
            reallocations,
            impact,
            recommendations: generateReallocationRecommendations(reallocations, underutilized, overloaded),
            confidence: calculateConfidence(analysis)
        };
    } catch (err) {
        return { error: err.message, reallocations: [] };
    }
}

/**
 * Assess if a project should be paused
 * @param {Project} project - Project to assess
 * @returns {Object} Pause assessment
 */
export async function shouldPauseProject(project) {
    try {
        // Calculate risk score
        const riskScore = calculateProjectRisk(project);

        // Analyze project health trends
        const healthTrend = analyzeHealthTrend(project);

        // Check business value
        const businessValue = assessBusinessValue(project);

        // Determine strategic alignment
        const strategicAlignment = assessStrategicAlignment(project);

        // Calculate overall pause recommendation
        const shouldPause = riskScore > 0.7 || healthTrend === 'declining' || businessValue < 0.3;
        const confidence = calculatePauseConfidence(riskScore, healthTrend, businessValue);

        return {
            projectId: project.id,
            projectName: project.name,
            shouldPause,
            confidence,
            riskScore,
            healthTrend,
            businessValue,
            strategicAlignment,
            factors: {
                highRisk: riskScore > 0.7,
                decliningHealth: healthTrend === 'declining',
                lowBusinessValue: businessValue < 0.3,
                misaligned: strategicAlignment < 0.4
            },
            rationale: generatePauseRationale(riskScore, healthTrend, businessValue, strategicAlignment),
            alternativeActions: shouldPause ? suggestAlternativeActions(project) : [],
            estimatedSavings: shouldPause ? estimateResourceSavings(project) : 0,
            riskOfPausing: assessPauseRisk(project)
        };
    } catch (err) {
        return { error: err.message, projectId: project?.id };
    }
}

/**
 * Accelerate a high-priority initiative
 * @param {Project} initiative - Initiative to accelerate
 * @param {Object} options - Acceleration options
 * @returns {Object} Acceleration plan
 */
export async function accelerateInitiative(initiative, options = {}) {
    try {
        const { additionalResources = 0.2, priority = 'high' } = options;

        // Assess current state
        const currentState = assessCurrentState(initiative);

        // Calculate acceleration requirements
        const requirements = calculateAccelerationRequirements(initiative, additionalResources);

        // Identify blockers
        const blockers = identifyBlockers(initiative);

        // Generate acceleration plan
        const plan = generateAccelerationPlan(initiative, requirements, blockers);

        // Calculate projected outcomes
        const outcomes = projectOutcomes(initiative, plan);

        // Assess risks
        const risks = assessAccelerationRisks(initiative, plan);

        return {
            initiativeId: initiative.id,
            initiativeName: initiative.name,
            accelerationRequested: `${Math.round(additionalResources * 100)}%`,
            currentState,
            requirements,
            blockers,
            plan,
            outcomes,
            risks,
            timeline: plan.timeline,
            resourceCost: requirements.totalResources,
            expectedSpeedup: outcomes.speedupFactor,
            confidence: outcomes.confidence,
            recommendations: generateAccelerationRecommendations(initiative, plan, risks)
        };
    } catch (err) {
        return { error: err.message, initiativeId: initiative?.id };
    }
}

/**
 * Restructure agent hierarchy
 * @param {Object} hierarchy - Current agent hierarchy
 * @param {Object} context - Context for restructuring
 * @returns {Object} Restructuring recommendations
 */
export async function restructureAgentHierarchy(hierarchy, context = {}) {
    try {
        // Analyze current hierarchy
        const analysis = analyzeHierarchy(hierarchy);

        // Identify bottlenecks
        const bottlenecks = identifyHierarchyBottlenecks(analysis);

        // Calculate optimal structure
        const optimal = calculateOptimalStructure(analysis, context);

        // Generate restructuring plan
        const plan = generateRestructuringPlan(hierarchy, analysis, optimal);

        // Assess impact
        const impact = assessRestructuringImpact(plan, hierarchy);

        return {
            analyzedAt: new Date().toISOString(),
            currentStructure: {
                totalAgents: hierarchy.agents?.length || 0,
                levels: analysis.levels,
                spanOfControl: analysis.avgSpanOfControl
            },
            analysis,
            bottlenecks,
            optimalStructure: optimal,
            plan,
            impact,
            risks: assessHierarchyRisks(plan),
            recommendations: generateHierarchyRecommendations(analysis, bottlenecks, optimal),
            estimatedTransitionTime: plan.estimatedTime
        };
    } catch (err) {
        return { error: err.message, hierarchy };
    }
}

// Helper functions

function analyzeProjectPerformance(portfolio) {
    return portfolio.map(project => {
        const healthScore = project.health || 0.5;
        const riskScore = project.risk || 0.5;
        const priorityScore = project.priority || 5;
        const resourceUtilization = project.metrics?.resourceUtilization || 0.5;

        return {
            id: project.id,
            name: project.name,
            healthScore,
            riskScore,
            priorityScore,
            resourceUtilization,
            performanceScore: (healthScore * 2 - riskScore) * priorityScore / 10,
            status: project.status
        };
    });
}

function calculateResourceEfficiency(portfolio, analysis) {
    return analysis.map(a => {
        const expectedOutput = a.resourceUtilization * a.priorityScore;
        const actualOutput = a.healthScore * a.priorityScore;
        const efficiency = expectedOutput > 0 ? actualOutput / expectedOutput : 0;

        return {
            ...a,
            efficiency: Math.min(1, efficiency),
            utilization: a.resourceUtilization,
            outputRatio: actualOutput / (a.resourceUtilization * 10)
        };
    });
}

function generateReallocations(portfolio, analysis, efficiency) {
    const reallocations = [];
    const avgEfficiency = efficiency.reduce((sum, e) => sum + e.efficiency, 0) / efficiency.length;

    for (const e of efficiency) {
        if (e.efficiency < avgEfficiency * 0.8) {
            // Underperforming - suggest reallocation
            const reallocationAmount = Math.round((avgEfficiency - e.efficiency) * e.resourceUtilization * 100);
            reallocations.push({
                projectId: e.id,
                projectName: e.name,
                currentResources: Math.round(e.resourceUtilization * 100),
                suggestedResources: Math.round(e.resourceUtilization * (1 - (avgEfficiency - e.efficiency)) * 100),
                change: -reallocationAmount,
                rationale: `Efficiency (${(e.efficiency * 100).toFixed(0)}%) below portfolio average (${(avgEfficiency * 100).toFixed(0)}%)`,
                priority: 'high'
            });
        } else if (e.efficiency > avgEfficiency * 1.2 && e.utilization > 0.8) {
            // Overperforming with high utilization - consider adding resources
            const additionalResources = Math.round(e.utilization * 20);
            reallocations.push({
                projectId: e.id,
                projectName: e.name,
                currentResources: Math.round(e.utilization * 100),
                suggestedResources: Math.round(e.utilization * 100) + additionalResources,
                change: additionalResources,
                rationale: `High efficiency (${(e.efficiency * 100).toFixed(0)}%) with high utilization - can use more resources`,
                priority: 'medium'
            });
        }
    }

    return reallocations;
}

function calculateReallocationImpact(reallocations, portfolio) {
    const totalReduction = reallocations.filter(r => r.change < 0).reduce((sum, r) => sum + Math.abs(r.change), 0);
    const totalAddition = reallocations.filter(r => r.change > 0).reduce((sum, r) => sum + r.change, 0);

    return {
        totalResourcesReallocated: totalReduction + totalAddition,
        projectsAffected: reallocations.length,
        estimatedProductivityGain: `${Math.round((totalAddition / (portfolio.length || 1)) * 10)}%`,
        riskLevel: totalReduction > 50 ? 'high' : totalReduction > 30 ? 'medium' : 'low'
    };
}

function generateReallocationRecommendations(reallocations, underutilized, overloaded) {
    const recommendations = [];

    if (underutilized.length > 0) {
        recommendations.push({
            type: 'efficiency',
            message: `${underutilized.length} project(s) have efficiency below 50%. Consider reallocating resources to higher-performing projects.`,
            action: 'reallocate'
        });
    }

    if (overloaded.length > 0) {
        recommendations.push({
            type: 'capacity',
            message: `${overloaded.length} project(s) are overloaded (>90% utilization). Adding resources could improve output.`,
            action: 'invest'
        });
    }

    if (reallocations.length === 0) {
        recommendations.push({
            type: 'balanced',
            message: 'Portfolio appears balanced. Continue monitoring for changes.',
            action: 'monitor'
        });
    }

    return recommendations;
}

function calculateConfidence(analysis) {
    if (analysis.length === 0) return 0;
    const avgHealth = analysis.reduce((sum, a) => sum + a.healthScore, 0) / analysis.length;
    return avgHealth > 0.7 ? 0.8 : avgHealth > 0.5 ? 0.6 : 0.4;
}

function calculateProjectRisk(project) {
    let risk = 0;

    // Technical risk
    if (project.risk > 0.7) risk += 0.3;
    else if (project.risk > 0.5) risk += 0.2;

    // Health risk
    if (project.health < 0.3) risk += 0.3;
    else if (project.health < 0.5) risk += 0.2;

    // Resource risk
    if (project.metrics?.resourceUtilization > 0.95) risk += 0.2;

    // Dependency risk
    if (project.dependencies?.length > 5) risk += 0.1;

    return Math.min(1, risk);
}

function analyzeHealthTrend(project) {
    const healthHistory = project.metrics?.healthHistory || [];
    if (healthHistory.length < 2) return 'stable';

    const recent = healthHistory.slice(-3);
    const trend = recent.reduce((sum, h) => sum + h, 0) / recent.length;
    const current = healthHistory[healthHistory.length - 1];

    if (trend > current * 1.1) return 'improving';
    if (trend < current * 0.9) return 'declining';
    return 'stable';
}

function assessBusinessValue(project) {
    let value = 0.5; // Base value

    // Revenue impact
    if (project.revenueImpact === 'high') value += 0.3;
    else if (project.revenueImpact === 'medium') value += 0.15;

    // Strategic importance
    if (project.strategicImportance === 'high') value += 0.2;
    else if (project.strategicImportance === 'medium') value += 0.1;

    // Customer impact
    if (project.customerImpact === 'high') value += 0.2;
    else if (project.customerImpact === 'medium') value += 0.1;

    return Math.min(1, value);
}

function assessStrategicAlignment(project) {
    // Simple heuristic - in reality would compare to strategic goals
    if (project.category === 'core') return 0.9;
    if (project.category === 'growth') return 0.7;
    if (project.category === 'experiment') return 0.4;
    return 0.5;
}

function calculatePauseConfidence(riskScore, healthTrend, businessValue) {
    let confidence = 0.5;

    if (riskScore > 0.7) confidence += 0.2;
    if (healthTrend === 'declining') confidence += 0.15;
    if (businessValue < 0.3) confidence += 0.15;

    return Math.min(0.95, confidence);
}

function generatePauseRationale(riskScore, healthTrend, businessValue, strategicAlignment) {
    const reasons = [];

    if (riskScore > 0.7) {
        reasons.push(`High risk score (${(riskScore * 100).toFixed(0)}%)`);
    }
    if (healthTrend === 'declining') {
        reasons.push('Health metrics are declining');
    }
    if (businessValue < 0.3) {
        reasons.push('Low business value contribution');
    }
    if (strategicAlignment < 0.4) {
        reasons.push('Low strategic alignment');
    }

    return reasons.length > 0
        ? `Recommend pausing due to: ${reasons.join(', ')}`
        : 'Project metrics do not strongly indicate pausing needed';
}

function suggestAlternativeActions(project) {
    const alternatives = [
        {
            action: 'reduce_scope',
            description: 'Reduce project scope to focus on highest-value features',
            impact: 'medium',
            risk: 'low'
        },
        {
            action: 'pause_and_review',
            description: 'Temporarily pause for strategic review',
            impact: 'medium',
            risk: 'low'
        },
        {
            action: 'merge_with',
            description: 'Consider merging with related project',
            impact: 'high',
            risk: 'medium'
        }
    ];

    return alternatives;
}

function estimateResourceSavings(project) {
    return Math.round((project.resources || 10) * 0.3);
}

function assessPauseRisk(project) {
    const risks = [];

    if (project.dependencies?.length > 0) {
        risks.push({
            risk: 'Downstream dependencies may be affected',
            severity: 'medium'
        });
    }

    if (project.status === 'critical') {
        risks.push({
            risk: 'Project marked as critical - pausing may impact business',
            severity: 'high'
        });
    }

    if (project.team?.length > 5) {
        risks.push({
            risk: 'Large team may need reassignment',
            severity: 'medium'
        });
    }

    return risks;
}

function assessCurrentState(initiative) {
    return {
        health: initiative.health || 0.5,
        velocity: initiative.metrics?.velocity || 0,
        blockers: initiative.metrics?.blockers || 0,
        resourceUtilization: initiative.metrics?.resourceUtilization || 0.5,
        teamMorale: initiative.metrics?.teamMorale || 0.7
    };
}

function calculateAccelerationRequirements(initiative, additionalResources) {
    const baseResources = initiative.resources || 10;
    const additional = Math.round(baseResources * additionalResources);

    return {
        currentResources: baseResources,
        additionalResources: additional,
        totalResources: baseResources + additional,
        breakdown: {
            developers: Math.round(additional * 0.6),
            infrastructure: Math.round(additional * 0.3),
            tools: Math.round(additional * 0.1)
        }
    };
}

function identifyBlockers(initiative) {
    const blockers = [];

    if (initiative.blockers?.length > 0) {
        blockers.push(...initiative.blockers.map(b => ({
            type: 'external',
            description: b,
            estimatedDelay: '1-2 weeks'
        })));
    }

    if (!initiative.resources || initiative.resources < 5) {
        blockers.push({
            type: 'resource',
            description: 'Insufficient resources',
            estimatedDelay: 'Ongoing'
        });
    }

    return blockers;
}

function generateAccelerationPlan(initiative, requirements, blockers) {
    const plan = {
        phases: [],
        timeline: '',
        estimatedTime: '2-4 weeks'
    };

    // Phase 1: Resource allocation
    plan.phases.push({
        phase: 1,
        name: 'Resource Allocation',
        duration: '3-5 days',
        actions: [
            `Hire/assign ${requirements.breakdown.developers} additional developers`,
            `Provision ${requirements.breakdown.infrastructure} additional infrastructure`,
            `Acquire ${requirements.breakdown.tools} additional tools/licenses`
        ]
    });

    // Phase 2: Integration
    plan.phases.push({
        phase: 2,
        name: 'Team Integration',
        duration: '1 week',
        actions: [
            'Onboard new team members',
            'Establish communication channels',
            'Align on goals and priorities'
        ]
    });

    // Phase 3: Execution
    plan.phases.push({
        phase: 3,
        name: 'Accelerated Execution',
        duration: '2-3 weeks',
        actions: [
            'Implement parallel workstreams',
            'Daily standups',
            'Weekly progress reviews'
        ]
    });

    if (blockers.length > 0) {
        plan.phases.unshift({
            phase: 0,
            name: 'Blocker Resolution',
            duration: '1-2 weeks',
            actions: blockers.map(b => `Resolve: ${b.description}`)
        });
    }

    // Calculate total timeline
    const totalDays = plan.phases.reduce((sum, p) => {
        const days = parseInt(p.duration) || 7;
        return sum + days;
    }, 0);

    plan.timeline = `${Math.round(totalDays / 7)} weeks`;
    plan.estimatedTime = plan.timeline;

    return plan;
}

function projectOutcomes(initiative, plan) {
    const baseVelocity = initiative.metrics?.velocity || 10;
    const additionalResources = plan.phases.find(p => p.phase === 1)?.actions.length || 0;
    const speedupFactor = 1 + (additionalResources * 0.1);

    return {
        speedupFactor: Math.min(2.5, speedupFactor),
        expectedVelocityGain: `${Math.round((speedupFactor - 1) * 100)}%`,
        confidence: additionalResources > 3 ? 0.8 : 0.6,
        riskFactors: [
            'Team integration challenges',
            'Knowledge transfer delays',
            'Coordination overhead'
        ]
    };
}

function assessAccelerationRisks(initiative, plan) {
    const risks = [];

    if (plan.phases.length > 3) {
        risks.push({
            type: 'complexity',
            severity: 'medium',
            description: 'Complex multi-phase plan increases execution risk'
        });
    }

    if (initiative.metrics?.teamMorale < 0.5) {
        risks.push({
            type: 'morale',
            severity: 'high',
            description: 'Low team morale may limit acceleration effectiveness'
        });
    }

    return risks;
}

function generateAccelerationRecommendations(initiative, plan, risks) {
    const recommendations = [];

    if (risks.some(r => r.type === 'morale' && r.severity === 'high')) {
        recommendations.push({
            priority: 'high',
            message: 'Address team morale before accelerating - consider team health initiatives'
        });
    }

    recommendations.push({
        priority: 'medium',
        message: 'Start with Phase 1 (Resource Allocation) and validate progress before proceeding'
    });

    recommendations.push({
        priority: 'low',
        message: 'Consider agile methodologies to manage increased team size'
    });

    return recommendations;
}

function analyzeHierarchy(hierarchy) {
    const agents = hierarchy.agents || [];

    // Count levels
    const levels = {};
    for (const agent of agents) {
        const level = agent.level || 0;
        levels[level] = (levels[level] || 0) + 1;
    }

    // Calculate span of control
    const managers = agents.filter(a => a.directReports?.length > 0);
    const avgSpanOfControl = managers.length > 0
        ? agents.filter(a => a.isManager).reduce((sum, m) => sum + (m.directReports?.length || 0), 0) / managers.length
        : 0;

    return {
        levels,
        totalAgents: agents.length,
        managerCount: managers.length,
        avgSpanOfControl: Math.round(avgSpanOfControl * 10) / 10,
        leafNodes: agents.filter(a => !a.isManager).length
    };
}

function identifyHierarchyBottlenecks(analysis) {
    const bottlenecks = [];

    if (analysis.avgSpanOfControl > 10) {
        bottlenecks.push({
            type: 'span_of_control',
            severity: 'high',
            description: `Span of control (${analysis.avgSpanOfControl}) is too high - consider adding management layers`
        });
    }

    if (analysis.levels[0] && analysis.levels[0] > 50) {
        bottlenecks.push({
            type: 'flat_structure',
            severity: 'medium',
            description: 'Too many agents at top level - hierarchy may be too flat'
        });
    }

    return bottlenecks;
}

function calculateOptimalStructure(analysis, context) {
    const targetSpanOfControl = 6; // Ideal span of control
    const optimalManagers = Math.ceil(analysis.leafNodes / targetSpanOfControl);

    return {
        recommendedLevels: Math.ceil(Math.log2(analysis.totalAgents / optimalManagers)) + 1,
        recommendedManagers: optimalManagers,
        recommendedSpanOfControl: targetSpanOfControl,
        reasoning: `With ${analysis.totalAgents} agents and ${analysis.leafNodes} leaf nodes, a span of control of ${targetSpanOfControl} is recommended`
    };
}

function generateRestructuringPlan(hierarchy, analysis, optimal) {
    return {
        changes: [
            {
                type: 'add_layer',
                description: `Add ${optimal.recommendedLevels - Object.keys(analysis.levels).length} management layers`,
                impact: 'medium'
            },
            {
                type: 'restructure_reports',
                description: `Reorganize ${optimal.recommendedManagers} manager roles`,
                impact: 'high'
            }
        ],
        estimatedTime: '4-6 weeks',
        transitionSteps: [
            'Define new roles and responsibilities',
            'Identify candidates for new positions',
            'Gradually transition teams',
            'Monitor and adjust'
        ]
    };
}

function assessRestructuringImpact(plan, hierarchy) {
    return {
        disruption: 'medium',
        affectedAgents: Math.round(hierarchy.agents?.length * 0.5 || 0),
        expectedBenefits: [
            'Improved communication',
            'Better resource allocation',
            'Clearer accountability'
        ],
        timeline: plan.estimatedTime
    };
}

function assessHierarchyRisks(plan) {
    return [
        {
            type: 'disruption',
            severity: 'medium',
            description: 'Restructuring may cause temporary productivity loss'
        },
        {
            type: 'morale',
            severity: 'low',
            description: 'Some agents may be uncomfortable with changes'
        }
    ];
}

function generateHierarchyRecommendations(analysis, bottlenecks, optimal) {
    const recommendations = [];

    if (bottlenecks.some(b => b.type === 'span_of_control')) {
        recommendations.push({
            priority: 'high',
            message: 'Reduce span of control by adding intermediate management layers'
        });
    }

    recommendations.push({
        priority: 'medium',
        message: `Consider restructuring to ${optimal.recommendedLevels} levels with ${optimal.recommendedSpanOfControl} span of control`
    });

    return recommendations;
}

export default {
    suggestResourceReallocation,
    shouldPauseProject,
    accelerateInitiative,
    restructureAgentHierarchy
};
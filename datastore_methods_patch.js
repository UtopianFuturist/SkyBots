import { dataStore } from './src/services/dataStore.js';

async function patch() {
    await dataStore.init();

    // 38. Performance Dashboard methods
    dataStore.updateToolSuccess = async function(toolName, success) {
        if (!this.db.data.system_performance) this.db.data.system_performance = { tool_success_rates: {} };
        if (!this.db.data.system_performance.tool_success_rates[toolName]) {
            this.db.data.system_performance.tool_success_rates[toolName] = { success: 0, total: 0 };
        }
        this.db.data.system_performance.tool_success_rates[toolName].total++;
        if (success) this.db.data.system_performance.tool_success_rates[toolName].success++;
        await this.db.write();
    };

    dataStore.updateLatency = async function(model, ms) {
        if (!this.db.data.system_performance) this.db.data.system_performance = { average_latency: {} };
        if (!this.db.data.system_performance.average_latency[model]) {
            this.db.data.system_performance.average_latency[model] = { avg: 0, count: 0 };
        }
        const lat = this.db.data.system_performance.average_latency[model];
        lat.avg = (lat.avg * lat.count + ms) / (lat.count + 1);
        lat.count++;
        await this.db.write();
    };

    dataStore.updateTokenUsage = async function(model, tokens) {
        if (!this.db.data.system_performance) this.db.data.system_performance = { token_usage: { total: 0, by_model: {} } };
        this.db.data.system_performance.token_usage.total += tokens;
        if (!this.db.data.system_performance.token_usage.by_model[model]) {
            this.db.data.system_performance.token_usage.by_model[model] = 0;
        }
        this.db.data.system_performance.token_usage.by_model[model] += tokens;
        await this.db.write();
    };

    // 9. Confidence Scoring method
    dataStore.addConfidenceEntry = async function(score, reason, traceId) {
        if (!this.db.data.confidence_history) this.db.data.confidence_history = [];
        this.db.data.confidence_history.push({ score, reason, traceId, timestamp: Date.now() });
        if (this.db.data.confidence_history.length > 100) this.db.data.confidence_history.shift();
        await this.db.write();
    };

    // 31. Trace Logging method
    dataStore.addTraceLog = async function(traceId, step, data) {
        if (!this.db.data.trace_logs) this.db.data.trace_logs = [];
        this.db.data.trace_logs.push({ traceId, step, data, timestamp: Date.now() });
        if (this.db.data.trace_logs.length > 500) this.db.data.trace_logs.shift();
        await this.db.write();
    };

    // 38. Performance Dashboard getter
    dataStore.getPerformanceMetrics = function() {
        return this.db.data.system_performance || {};
    };

    // Convert methods to prototype if they are not there already
    const proto = Object.getPrototypeOf(dataStore);
    proto.updateToolSuccess = dataStore.updateToolSuccess;
    proto.updateLatency = dataStore.updateLatency;
    proto.updateTokenUsage = dataStore.updateTokenUsage;
    proto.addConfidenceEntry = dataStore.addConfidenceEntry;
    proto.addTraceLog = dataStore.addTraceLog;
    proto.getPerformanceMetrics = dataStore.getPerformanceMetrics;

    await dataStore.db.write();
    console.log("DataStore methods added successfully.");
}

patch();

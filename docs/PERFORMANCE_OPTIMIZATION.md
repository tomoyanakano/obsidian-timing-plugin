# Data Caching & Performance Optimization Strategy

## Overview

This document outlines the comprehensive performance optimization strategy for the Timing Plugin, focusing on efficient data caching, AppleScript call optimization, and real-time update mechanisms. Given the high cost of AppleScript operations and the requirement for near real-time updates, robust caching and optimization are critical.

## Performance Challenges

### 1. AppleScript Operation Costs
- **High Latency**: AppleScript calls typically take 100-500ms
- **System Resources**: Cross-application communication overhead
- **Blocking Operations**: AppleScript execution blocks the main thread
- **Error Recovery**: Failed calls require retry mechanisms

### 2. Real-time Update Requirements
- **Frequent Updates**: Every 5-10 minutes for real-time feel
- **Data Volume**: Potentially large datasets for detailed tracking
- **File I/O**: Daily Note updates require disk operations
- **UI Responsiveness**: Must not block Obsidian interface

## Caching Architecture

### 1. Multi-Level Cache Design

```typescript
interface CacheLevel {
  name: string;
  maxAge: number;           // milliseconds
  maxSize: number;          // entries
  evictionPolicy: 'LRU' | 'TTL' | 'FIFO';
}

enum CacheType {
  MEMORY = 'memory',        // In-memory for hot data
  PERSISTENT = 'persistent', // LocalStorage for session data
  DISK = 'disk'            // File system for historical data
}

class TimingDataCache {
  private memoryCache: Map<string, CachedEntry>;
  private persistentCache: LocalStorage;
  private diskCache: FileSystemCache;
  
  private readonly cacheLevels: Record<CacheType, CacheLevel> = {
    [CacheType.MEMORY]: {
      name: 'Memory Cache',
      maxAge: 5 * 60 * 1000,    // 5 minutes
      maxSize: 100,             // 100 entries
      evictionPolicy: 'LRU'
    },
    [CacheType.PERSISTENT]: {
      name: 'Session Cache',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 1000,
      evictionPolicy: 'TTL'
    },
    [CacheType.DISK]: {
      name: 'Disk Cache',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxSize: 10000,
      evictionPolicy: 'FIFO'
    }
  };
}
```

### 2. Cache Key Strategy

```typescript
interface CacheKey {
  type: 'daily' | 'hourly' | 'app_summary' | 'category_summary';
  date: string;             // ISO date string
  granularity?: 'minute' | 'hour' | 'day';
  filters?: string[];       // Application or category filters
}

class CacheKeyGenerator {
  static generateKey(params: CacheKey): string {
    const parts = [params.type, params.date];
    if (params.granularity) parts.push(params.granularity);
    if (params.filters?.length) parts.push(params.filters.join(','));
    return parts.join(':');
  }
  
  static parseCacheKey(key: string): CacheKey {
    const [type, date, granularity, filters] = key.split(':');
    return {
      type: type as CacheKey['type'],
      date,
      granularity: granularity as CacheKey['granularity'],
      filters: filters?.split(',')
    };
  }
}
```

### 3. Cache Entry Structure

```typescript
interface CachedEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;        // When cached
  lastAccessed: number;     // For LRU eviction
  source: 'applescript' | 'computed' | 'user_input';
  version: string;          // Data format version
  checksum?: string;        // Data integrity verification
  dependencies?: string[];  // Cache invalidation dependencies
}

interface TimingCacheEntry extends CachedEntry<DailyTimeData> {
  lastFetchTime: number;    // When data was fetched from Timing
  isComplete: boolean;      // Whether day's data is complete
  nextUpdateTime: number;   // Scheduled next update
}
```

## Data Fetching Optimization

### 1. Intelligent Fetch Strategy

```typescript
enum FetchStrategy {
  IMMEDIATE = 'immediate',          // Fetch immediately, high priority
  SCHEDULED = 'scheduled',          // Fetch on schedule
  LAZY = 'lazy',                   // Fetch when needed
  BACKGROUND = 'background'         // Low priority background fetch
}

class DataFetchManager {
  private fetchQueue: PriorityQueue<FetchRequest>;
  private activeFetches: Set<string>;
  private fetchHistory: Map<string, FetchResult>;
  
  async requestData(date: Date, strategy: FetchStrategy = FetchStrategy.SCHEDULED): Promise<DailyTimeData> {
    const cacheKey = this.generateCacheKey(date);
    
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached, strategy)) {
      return cached.data;
    }
    
    // Determine fetch approach
    switch (strategy) {
      case FetchStrategy.IMMEDIATE:
        return await this.fetchImmediate(date);
      case FetchStrategy.SCHEDULED:
        return await this.fetchScheduled(date);
      case FetchStrategy.LAZY:
        return await this.fetchLazy(date);
      case FetchStrategy.BACKGROUND:
        this.queueBackgroundFetch(date);
        return cached?.data || this.getEmptyData(date);
    }
  }
  
  private async fetchImmediate(date: Date): Promise<DailyTimeData> {
    const data = await this.executeAppleScriptFetch(date);
    await this.cache.set(this.generateCacheKey(date), data);
    return data;
  }
  
  private async fetchScheduled(date: Date): Promise<DailyTimeData> {
    // Check if fetch is already in progress
    const cacheKey = this.generateCacheKey(date);
    if (this.activeFetches.has(cacheKey)) {
      return await this.waitForActiveFetch(cacheKey);
    }
    
    // Queue for scheduled execution
    return await this.queueFetch({
      date,
      priority: this.calculatePriority(date),
      strategy: FetchStrategy.SCHEDULED
    });
  }
}
```

### 2. AppleScript Call Batching

```typescript
interface BatchRequest {
  dates: Date[];
  requestId: string;
  priority: number;
  callback: (results: Map<string, DailyTimeData>) => void;
}

class AppleScriptBatchManager {
  private batchQueue: BatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 7;          // Fetch week at a time
  private readonly BATCH_DELAY = 2000;      // 2 second batching window
  
  queueRequest(date: Date, callback: (data: DailyTimeData) => void): void {
    // Add to current batch or create new batch
    const existingBatch = this.findBatchForDate(date);
    if (existingBatch) {
      this.addToBatch(existingBatch, date, callback);
    } else {
      this.createNewBatch([date], callback);
    }
    
    // Schedule batch execution
    this.scheduleBatchExecution();
  }
  
  private async executeBatch(batch: BatchRequest): Promise<void> {
    try {
      // Execute single AppleScript call for multiple dates
      const results = await this.executeAppleScriptBatch(batch.dates);
      
      // Update cache with all results
      for (const [dateStr, data] of results.entries()) {
        await this.cache.set(this.generateCacheKey(dateStr), data);
      }
      
      // Execute callback with results
      batch.callback(results);
    } catch (error) {
      this.handleBatchError(batch, error);
    }
  }
}
```

## Background Processing

### 1. Worker-based Processing

```typescript
class BackgroundDataProcessor {
  private worker: Worker;
  private processingQueue: ProcessingTask[];
  
  constructor() {
    this.worker = new Worker('timing-data-processor.js');
    this.setupWorkerHandlers();
  }
  
  async processTimingData(rawData: any[]): Promise<DailyTimeData> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId();
      
      this.worker.postMessage({
        taskId,
        type: 'PROCESS_TIMING_DATA',
        data: rawData
      });
      
      const timeout = setTimeout(() => {
        reject(new Error('Processing timeout'));
      }, 10000);
      
      this.worker.addEventListener('message', (event) => {
        if (event.data.taskId === taskId) {
          clearTimeout(timeout);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      });
    });
  }
}
```

### 2. Incremental Updates

```typescript
interface DataDelta {
  added: TimeEntry[];
  modified: TimeEntry[];
  removed: string[];       // Entry IDs
  timestamp: number;
}

class IncrementalUpdateManager {
  private lastUpdateTime: Map<string, number> = new Map();
  
  async getIncrementalUpdate(date: Date): Promise<DataDelta | null> {
    const dateKey = this.formatDate(date);
    const lastUpdate = this.lastUpdateTime.get(dateKey) || 0;
    
    // Only fetch changes since last update
    const changes = await this.fetchChangesSince(date, lastUpdate);
    
    if (changes && changes.length > 0) {
      this.lastUpdateTime.set(dateKey, Date.now());
      return this.calculateDelta(changes);
    }
    
    return null;
  }
  
  async applyIncrementalUpdate(existingData: DailyTimeData, delta: DataDelta): Promise<DailyTimeData> {
    const updatedEntries = [...existingData.entries];
    
    // Apply changes
    for (const entry of delta.added) {
      updatedEntries.push(entry);
    }
    
    for (const modifiedEntry of delta.modified) {
      const index = updatedEntries.findIndex(e => e.startTime === modifiedEntry.startTime);
      if (index >= 0) {
        updatedEntries[index] = modifiedEntry;
      }
    }
    
    // Remove deleted entries
    const filteredEntries = updatedEntries.filter(e => 
      !delta.removed.includes(`${e.startTime}-${e.endTime}`)
    );
    
    // Recalculate summary
    const summary = this.calculateSummary(filteredEntries);
    
    return {
      ...existingData,
      entries: filteredEntries,
      summary
    };
  }
}
```

## Memory Management

### 1. Cache Eviction Policies

```typescript
class CacheEvictionManager {
  private readonly evictionStrategies = {
    LRU: this.evictLRU.bind(this),
    TTL: this.evictExpired.bind(this),
    FIFO: this.evictFIFO.bind(this)
  };
  
  async evictIfNeeded(cache: Map<string, CachedEntry>): Promise<void> {
    const maxSize = this.getMaxSize(cache);
    if (cache.size <= maxSize) return;
    
    const strategy = this.getEvictionStrategy(cache);
    await this.evictionStrategies[strategy](cache, maxSize);
  }
  
  private async evictLRU(cache: Map<string, CachedEntry>, targetSize: number): Promise<void> {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const toEvict = entries.slice(0, entries.length - targetSize);
    for (const [key] of toEvict) {
      cache.delete(key);
    }
  }
  
  private async evictExpired(cache: Map<string, CachedEntry>): Promise<void> {
    const now = Date.now();
    const maxAge = this.getMaxAge(cache);
    
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        cache.delete(key);
      }
    }
  }
}
```

### 2. Resource Monitoring

```typescript
class ResourceMonitor {
  private memoryThresholds = {
    warning: 100 * 1024 * 1024,    // 100MB
    critical: 200 * 1024 * 1024   // 200MB
  };
  
  async checkMemoryUsage(): Promise<MemoryStatus> {
    const usage = await this.getCurrentMemoryUsage();
    
    if (usage > this.memoryThresholds.critical) {
      await this.performEmergencyCleanup();
      return MemoryStatus.CRITICAL;
    } else if (usage > this.memoryThresholds.warning) {
      await this.performOptimization();
      return MemoryStatus.WARNING;
    }
    
    return MemoryStatus.NORMAL;
  }
  
  private async performEmergencyCleanup(): Promise<void> {
    // Aggressive cache clearing
    await this.cache.clear(CacheType.MEMORY);
    
    // Cancel non-critical background tasks
    this.backgroundManager.cancelLowPriorityTasks();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}
```

## Performance Monitoring

### 1. Metrics Collection

```typescript
interface PerformanceMetrics {
  appleScriptCallTime: number[];
  cacheHitRate: number;
  memoryUsage: number;
  updateLatency: number[];
  errorRate: number;
}

class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    appleScriptCallTime: [],
    cacheHitRate: 0,
    memoryUsage: 0,
    updateLatency: [],
    errorRate: 0
  };
  
  trackAppleScriptCall<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    return operation()
      .then(result => {
        const duration = performance.now() - startTime;
        this.recordAppleScriptTime(duration);
        return result;
      })
      .catch(error => {
        const duration = performance.now() - startTime;
        this.recordAppleScriptTime(duration);
        this.recordError();
        throw error;
      });
  }
  
  generatePerformanceReport(): PerformanceReport {
    return {
      averageAppleScriptTime: this.calculateAverage(this.metrics.appleScriptCallTime),
      cacheHitRate: this.metrics.cacheHitRate,
      currentMemoryUsage: this.metrics.memoryUsage,
      averageUpdateLatency: this.calculateAverage(this.metrics.updateLatency),
      errorRate: this.metrics.errorRate,
      recommendations: this.generateRecommendations()
    };
  }
}
```

## Configuration & Tuning

### 1. Adaptive Performance Settings

```typescript
interface PerformanceSettings {
  updateInterval: number;           // milliseconds
  maxConcurrentFetches: number;
  batchSize: number;
  cacheSize: {
    memory: number;
    persistent: number;
    disk: number;
  };
  enableBackgroundProcessing: boolean;
  aggressiveCaching: boolean;
}

class AdaptivePerformanceManager {
  private settings: PerformanceSettings;
  
  async optimizeSettings(): Promise<void> {
    const systemInfo = await this.getSystemInfo();
    const usagePatterns = await this.analyzeUsagePatterns();
    
    // Adjust settings based on system capabilities
    if (systemInfo.memoryGB < 8) {
      this.settings.cacheSize.memory = Math.floor(this.settings.cacheSize.memory / 2);
      this.settings.maxConcurrentFetches = Math.min(this.settings.maxConcurrentFetches, 2);
    }
    
    // Adjust based on usage patterns
    if (usagePatterns.highFrequencyUser) {
      this.settings.updateInterval = Math.max(this.settings.updateInterval / 2, 60000); // Min 1 minute
      this.settings.aggressiveCaching = true;
    }
    
    await this.applySettings();
  }
}
```

This comprehensive performance optimization strategy ensures efficient operation while maintaining real-time responsiveness and system stability.
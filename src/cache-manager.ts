import { CachedEntry, TimingCacheEntry, DailyTimeData } from './types';

export enum CacheType {
	MEMORY = 'memory',
	PERSISTENT = 'persistent'
}

export class CacheManager {
	private memoryCache: Map<string, CachedEntry> = new Map();
	private readonly MAX_MEMORY_ENTRIES = 100;
	private readonly MEMORY_TTL = 5 * 60 * 1000; // 5 minutes
	private readonly PERSISTENT_TTL = 24 * 60 * 60 * 1000; // 24 hours

	constructor(private persistentStorage: any) {
		this.setupCleanupInterval();
	}

	async get<T>(key: string, type: CacheType = CacheType.MEMORY): Promise<CachedEntry<T> | null> {
		switch (type) {
			case CacheType.MEMORY:
				return this.getFromMemory<T>(key);
			case CacheType.PERSISTENT:
				return await this.getFromPersistent<T>(key);
		}
	}

	async set<T>(key: string, data: T, type: CacheType = CacheType.MEMORY, options?: {
		ttl?: number;
		source?: 'applescript' | 'computed' | 'user_input';
		dependencies?: string[];
	}): Promise<void> {
		const entry: CachedEntry<T> = {
			key,
			data,
			timestamp: Date.now(),
			lastAccessed: Date.now(),
			source: options?.source || 'computed',
			version: '1.0',
			dependencies: options?.dependencies
		};

		switch (type) {
			case CacheType.MEMORY:
				await this.setInMemory(key, entry);
				break;
			case CacheType.PERSISTENT:
				await this.setInPersistent(key, entry, options?.ttl);
				break;
		}
	}

	async invalidate(key: string, type?: CacheType): Promise<void> {
		if (!type || type === CacheType.MEMORY) {
			this.memoryCache.delete(key);
		}
		
		if (!type || type === CacheType.PERSISTENT) {
			await this.persistentStorage.removeItem(this.getPersistentKey(key));
		}
	}

	async invalidateByPattern(pattern: RegExp, type?: CacheType): Promise<void> {
		if (!type || type === CacheType.MEMORY) {
			for (const key of this.memoryCache.keys()) {
				if (pattern.test(key)) {
					this.memoryCache.delete(key);
				}
			}
		}
		
		if (!type || type === CacheType.PERSISTENT) {
			const keys = await this.getAllPersistentKeys();
			for (const key of keys) {
				if (pattern.test(key)) {
					await this.persistentStorage.removeItem(this.getPersistentKey(key));
				}
			}
		}
	}

	async clear(type?: CacheType): Promise<void> {
		if (!type || type === CacheType.MEMORY) {
			this.memoryCache.clear();
		}
		
		if (!type || type === CacheType.PERSISTENT) {
			const keys = await this.getAllPersistentKeys();
			for (const key of keys) {
				await this.persistentStorage.removeItem(this.getPersistentKey(key));
			}
		}
	}

	private getFromMemory<T>(key: string): CachedEntry<T> | null {
		const entry = this.memoryCache.get(key) as CachedEntry<T>;
		if (!entry) {
			return null;
		}

		// Check TTL
		if (Date.now() - entry.timestamp > this.MEMORY_TTL) {
			this.memoryCache.delete(key);
			return null;
		}

		// Update last accessed time
		entry.lastAccessed = Date.now();
		return entry;
	}

	private async getFromPersistent<T>(key: string): Promise<CachedEntry<T> | null> {
		try {
			const stored = await this.persistentStorage.getItem(this.getPersistentKey(key));
			if (!stored) {
				return null;
			}

			const entry: CachedEntry<T> = JSON.parse(stored);
			
			// Check TTL
			if (Date.now() - entry.timestamp > this.PERSISTENT_TTL) {
				await this.persistentStorage.removeItem(this.getPersistentKey(key));
				return null;
			}

			// Update last accessed time
			entry.lastAccessed = Date.now();
			await this.persistentStorage.setItem(this.getPersistentKey(key), JSON.stringify(entry));
			
			return entry;
		} catch (error) {
			console.error('Failed to retrieve from persistent cache:', error);
			return null;
		}
	}

	private async setInMemory<T>(key: string, entry: CachedEntry<T>): Promise<void> {
		// Evict old entries if necessary
		if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
			await this.evictMemoryEntries();
		}

		this.memoryCache.set(key, entry);
	}

	private async setInPersistent<T>(key: string, entry: CachedEntry<T>, ttl?: number): Promise<void> {
		try {
			if (ttl) {
				entry.timestamp = Date.now(); // Reset timestamp for custom TTL
			}
			
			await this.persistentStorage.setItem(
				this.getPersistentKey(key), 
				JSON.stringify(entry)
			);
		} catch (error) {
			console.error('Failed to store in persistent cache:', error);
		}
	}

	private async evictMemoryEntries(): Promise<void> {
		// Sort by last accessed time and remove oldest 25%
		const entries = Array.from(this.memoryCache.entries());
		entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
		
		const toRemove = Math.floor(entries.length * 0.25);
		for (let i = 0; i < toRemove; i++) {
			this.memoryCache.delete(entries[i][0]);
		}
	}

	private getPersistentKey(key: string): string {
		return `timing-plugin-${key}`;
	}

	private async getAllPersistentKeys(): Promise<string[]> {
		// This implementation depends on the storage system
		// For localStorage, we'd need to iterate through all keys
		const keys: string[] = [];
		const prefix = 'timing-plugin-';
		
		if (typeof localStorage !== 'undefined') {
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith(prefix)) {
					keys.push(key.substring(prefix.length));
				}
			}
		}
		
		return keys;
	}

	private setupCleanupInterval(): void {
		// Clean up expired entries every 10 minutes
		setInterval(async () => {
			await this.cleanupExpiredEntries();
		}, 10 * 60 * 1000);
	}

	private async cleanupExpiredEntries(): Promise<void> {
		const now = Date.now();

		// Cleanup memory cache
		for (const [key, entry] of this.memoryCache.entries()) {
			if (now - entry.timestamp > this.MEMORY_TTL) {
				this.memoryCache.delete(key);
			}
		}

		// Cleanup persistent cache
		const persistentKeys = await this.getAllPersistentKeys();
		for (const key of persistentKeys) {
			const entry = await this.getFromPersistent(key);
			if (!entry) {
				// Entry was expired and already removed by getFromPersistent
				continue;
			}
		}
	}

	getStats(): {
		memorySize: number;
		memoryKeys: string[];
		oldestEntry: number | null;
		newestEntry: number | null;
	} {
		const entries = Array.from(this.memoryCache.values());
		const timestamps = entries.map(e => e.timestamp);
		
		return {
			memorySize: this.memoryCache.size,
			memoryKeys: Array.from(this.memoryCache.keys()),
			oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
			newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
		};
	}
}

export class TimingDataCache {
	constructor(private cacheManager: CacheManager) {}

	async getDailyData(date: string): Promise<DailyTimeData | null> {
		const key = `daily-${date}`;
		const cached = await this.cacheManager.get<DailyTimeData>(key);
		return cached?.data || null;
	}

	async setDailyData(date: string, data: DailyTimeData, fromAppleScript: boolean = false): Promise<void> {
		const key = `daily-${date}`;
		
		// Store in memory for quick access
		await this.cacheManager.set(key, data, CacheType.MEMORY, {
			source: fromAppleScript ? 'applescript' : 'computed'
		});
		
		// Also store in persistent cache for longer term
		await this.cacheManager.set(key, data, CacheType.PERSISTENT, {
			source: fromAppleScript ? 'applescript' : 'computed',
			ttl: 24 * 60 * 60 * 1000 // 24 hours
		});
	}

	async invalidateDate(date: string): Promise<void> {
		const key = `daily-${date}`;
		await this.cacheManager.invalidate(key, CacheType.MEMORY);
		await this.cacheManager.invalidate(key, CacheType.PERSISTENT);
	}

	async invalidateDateRange(startDate: string, endDate: string): Promise<void> {
		const pattern = new RegExp(`^daily-\\d{4}-\\d{2}-\\d{2}$`);
		await this.cacheManager.invalidateByPattern(pattern);
	}

	async clearAll(): Promise<void> {
		const pattern = new RegExp(`^daily-`);
		await this.cacheManager.invalidateByPattern(pattern);
	}

	generateCacheKey(date: Date, type: 'daily' | 'hourly' | 'summary' = 'daily'): string {
		const dateStr = date.toISOString().split('T')[0];
		return `${type}-${dateStr}`;
	}
}
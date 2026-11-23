export type TrackingTier = 'tier_1' | 'tier_2' | 'tier_3';
export type CollectionStatus = 'observed' | 'partial' | 'error' | 'pending';
export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d' | 'all';

export interface GameRecordData {
  universeId: string;
  rootPlaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  creatorId: string;
  creatorName: string;
  creatorType: 'User' | 'Group';
  creatorVerified?: boolean;
  genre: string;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  currentCcu: number;
  totalVisits: number;
  favorites: number;
  upVotes?: number | null;
  downVotes?: number | null;
  likeRatio?: number | null;
  growth1h?: number | null;
  growth24h?: number | null;
  growth7d?: number | null;
  growth30d?: number | null;
  peakCcuObserved: number;
  peakCcuAt?: string | null;
  snapshotCount?: number;
  trackingTier: TrackingTier;
  active: boolean;
  dataSource: string;
  collectionStatus: CollectionStatus;
  lastCollectedAt: string;
  firstObservedAt: string;
  robloxUpdatedAt?: string | null;
  updatedAt?: string;
}

export interface GameSnapshot {
  id: string;
  universeId: string;
  ccu: number;
  visits: number;
  favorites: number;
  upVotes?: number | null;
  downVotes?: number | null;
  capturedAt: string;
  capturedAtMs: number;
  dataSource: string;
  collectionStatus: 'observed' | 'partial';
}

export interface GameHourlyStat {
  id: string;
  universeId: string;
  hourBucket: string;
  bucketMs: number;
  avgCcu: number;
  minCcu: number;
  maxCcu: number;
  latestVisits: number;
  latestFavorites: number;
  sampleCount: number;
  updatedAt?: string;
}

export interface GameDailyStat {
  id: string;
  universeId: string;
  dayBucket: string;
  bucketMs: number;
  avgCcu: number;
  minCcu: number;
  maxCcu: number;
  visitsEnd: number;
  favoritesEnd: number;
  likeRatio?: number | null;
  sampleCount: number;
  updatedAt?: string;
}

export interface GamePeakRecord {
  universeId: string;
  gameName: string;
  highestObservedCcu: number;
  highestObservedAt: string;
  provenance: 'observed_peak' | 'verified_external';
  updatedAt?: string;
}

export interface CollectionJob {
  id: string;
  tier: 'all' | 'tier_1' | 'tier_2' | 'tier_3' | 'manual';
  triggeredBy: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  gamesAttempted: number;
  gamesSucceeded: number;
  gamesFailed: number;
  apiRequests: number;
  http429Count: number;
  status: 'success' | 'partial' | 'failed';
  errorSummary?: string | null;
}

export interface DataSourceInfo {
  id: string;
  name: string;
  endpoint: string;
  batchLimit: number;
  status: 'active' | 'degraded' | 'disabled';
  notes?: string | null;
  updatedAt?: string;
}

export interface SystemConfig {
  paused: boolean;
  retentionRawHours: number;
  retentionHourlyDays: number;
  tier1IntervalMin: number;
  tier2IntervalMin: number;
  tier3IntervalMin: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface LiveRobloxGamePayload {
  universeId: string;
  rootPlaceId: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorType: 'User' | 'Group';
  creatorVerified: boolean;
  genre: string;
  currentCcu: number;
  totalVisits: number;
  favorites: number;
  upVotes: number | null;
  downVotes: number | null;
  likeRatio: number | null;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  robloxUpdatedAt: string | null;
}

export interface RobloxFetchResponse {
  capturedAt: string;
  dataSource: string;
  games: LiveRobloxGamePayload[];
  telemetry: {
    requestedCount: number;
    returnedCount: number;
    apiRequests: number;
    http429Count: number;
    errors: string[];
    cached: boolean;
  };
}

export interface DeveloperSummary {
  creatorId: string;
  creatorName: string;
  creatorType: 'User' | 'Group';
  creatorVerified: boolean;
  gameCount: number;
  combinedCcu: number;
  totalVisits: number;
  totalFavorites: number;
  avgLikeRatio: number | null;
  topGame: GameRecordData;
  games: GameRecordData[];
}

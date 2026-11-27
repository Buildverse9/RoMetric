export type CodeStatus =
  | 'active'
  | 'pending_verification'
  | 'expired'
  | 'unverified';

export type CodeCoverageStatus = 'covered' | 'no_provider_data' | 'unchecked';

export type CodeProviderType =
  | 'roblox_official'
  | 'mediawiki'
  | 'bloxarchive'
  | 'community';

export interface CodeSourceRecord {
  id: string;
  name: string;
  providerType: CodeProviderType;
  enabled: boolean;
  requiresApiKey: boolean;
  apiKeyConfigured?: boolean;
  attributionLabel: string;
  attributionUrl: string | null;
  licenseNotice: string | null;
  rateLimitRpm: number;
  lastRunAt: string | null;
  lastStatus: 'healthy' | 'degraded' | 'error' | 'disabled' | 'idle' | null;
  lastError: string | null;
  consecutiveFailures: number;
  requestsToday: number;
  updatedAt: string;
}

export interface GameCodeRecord {
  id: number;
  universeId: string;
  gameName?: string;
  gameSlug?: string;
  code: string;
  normalizedCode: string;
  rewardDescription: string | null;
  status: CodeStatus;
  sourceId: string;
  sourceName?: string;
  sourceAttributionLabel?: string;
  sourceLicenseNotice?: string | null;
  sourceUrl: string | null;
  sourceReportedStatus: string | null;
  adminLocked: boolean;
  submittedByNote: string | null;
  discoveredAt: string;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface GameCodeDirectoryItem {
  universeId: string;
  rootPlaceId: string;
  name: string;
  slug: string;
  creatorName: string;
  creatorId: string;
  genre: string;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  currentCcu: number;
  codeCoverageStatus: CodeCoverageStatus;
  activeCodeCount: number;
  pendingCodeCount: number;
  expiredCodeCount: number;
  unverifiedCodeCount: number;
  totalCodeCount: number;
  codesLastCheckedAt: string | null;
  latestCodeUpdatedAt: string | null;
  matchingCodes?: Array<{
    id: number;
    code: string;
    rewardDescription: string | null;
    status: CodeStatus;
  }>;
  activeCodesPreview?: Array<{
    id: number;
    code: string;
    rewardDescription: string | null;
  }>;
}

export interface GameCodesDetailPayload {
  configured: boolean;
  schemaReady: boolean;
  game: {
    universeId: string;
    rootPlaceId: string;
    name: string;
    slug: string;
    creatorName: string;
    creatorId: string;
    creatorVerified: boolean;
    genre: string;
    iconUrl: string | null;
    thumbnailUrl: string | null;
    currentCcu: number;
    totalVisits: number;
    codeCoverageStatus: CodeCoverageStatus;
    codesLastCheckedAt: string | null;
  } | null;
  codes: GameCodeRecord[];
  sources: CodeSourceRecord[];
  relatedGames: Array<{
    universeId: string;
    name: string;
    slug: string;
    iconUrl: string | null;
    genre: string;
    currentCcu: number;
    activeCodeCount: number;
  }>;
}

export interface CodeCollectionLog {
  id: number;
  sourceId: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  gamesChecked: number;
  gamesWithProviderData: number;
  codesDiscovered: number;
  codesUpdated: number;
  codesExpired: number;
  apiRequests: number;
  http429Count: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  errorSummary: string | null;
}

export interface CodeVerificationLog {
  id: number;
  codeId: number | null;
  universeId: string;
  codeText: string;
  previousStatus: string | null;
  newStatus: string;
  actor: string;
  reason: string | null;
  verifiedAt: string;
}

export interface CodesAdminOverview {
  configured: boolean;
  schemaReady: boolean;
  summary: {
    totalGamesTracked: number;
    gamesCovered: number;
    gamesWithoutCoverage: number;
    totalCodes: number;
    activeCodes: number;
    pendingCodes: number;
    expiredCodes: number;
    unverifiedCodes: number;
    lastCollectionAt: string | null;
    totalApiRequestsToday: number;
  };
  sources: CodeSourceRecord[];
  reviewQueue: GameCodeRecord[];
  recentCodes: GameCodeRecord[];
  collectionLogs: CodeCollectionLog[];
  verificationLogs: CodeVerificationLog[];
}

export interface ProviderGameTarget {
  universeId: string;
  rootPlaceId: string;
  name: string;
  slug: string;
  description: string | null;
  creatorId: string;
  creatorType: 'User' | 'Group';
  wikiSubdomain: string | null;
}

export interface ProviderDiscoveredCode {
  code: string;
  rewardDescription: string | null;
  status: 'active' | 'expired' | 'unverified';
  sourceReportedStatus: string;
  sourceUrl: string | null;
  expiresAt: string | null;
}

export interface ProviderFetchResult {
  hasProviderData: boolean;
  codes: ProviderDiscoveredCode[];
  resolvedWikiSubdomain?: string | null;
  apiRequests: number;
  http429Count: number;
  error?: string;
}

export interface CodeProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly providerType: CodeProviderType;
  readonly requiresApiKey: boolean;
  isConfigured(): boolean;
  fetchForGame(target: ProviderGameTarget): Promise<ProviderFetchResult>;
}

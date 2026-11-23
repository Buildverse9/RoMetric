# RoMetric Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Any unmatched path is strictly denied for all reads and writes.
2. **Public Analytics Read-Only**: Public visitors can read `games`, `game_snapshots`, `game_hourly_stats`, `game_daily_stats`, `game_records`, and `data_sources`, which contain zero PII (only public Roblox experience statistics).
3. **Immutable Historical Snapshots**: Documents in `game_snapshots` can NEVER be updated (`allow update: if false;`), guaranteeing raw historical observations are never overwritten.
4. **Admin-Only Mutations & Operations**: Only the verified bootstrapped owner (`shraddhavengurlekar200216@gmail.com` with `email_verified == true`) or verified UIDs in `/admins/{uid}` may write analytics data, modify tracking tiers, read/write `collection_jobs`, or modify `system_config`.
5. **Strict Schema Validation**: Every create and update enforces exact key allowlists (`hasAll`/`hasOnly`), numeric bounds, string length limits, and regex ID hardening (`isValidId`).

## 2. Adversarial Payloads ("Dirty Dozen" Rejected Cases)
1. Unauthenticated write to `/games/12345` -> DENIED
2. Authenticated non-admin write to `/games/12345` -> DENIED
3. Unverified email matching admin address attempting write (`email_verified: false`) -> DENIED
4. Admin attempting to update an existing `/game_snapshots/{id}` (historical tampering) -> DENIED
5. Shadow field injection (`isFeatured: true`) on `/games/12345` create -> DENIED
6. Oversized string payload (20KB `name`) on `/games/12345` -> DENIED
7. Invalid document ID containing path traversal or junk (`../../etc`) -> DENIED
8. Negative CCU or negative visits on `/game_snapshots/{id}` -> DENIED
9. Public visitor attempting to read `/collection_jobs/{id}` -> DENIED
10. Public visitor attempting to read `/system_config/collector` -> DENIED
11. Non-admin attempting self-privilege escalation by creating `/admins/{uid}` -> DENIED
12. Invalid `trackingTier` enum value (`tier_99`) on `/games/12345` update -> DENIED

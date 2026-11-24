/**
 * ============================================================================
 * RoMetric — Google Apps Script Sidecar (Zero-Cost 3,000-Game Scale Engine)
 * ============================================================================
 *
 * Works alongside your Cloudflare Worker (which handles fast 5m/30m CCU pulses)
 * using your free Google Apps Script quotas + 5 TB Google AI Pro Drive:
 *
 *   1) Every 2 hours  -> `runDiscoveryAndHygiene()`
 *        Creator Exchange-style 4-vector discovery:
 *          • Roblox Explore Charts & Deep Pagination
 *          • Creator & Group Graph Crawl (other games by known studios)
 *          • Similar / Recommended Games Graph Walk
 *          • Rotating Omni-Search Keyword Sweeps
 *        Inserts newly discovered games with >= 25 CCU (with icons, thumbnails,
 *        and votes), enforces the 3,000 active roster cap, rebalances Tier 1
 *        (Top 100), and deactivates dormant games (< 10 CCU for 7+ days).
 *
 *   2) Every 6 hours  -> `runVotesAndMetadataRefresh()`
 *        Batch-refreshes up_votes, down_votes, and like_ratio across ALL active
 *        games (up to 3,000) using parallel UrlFetchApp.fetchAll so Cloudflare
 *        Workers never waste subrequests on slow-moving vote counts.
 *
 *   3) Daily 02:30 UTC -> `runNightlyDriveArchive()`
 *        Exports yesterday's UTC hourly & daily rollups from Supabase,
 *        compresses them with gzip, and saves them permanently to your 5 TB
 *        Google Drive under `/RoMetric-Archive/YYYY/MM/rometric-YYYY-MM-DD.json.gz`
 *        right before Supabase's 03:00 UTC cleanup runs.
 *
 *   4) Every 6 hours  -> `runCodesCollection()`
 *        Runs automated, compliant promotional code collection across a rotating
 *        batch of stalest active games using enabled modular providers:
 *          • Official Roblox Public Signals (game descriptions + group shouts)
 *          • Fandom MediaWiki Action API (`api.php`, CC BY-SA attributed)
 *          • Optional BloxArchive API (only if enabled & Script Properties set)
 *        Idempotently upserts `game_codes` (respecting `admin_locked`), logs
 *        verification changes and provider health, and distinguishes
 *        `no_provider_data` from games with verified coverage.
 *
 * ----------------------------------------------------------------------------
 * ONE-TIME SETUP (2 minutes):
 *   1. Open https://script.google.com -> Click "New project" -> Name it "RoMetric Sidecar".
 *   2. Paste this entire file into Code.gs and Save.
 *   3. Go to Project Settings (gear icon) -> Script Properties -> Add 2 properties:
 *        - SUPABASE_URL              = https://YOUR_PROJECT_REF.supabase.co
 *        - SUPABASE_SERVICE_ROLE_KEY = your_supabase_service_role_or_secret_key
 *      Optional (only if you have a commercial BloxArchive API key):
 *        - BLOXARCHIVE_API_KEY       = your_key
 *        - BLOXARCHIVE_API_BASE_URL  = https://api.bloxarchive.example
 *   4. Return to Editor, select `setupRoMetricSidecar` in the top toolbar, and click Run.
 *      Approve Google Drive + External Request permissions once.
 *   5. Done! (Optionally run `runDiscoveryAndHygiene` or `runCodesCollection` once manually.)
 * ============================================================================
 */

var CONFIG = {
  MIN_DISCOVERY_CCU: 25,          // Only ingest games with >= 25 live CCU
  DORMANT_CCU_THRESHOLD: 10,      // Auto-deactivate if < 10 CCU for 7+ days
  DORMANT_GRACE_DAYS: 7,
  MAX_ACTIVE_GAMES: 3000,         // Roster ceiling matching 30-min Cloudflare SLA
  MAX_NEW_PER_DISCOVERY_RUN: 350, // Safe per-run batch inside 6-min Apps Script limit
  TOP_TIER1_COUNT: 100,           // Top 100 games stay on 5-minute Tier 1 pulse
  ROBLOX_BATCH_SIZE: 50,
  ARCHIVE_ROOT_FOLDER: 'RoMetric-Archive',
};

var OMNI_KEYWORDS = [
  'simulator', 'tycoon', 'obby', 'anime', 'rng', 'horror', 'tower defense',
  'roleplay', 'battlegrounds', 'survival', 'racing', 'football', 'basketball',
  'pets', 'clicker', 'dungeon', 'fps', 'shooter', 'zombie', 'escape',
  'mystery', 'murder', 'brookhaven', 'fruits', 'sword', 'mining', 'fishing',
  'cooking', 'restaurant', 'empire', 'war', 'military', 'car', 'drift',
  'train', 'plane', 'city', 'school', 'hospital', 'fashion', 'dance',
  'music', 'parkour', 'slap', 'troll', 'brainrot', 'egg', 'steal', 'grow',
  'garden', 'dragon', 'hero', 'ninja', 'pirate', 'space', 'sci-fi', 'medieval',
];

/**
 * One-time installer: verifies Script Properties, creates the Google Drive
 * archive folder, clears any old RoMetric triggers, and registers all 3 schedules.
 */
function setupRoMetricSidecar() {
  var cfg = getSupabaseConfig_();
  getOrCreateFolderPath_([CONFIG.ARCHIVE_ROOT_FOLDER]);

  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var fn = existing[i].getHandlerFunction();
    if (
      fn === 'runDiscoveryAndHygiene' ||
      fn === 'runVotesAndMetadataRefresh' ||
      fn === 'runNightlyDriveArchive' ||
      fn === 'runCodesCollection'
    ) {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }

  // 1) Every 2 hours: 4-Vector Discovery + Roster Hygiene
  ScriptApp.newTrigger('runDiscoveryAndHygiene')
    .timeBased()
    .everyHours(2)
    .create();

  // 2) Every 6 hours: Parallel Votes & Rating Refresh
  ScriptApp.newTrigger('runVotesAndMetadataRefresh')
    .timeBased()
    .everyHours(6)
    .create();

  // 3) Daily around 02:30 UTC: 5 TB Google Drive Cold Archive
  ScriptApp.newTrigger('runNightlyDriveArchive')
    .timeBased()
    .inTimezone('UTC')
    .atHour(2)
    .nearMinute(30)
    .everyDays(1)
    .create();

  // 4) Every 6 hours: Automated Roblox Game Codes Collection
  ScriptApp.newTrigger('runCodesCollection')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log(
    'RoMetric Sidecar configured for ' + cfg.baseUrl + '. All 4 triggers registered.'
  );
}

/* ============================================================================
 * 1) EVERY 2 HOURS: 4-VECTOR CREATOR EXCHANGE-STYLE DISCOVERY + ROSTER HYGIENE
 * ============================================================================ */

function runDiscoveryAndHygiene() {
  var startedAt = new Date().toISOString();
  var startedMs = Date.now();
  var counters = { apiRequests: 0, http429Count: 0 };
  var errors = [];
  var props = PropertiesService.getScriptProperties();

  // Load current games from Supabase (up to 4,000 rows for dedupe + graph seeds)
  var dbGames = fetchAllSupabaseGames_(
    'universe_id,creator_id,creator_type,current_ccu,peak_ccu_observed,tracking_tier,active,first_observed_at,last_collected_at'
  );
  var existingSet = {};
  var activeGames = [];
  for (var i = 0; i < dbGames.length; i++) {
    existingSet[String(dbGames[i].universe_id)] = dbGames[i];
    if (dbGames[i].active !== false) {
      activeGames.push(dbGames[i]);
    }
  }

  var candidateMap = {}; // universeId -> estimated playerCount hint
  function addCandidate(uid, ccuHint) {
    var id = Number(uid);
    if (!id || !isFinite(id) || id <= 0) return;
    var key = String(id);
    if (existingSet[key]) return;
    var hint = Number(ccuHint) || 0;
    if (!candidateMap[key] || hint > candidateMap[key]) {
      candidateMap[key] = hint;
    }
  }

  var sessionId = 'rometric-gas-' + Date.now();

  // --- VECTOR 1: Roblox Explore Charts + Paginated Sorts ---
  try {
    var sortsRes = fetchJsonSafe_(
      'https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=' + sessionId,
      counters
    );
    var sortIds = [
      'top-playing-now',
      'top-trending',
      'up-and-coming',
      'top-earning',
      'most-popular',
      'top-rated',
      'top-revisited',
      'fun-with-friends',
    ];
    if (sortsRes && sortsRes.sorts) {
      for (var s = 0; s < sortsRes.sorts.length; s++) {
        var sortObj = sortsRes.sorts[s];
        if (sortObj.sortId && sortIds.indexOf(sortObj.sortId) === -1) {
          sortIds.push(sortObj.sortId);
        }
        var previewGames = sortObj.games || [];
        for (var pg = 0; pg < previewGames.length; pg++) {
          addCandidate(previewGames[pg].universeId, previewGames[pg].playerCount);
        }
      }
    }

    // Rotate 10 sorts per run (2 pages each) via fetchAll
    var sortCursor = Number(props.getProperty('CURSOR_SORT') || '0');
    var batchSorts = [];
    for (var si = 0; si < Math.min(10, sortIds.length); si++) {
      batchSorts.push(sortIds[(sortCursor + si) % sortIds.length]);
    }
    props.setProperty('CURSOR_SORT', String((sortCursor + batchSorts.length) % Math.max(1, sortIds.length)));

    var sortUrls = batchSorts.map(function (sid) {
      return (
        'https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=' +
        sessionId +
        '&sortId=' +
        encodeURIComponent(sid)
      );
    });
    var page1Results = fetchAllJsonSafe_(sortUrls, counters);
    var page2Urls = [];
    for (var r1 = 0; r1 < page1Results.length; r1++) {
      var data1 = page1Results[r1];
      if (!data1) continue;
      var games1 = data1.games || [];
      for (var g1 = 0; g1 < games1.length; g1++) {
        addCandidate(games1[g1].universeId, games1[g1].playerCount);
      }
      if (data1.nextPageToken) {
        page2Urls.push(
          'https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=' +
            sessionId +
            '&sortId=' +
            encodeURIComponent(batchSorts[r1]) +
            '&pageToken=' +
            encodeURIComponent(data1.nextPageToken)
        );
      }
    }
    if (page2Urls.length > 0) {
      var page2Results = fetchAllJsonSafe_(page2Urls, counters);
      for (var r2 = 0; r2 < page2Results.length; r2++) {
        var games2 = (page2Results[r2] && page2Results[r2].games) || [];
        for (var g2 = 0; g2 < games2.length; g2++) {
          addCandidate(games2[g2].universeId, games2[g2].playerCount);
        }
      }
    }
  } catch (e) {
    errors.push('Explore vector: ' + String(e));
  }

  // --- VECTOR 2: Creator & Group Graph Crawl (uncovers side-projects & 25+ CCU indie games) ---
  try {
    var uniqueCreators = [];
    var seenCreator = {};
    for (var c = 0; c < activeGames.length; c++) {
      var cid = activeGames[c].creator_id;
      var ctype = activeGames[c].creator_type || 'Group';
      var ckey = ctype + ':' + cid;
      if (cid && cid > 0 && !seenCreator[ckey]) {
        seenCreator[ckey] = true;
        uniqueCreators.push({ id: cid, type: ctype });
      }
    }

    if (uniqueCreators.length > 0) {
      var creatorCursor = Number(props.getProperty('CURSOR_CREATOR') || '0');
      var creatorSlice = [];
      var creatorCount = Math.min(24, uniqueCreators.length);
      for (var ci = 0; ci < creatorCount; ci++) {
        creatorSlice.push(uniqueCreators[(creatorCursor + ci) % uniqueCreators.length]);
      }
      props.setProperty(
        'CURSOR_CREATOR',
        String((creatorCursor + creatorCount) % uniqueCreators.length)
      );

      var creatorUrls = creatorSlice.map(function (cr) {
        if (cr.type === 'User') {
          return (
            'https://games.roblox.com/v2/users/' +
            cr.id +
            '/games?accessFilter=Public&limit=50&sortOrder=Desc'
          );
        }
        return (
          'https://games.roblox.com/v2/groups/' +
          cr.id +
          '/games?accessFilter=Public&limit=50&sortOrder=Desc'
        );
      });
      var creatorResponses = fetchAllJsonSafe_(creatorUrls, counters);
      for (var crIdx = 0; crIdx < creatorResponses.length; crIdx++) {
        var crList = (creatorResponses[crIdx] && creatorResponses[crIdx].data) || [];
        for (var cg = 0; cg < crList.length; cg++) {
          addCandidate(crList[cg].id, 0);
        }
      }
    }
  } catch (e) {
    errors.push('Creator graph vector: ' + String(e));
  }

  // --- VECTOR 3: Similar / Recommended Games Graph Walk ---
  try {
    if (activeGames.length > 0) {
      var recCursor = Number(props.getProperty('CURSOR_REC') || '0');
      var recCount = Math.min(20, activeGames.length);
      var recUrls = [];
      for (var ri = 0; ri < recCount; ri++) {
        var seedGame = activeGames[(recCursor + ri) % activeGames.length];
        recUrls.push(
          'https://games.roblox.com/v1/games/recommendations/game/' +
            seedGame.universe_id +
            '?maxRows=24'
        );
      }
      props.setProperty(
        'CURSOR_REC',
        String((recCursor + recCount) % activeGames.length)
      );

      var recResponses = fetchAllJsonSafe_(recUrls, counters);
      for (var rr = 0; rr < recResponses.length; rr++) {
        var recList = (recResponses[rr] && recResponses[rr].games) || [];
        for (var rg = 0; rg < recList.length; rg++) {
          addCandidate(recList[rg].universeId, recList[rg].playerCount);
        }
      }
    }
  } catch (e) {
    errors.push('Recommendations vector: ' + String(e));
  }

  // --- VECTOR 4: Rotating Omni-Search Keyword Sweeps ---
  try {
    var kwCursor = Number(props.getProperty('CURSOR_KEYWORD') || '0');
    var kwCount = 8;
    var kwUrls = [];
    for (var ki = 0; ki < kwCount; ki++) {
      var kw = OMNI_KEYWORDS[(kwCursor + ki) % OMNI_KEYWORDS.length];
      kwUrls.push(
        'https://apis.roblox.com/search-api/omni-search?searchQuery=' +
          encodeURIComponent(kw) +
          '&sessionId=' +
          sessionId
      );
    }
    props.setProperty(
      'CURSOR_KEYWORD',
      String((kwCursor + kwCount) % OMNI_KEYWORDS.length)
    );

    var kwResponses = fetchAllJsonSafe_(kwUrls, counters);
    for (var kr = 0; kr < kwResponses.length; kr++) {
      var groups = (kwResponses[kr] && kwResponses[kr].searchResults) || [];
      for (var gr = 0; gr < groups.length; gr++) {
        var contents = groups[gr].contents || [];
        for (var ct = 0; ct < contents.length; ct++) {
          addCandidate(contents[ct].universeId, contents[ct].playerCount);
        }
      }
    }
  } catch (e) {
    errors.push('Omni-search vector: ' + String(e));
  }

  // Sort candidate universe IDs by CCU hint descending and probe via Roblox v1/games
  var candidateIds = Object.keys(candidateMap)
    .sort(function (a, b) {
      return (candidateMap[b] || 0) - (candidateMap[a] || 0);
    })
    .slice(0, 800);

  var qualifiedGames = [];
  var idChunks = chunkArray_(candidateIds, CONFIG.ROBLOX_BATCH_SIZE);
  for (var ic = 0; ic < idChunks.length; ic += 4) {
    var waveChunks = idChunks.slice(ic, ic + 4);
    var probeUrls = waveChunks.map(function (ch) {
      return 'https://games.roblox.com/v1/games?universeIds=' + ch.join(',');
    });
    var probeRes = fetchAllJsonSafe_(probeUrls, counters);
    for (var pr = 0; pr < probeRes.length; pr++) {
      var items = (probeRes[pr] && probeRes[pr].data) || [];
      for (var it = 0; it < items.length; it++) {
        var game = items[it];
        if (Number(game.playing || 0) >= CONFIG.MIN_DISCOVERY_CCU) {
          qualifiedGames.push(game);
        }
      }
    }
  }

  // Respect MAX_ACTIVE_GAMES headroom & per-run budget
  var slotsAvailable = Math.max(0, CONFIG.MAX_ACTIVE_GAMES - activeGames.length);
  var toInsert = qualifiedGames
    .sort(function (a, b) {
      return (b.playing || 0) - (a.playing || 0);
    })
    .slice(0, Math.min(CONFIG.MAX_NEW_PER_DISCOVERY_RUN, Math.max(slotsAvailable, 50)));

  var insertedCount = 0;
  if (toInsert.length > 0) {
    var nowIso = new Date().toISOString();
    var capturedMinute = Math.floor(Date.now() / 60000);
    var insertChunks = chunkArray_(toInsert, CONFIG.ROBLOX_BATCH_SIZE);

    for (var n = 0; n < insertChunks.length; n++) {
      var batch = insertChunks[n];
      var batchIds = batch
        .map(function (g) {
          return g.id;
        })
        .join(',');

      var metaResponses = fetchAllJsonSafe_(
        [
          'https://games.roblox.com/v1/games/votes?universeIds=' + batchIds,
          'https://thumbnails.roblox.com/v1/games/icons?universeIds=' +
            batchIds +
            '&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false',
          'https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=' +
            batchIds +
            '&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false',
        ],
        counters
      );

      var voteMap = {};
      var vData = (metaResponses[0] && metaResponses[0].data) || [];
      for (var vi = 0; vi < vData.length; vi++) {
        voteMap[vData[vi].id] = vData[vi];
      }

      var iconMap = {};
      var iData = (metaResponses[1] && metaResponses[1].data) || [];
      for (var ii = 0; ii < iData.length; ii++) {
        if (iData[ii].imageUrl && iData[ii].imageUrl.indexOf('https://') === 0) {
          iconMap[iData[ii].targetId] = iData[ii].imageUrl;
        }
      }

      var thumbMap = {};
      var tData = (metaResponses[2] && metaResponses[2].data) || [];
      for (var ti = 0; ti < tData.length; ti++) {
        var thumbs = tData[ti].thumbnails || [];
        for (var tj = 0; tj < thumbs.length; tj++) {
          if (thumbs[tj].imageUrl && thumbs[tj].imageUrl.indexOf('https://') === 0) {
            thumbMap[tData[ti].universeId] = thumbs[tj].imageUrl;
            break;
          }
        }
      }

      var gameRows = [];
      var snapRows = [];
      var peakRows = [];

      for (var b = 0; b < batch.length; b++) {
        var g = batch[b];
        var ccu = Math.max(0, Number(g.playing || 0));
        var vote = voteMap[g.id] || null;
        var up = vote ? Number(vote.upVotes || 0) : null;
        var down = vote ? Number(vote.downVotes || 0) : null;
        var likeRatio =
          up !== null && down !== null && up + down > 0
            ? Number(((up / (up + down)) * 100).toFixed(2))
            : null;
        var tier = ccu >= 25000 ? 'tier_1' : ccu >= 2000 ? 'tier_2' : 'tier_3';
        var genreLabel = String(g.genre_l1 || g.genre || 'All Genres')
          .trim()
          .slice(0, 80);

        gameRows.push({
          universe_id: g.id,
          root_place_id: g.rootPlaceId || g.id,
          name: String(g.name || 'Experience ' + g.id)
            .trim()
            .slice(0, 200),
          slug: slugify_(g.name || 'experience-' + g.id),
          description: String(g.description || '').slice(0, 1900),
          creator_id: (g.creator && g.creator.id) || 0,
          creator_name: String((g.creator && g.creator.name) || 'Unknown Creator').slice(
            0,
            120
          ),
          creator_type: g.creator && g.creator.type === 'User' ? 'User' : 'Group',
          creator_verified: Boolean(g.creator && g.creator.hasVerifiedBadge),
          genre: genreLabel || 'All Genres',
          icon_url: iconMap[g.id] || null,
          thumbnail_url: thumbMap[g.id] || null,
          current_ccu: ccu,
          total_visits: Math.max(0, Number(g.visits || 0)),
          favorites: Math.max(0, Number(g.favoritedCount || 0)),
          up_votes: up,
          down_votes: down,
          like_ratio: likeRatio,
          peak_ccu_observed: ccu,
          peak_ccu_at: nowIso,
          tracking_tier: tier,
          active: true,
          data_source_id: 'roblox_games_v1',
          collection_status: vote ? 'observed' : 'partial',
          first_observed_at: nowIso,
          last_collected_at: nowIso,
          roblox_updated_at: g.updated ? String(g.updated).slice(0, 40) : null,
          updated_at: nowIso,
        });

        snapRows.push({
          universe_id: g.id,
          ccu: ccu,
          visits: Math.max(0, Number(g.visits || 0)),
          favorites: Math.max(0, Number(g.favoritedCount || 0)),
          up_votes: up,
          down_votes: down,
          captured_at: nowIso,
          captured_minute: capturedMinute,
          data_source_id: 'roblox_games_v1',
          collection_status: vote ? 'observed' : 'partial',
        });

        peakRows.push({
          universe_id: g.id,
          highest_observed_ccu: ccu,
          highest_observed_at: nowIso,
          provenance: 'observed_peak',
          updated_at: nowIso,
        });
      }

      var okGames = supabaseWrite_(
        'games?on_conflict=universe_id',
        'POST',
        gameRows,
        'resolution=merge-duplicates'
      );
      if (okGames) {
        insertedCount += gameRows.length;
        supabaseWrite_(
          'game_snapshots?on_conflict=universe_id,captured_minute',
          'POST',
          snapRows,
          'resolution=ignore-duplicates'
        );
        supabaseWrite_(
          'game_records?on_conflict=universe_id',
          'POST',
          peakRows,
          'resolution=merge-duplicates'
        );
      } else {
        errors.push('Failed to upsert discovery batch ' + n);
      }
    }
  }

  // --- ROSTER HYGIENE: Deactivate long-dormant (< 10 CCU for 7+ days) games & rebalance Tier 1 ---
  try {
    var graceCutoffMs = Date.now() - CONFIG.DORMANT_GRACE_DAYS * 24 * 60 * 60 * 1000;
    var dormantIds = [];
    for (var d = 0; d < activeGames.length; d++) {
      var ag = activeGames[d];
      var firstTs = new Date(ag.first_observed_at).getTime();
      if (
        isFinite(firstTs) &&
        firstTs < graceCutoffMs &&
        Number(ag.current_ccu || 0) < CONFIG.DORMANT_CCU_THRESHOLD &&
        Number(ag.peak_ccu_observed || 0) < 100
      ) {
        dormantIds.push(ag.universe_id);
      }
    }
    if (dormantIds.length > 0) {
      var dormantChunks = chunkArray_(dormantIds, 100);
      for (var dc = 0; dc < dormantChunks.length; dc++) {
        supabasePatchByFilter_(
          'games?universe_id=in.(' + dormantChunks[dc].join(',') + ')',
          { active: false, updated_at: new Date().toISOString() }
        );
      }
    }

    // Keep exact Top 100 active games promoted to Tier 1 (5m pulse)
    var sortedActive = activeGames
      .slice()
      .sort(function (a, b) {
        return (b.current_ccu || 0) - (a.current_ccu || 0);
      });
    var promoteIds = [];
    var demoteIds = [];
    for (var idx = 0; idx < sortedActive.length; idx++) {
      var item = sortedActive[idx];
      if (idx < CONFIG.TOP_TIER1_COUNT && item.tracking_tier !== 'tier_1') {
        promoteIds.push(item.universe_id);
      } else if (idx >= CONFIG.TOP_TIER1_COUNT && item.tracking_tier === 'tier_1') {
        demoteIds.push(item.universe_id);
      }
    }
    if (promoteIds.length > 0) {
      supabasePatchByFilter_(
        'games?universe_id=in.(' + promoteIds.slice(0, 100).join(',') + ')',
        { tracking_tier: 'tier_1', updated_at: new Date().toISOString() }
      );
    }
    if (demoteIds.length > 0) {
      supabasePatchByFilter_(
        'games?universe_id=in.(' + demoteIds.slice(0, 100).join(',') + ')',
        { tracking_tier: 'tier_2', updated_at: new Date().toISOString() }
      );
    }
  } catch (e) {
    errors.push('Roster hygiene: ' + String(e));
  }

  logCollectionJob_({
    tier: 'all',
    triggered_by: 'google_apps_script_discover',
    started_at: startedAt,
    duration_ms: Date.now() - startedMs,
    games_attempted: candidateIds.length,
    games_succeeded: insertedCount,
    games_failed: Math.max(0, toInsert.length - insertedCount),
    api_requests: counters.apiRequests,
    http_429_count: counters.http429Count,
    status: errors.length > 0 && insertedCount === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'success',
    error_summary: errors.length ? errors.join(' | ').slice(0, 900) : null,
  });
}

/* ============================================================================
 * 2) EVERY 6 HOURS: PARALLEL VOTES & RATING REFRESH FOR ALL ACTIVE GAMES
 * ============================================================================ */

function runVotesAndMetadataRefresh() {
  var startedAt = new Date().toISOString();
  var startedMs = Date.now();
  var counters = { apiRequests: 0, http429Count: 0 };
  var errors = [];

  var activeGames = fetchAllSupabaseGames_(
    'universe_id,root_place_id,name,slug,creator_id,creator_name,creator_type,active',
    '&active=eq.true'
  );
  if (activeGames.length === 0) return;

  var gameMap = {};
  var ids = [];
  for (var i = 0; i < activeGames.length; i++) {
    gameMap[activeGames[i].universe_id] = activeGames[i];
    ids.push(activeGames[i].universe_id);
  }

  var chunks = chunkArray_(ids, CONFIG.ROBLOX_BATCH_SIZE);
  var nowIso = new Date().toISOString();
  var patches = [];

  for (var c = 0; c < chunks.length; c += 5) {
    var wave = chunks.slice(c, c + 5);
    var urls = wave.map(function (ch) {
      return 'https://games.roblox.com/v1/games/votes?universeIds=' + ch.join(',');
    });
    var responses = fetchAllJsonSafe_(urls, counters);
    for (var r = 0; r < responses.length; r++) {
      var list = (responses[r] && responses[r].data) || [];
      for (var k = 0; k < list.length; k++) {
        var v = list[k];
        var existing = gameMap[v.id];
        if (!existing) continue;
        var up = Number(v.upVotes || 0);
        var down = Number(v.downVotes || 0);
        var ratio =
          up + down > 0 ? Number(((up / (up + down)) * 100).toFixed(2)) : null;

        patches.push({
          universe_id: v.id,
          root_place_id: existing.root_place_id || v.id,
          name: existing.name,
          slug: existing.slug,
          creator_id: existing.creator_id,
          creator_name: existing.creator_name,
          creator_type: existing.creator_type || 'Group',
          up_votes: up,
          down_votes: down,
          like_ratio: ratio,
          updated_at: nowIso,
        });
      }
    }
  }

  var updatedCount = 0;
  var patchChunks = chunkArray_(patches, 250);
  for (var p = 0; p < patchChunks.length; p++) {
    var ok = supabaseWrite_(
      'games?on_conflict=universe_id',
      'POST',
      patchChunks[p],
      'resolution=merge-duplicates'
    );
    if (ok) {
      updatedCount += patchChunks[p].length;
    } else {
      errors.push('Votes upsert chunk ' + p + ' failed');
    }
  }

  logCollectionJob_({
    tier: 'all',
    triggered_by: 'google_apps_script_votes',
    started_at: startedAt,
    duration_ms: Date.now() - startedMs,
    games_attempted: ids.length,
    games_succeeded: updatedCount,
    games_failed: Math.max(0, ids.length - updatedCount),
    api_requests: counters.apiRequests,
    http_429_count: counters.http429Count,
    status: updatedCount === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'success',
    error_summary: errors.length ? errors.join(' | ').slice(0, 900) : null,
  });
}

/* ============================================================================
 * 3) DAILY 02:30 UTC: COMPRESSED COLD ARCHIVE TO YOUR 5 TB GOOGLE DRIVE
 * ============================================================================ */

function runNightlyDriveArchive() {
  var startedAt = new Date().toISOString();
  var startedMs = Date.now();
  var errors = [];

  // Archive yesterday's complete UTC day before Supabase 03:00 UTC pruning runs
  var targetDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var yyyy = String(targetDate.getUTCFullYear());
  var mm = ('0' + (targetDate.getUTCMonth() + 1)).slice(-2);
  var dd = ('0' + targetDate.getUTCDate()).slice(-2);
  var dayStr = yyyy + '-' + mm + '-' + dd;
  var dayStartIso = dayStr + 'T00:00:00.000Z';
  var dayEndIso = dayStr + 'T23:59:59.999Z';

  var hourlyRows = fetchPaginatedSupabase_(
    'game_hourly_stats?select=*&hour_bucket=gte.' +
      encodeURIComponent(dayStartIso) +
      '&hour_bucket=lte.' +
      encodeURIComponent(dayEndIso) +
      '&order=hour_bucket.asc',
    80 // up to 80,000 rows (3,000 games * 24h = 72,000 max)
  );

  var dailyRows = fetchPaginatedSupabase_(
    'game_daily_stats?select=*&day_bucket=eq.' + encodeURIComponent(dayStr),
    5
  );

  var payload = {
    archive_date_utc: dayStr,
    exported_at_utc: new Date().toISOString(),
    hourly_count: hourlyRows.length,
    daily_count: dailyRows.length,
    daily_stats: dailyRows,
    hourly_stats: hourlyRows,
  };

  var fileName = 'rometric-' + dayStr + '.json.gz';
  var savedBytes = 0;

  try {
    var folder = getOrCreateFolderPath_([CONFIG.ARCHIVE_ROOT_FOLDER, yyyy, mm]);
    // Replace existing archive for the same date if re-run
    var oldFiles = folder.getFilesByName(fileName);
    while (oldFiles.hasNext()) {
      oldFiles.next().setTrashed(true);
    }

    var rawBlob = Utilities.newBlob(
      JSON.stringify(payload),
      'application/json',
      'rometric-' + dayStr + '.json'
    );
    var gzBlob = Utilities.gzip(rawBlob, fileName);
    var createdFile = folder.createFile(gzBlob);
    savedBytes = createdFile.getSize();
  } catch (e) {
    errors.push('Drive archive failed: ' + String(e));
  }

  logCollectionJob_({
    tier: 'all',
    triggered_by: 'google_apps_script_archive',
    started_at: startedAt,
    duration_ms: Date.now() - startedMs,
    games_attempted: dailyRows.length,
    games_succeeded: errors.length === 0 ? dailyRows.length : 0,
    games_failed: errors.length === 0 ? 0 : dailyRows.length,
    api_requests: Math.ceil((hourlyRows.length + dailyRows.length) / 1000) + 1,
    http_429_count: 0,
    status: errors.length === 0 ? 'success' : 'failed',
    error_summary:
      errors.length > 0
        ? errors.join(' | ').slice(0, 900)
        : 'Archived ' +
          hourlyRows.length +
          ' hourly + ' +
          dailyRows.length +
          ' daily rows (' +
          Math.round(savedBytes / 1024) +
          ' KB gz) to Drive',
  });
}

/* ============================================================================
 * 4) EVERY 6 HOURS: AUTOMATED ROBLOX GAME CODES COLLECTION
 * ============================================================================ */

var CURATED_WIKI_MAP = {
  '994732206': 'blox-fruits',
  '245662005': 'jailbreak',
  '111958650': 'roblox-arsenal',
  '2862098693': 'project-slayers',
  '1451439645': 'shindo-life-rell',
  '3183403065': 'anime-adventures',
  '601130232': 'bee-swarm-simulator',
  '1119466531': 'all-star-tower-defense',
  '1720936166': 'grand-piece-online',
  '4777817887': 'blade-ball',
  '5040354225': 'dress-to-impress',
  '6505338302': 'anime-vanguards',
  '1686885941': 'bedwars',
  '3808081382': 'the-strongest-battlegrounds',
  '5750914919': 'fisch',
  '3317771874': 'pet-simulator-99',
  '2619619496': 'bedwars',
};

function runCodesCollection() {
  var cfg = getSupabaseConfig_();
  var props = PropertiesService.getScriptProperties();
  var bloxKey = (props.getProperty('BLOXARCHIVE_API_KEY') || '').trim();
  var bloxBase = (
    props.getProperty('BLOXARCHIVE_API_BASE_URL') ||
    'https://bloxarchive.com/api/partner/v1'
  )
    .trim()
    .replace(/\/+$/, '');

  // 1) Fetch enabled code sources
  var sourcesRes = UrlFetchApp.fetch(
    cfg.baseUrl + '/rest/v1/code_sources?select=*&order=id.asc',
    {
      method: 'get',
      headers: getSupabaseHeaders_(),
      muteHttpExceptions: true,
    }
  );
  if (sourcesRes.getResponseCode() < 200 || sourcesRes.getResponseCode() >= 300) {
    Logger.log('Codes schema not ready or code_sources unreachable.');
    return;
  }
  var allSources = JSON.parse(sourcesRes.getContentText() || '[]');
  var enabledMap = {};
  for (var si = 0; si < allSources.length; si++) {
    if (allSources[si].enabled) {
      enabledMap[allSources[si].id] = allSources[si];
    }
  }

  // 2) Fetch rotating batch of 60 stalest active games (fits safely in 6-min Apps Script limit)
  var gamesRes = UrlFetchApp.fetch(
    cfg.baseUrl +
      '/rest/v1/games?select=universe_id,root_place_id,name,slug,description,creator_id,creator_type,wiki_subdomain,codes_last_checked_at&active=eq.true&order=codes_last_checked_at.asc.nullsfirst,current_ccu.desc&limit=60',
    {
      method: 'get',
      headers: getSupabaseHeaders_(),
      muteHttpExceptions: true,
    }
  );
  if (gamesRes.getResponseCode() < 200 || gamesRes.getResponseCode() >= 300) {
    return;
  }
  var targets = JSON.parse(gamesRes.getContentText() || '[]');
  if (!targets || targets.length === 0) return;

  var providerList = ['roblox_official_signals', 'fandom_mediawiki_api'];
  if (enabledMap['bloxarchive_api'] && bloxKey && bloxBase) {
    providerList.push('bloxarchive_api');
  }

  var gameHadProviderData = {};
  var resolvedWikiByUid = {};

  for (var pi = 0; pi < providerList.length; pi++) {
    var sourceId = providerList[pi];
    if (!enabledMap[sourceId]) continue;

    var startedAt = new Date().toISOString();
    var startedMs = Date.now();
    var counters = { apiRequests: 0, http429Count: 0 };
    var gamesWithData = 0;
    var codesDiscovered = 0;
    var codesUpdated = 0;
    var codesExpired = 0;
    var errors = [];

    for (var gi = 0; gi < targets.length; gi++) {
      var game = targets[gi];
      var uid = String(game.universe_id);
      var result = null;

      try {
        if (sourceId === 'roblox_official_signals') {
          result = collectRobloxOfficialSignalsGas_(game, counters);
        } else if (sourceId === 'fandom_mediawiki_api') {
          result = collectFandomMediaWikiGas_(game, counters);
          if (result && result.resolvedWikiSubdomain) {
            resolvedWikiByUid[uid] = result.resolvedWikiSubdomain;
          }
          Utilities.sleep(350); // Polite MediaWiki pacing
        } else if (sourceId === 'bloxarchive_api') {
          result = collectBloxArchiveGas_(game, bloxBase, bloxKey, counters);
          Utilities.sleep(250);
        }
      } catch (e) {
        errors.push(uid + ': ' + String(e).slice(0, 120));
        continue;
      }

      if (!result) continue;
      if (result.error) errors.push(result.error);
      if (!result.hasProviderData) continue;

      gamesWithData += 1;
      gameHadProviderData[uid] = true;

      if (result.codes && result.codes.length > 0) {
        var persistStats = upsertGameCodesGas_(uid, sourceId, result.codes);
        codesDiscovered += persistStats.discovered;
        codesUpdated += persistStats.updated;
        codesExpired += persistStats.expired;
      }
    }

    var completedAt = new Date().toISOString();
    var runStatus =
      errors.length > 0 && gamesWithData === 0
        ? 'failed'
        : errors.length > 0
          ? 'partial'
          : 'success';

    supabaseWrite_('code_collection_logs', 'POST', {
      source_id: sourceId,
      triggered_by: 'google_apps_script_codes',
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startedMs,
      games_checked: targets.length,
      games_with_provider_data: gamesWithData,
      codes_discovered: codesDiscovered,
      codes_updated: codesUpdated,
      codes_expired: codesExpired,
      api_requests: counters.apiRequests,
      http_429_count: counters.http429Count,
      status: runStatus,
      error_summary: errors.length ? errors.slice(0, 6).join(' | ').slice(0, 900) : null,
    });

    var prevReq = Number(enabledMap[sourceId].requests_today || 0);
    supabasePatchByFilter_('code_sources?id=eq.' + encodeURIComponent(sourceId), {
      last_run_at: completedAt,
      last_status: runStatus === 'failed' ? 'error' : runStatus === 'partial' ? 'degraded' : 'healthy',
      last_error: errors.length ? errors[0].slice(0, 500) : null,
      consecutive_failures: runStatus === 'failed' ? Number(enabledMap[sourceId].consecutive_failures || 0) + 1 : 0,
      requests_today: prevReq + counters.apiRequests,
      updated_at: completedAt,
    });
  }

  // 3) Update checked games' coverage status, counts, and timestamp
  var nowIso = new Date().toISOString();
  for (var ui = 0; ui < targets.length; ui++) {
    var tGame = targets[ui];
    var tUid = String(tGame.universe_id);
    var countRes = UrlFetchApp.fetch(
      cfg.baseUrl + '/rest/v1/game_codes?select=status&universe_id=eq.' + tUid,
      {
        method: 'get',
        headers: getSupabaseHeaders_(),
        muteHttpExceptions: true,
      }
    );
    var existingCodes =
      countRes.getResponseCode() >= 200 && countRes.getResponseCode() < 300
        ? JSON.parse(countRes.getContentText() || '[]')
        : [];

    var activeCount = 0;
    for (var ci = 0; ci < existingCodes.length; ci++) {
      if (existingCodes[ci].status === 'active') activeCount += 1;
    }
    var totalCount = existingCodes.length;
    var coverageStatus =
      totalCount > 0 || gameHadProviderData[tUid] ? 'covered' : 'no_provider_data';

    var patch = {
      code_coverage_status: coverageStatus,
      active_code_count: activeCount,
      total_code_count: totalCount,
      codes_last_checked_at: nowIso,
      updated_at: nowIso,
    };
    if (resolvedWikiByUid[tUid]) {
      patch.wiki_subdomain = resolvedWikiByUid[tUid];
    }
    supabasePatchByFilter_('games?universe_id=eq.' + tUid, patch);
  }
}

function normalizePromoCodeGas_(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

function isValidPromoCodeGas_(code) {
  if (!code || code.length < 3 || code.length > 48) return false;
  if (!/^[A-Za-z0-9_!@#$%&*+?-]+(?: [A-Za-z0-9_!@#$%&*+?-]+)*$/.test(code)) return false;
  var upper = code.toUpperCase();
  var stop = {
    CODE: 1, CODES: 1, ACTIVE: 1, EXPIRED: 1, WORKING: 1, REWARD: 1,
    REWARDS: 1, FREE: 1, NEW: 1, UPDATE: 1, ROBLOX: 1, GAME: 1,
    HTTPS: 1, HTTP: 1, NONE: 1, TBA: 1, TBD: 1, COMING: 1, SOON: 1,
    LIKE: 1, LIKES: 1, GOAL: 1, NEXT: 1, GROUP: 1, DISCORD: 1,
  };
  return !stop[upper];
}

function extractCodesFromTextGas_(text, sourceUrl) {
  if (!text) return [];
  var seen = {};
  var out = [];
  var patterns = [
    /(?:use\s+)?code\s*[:=\-–]\s*["'`*]?([A-Za-z0-9_!@#$%&*-]{3,32})["'`*]?(?:\s*[-–(:]\s*([^\n\r)]{3,120}))?/gi,
    /new\s+code\s+(?:at\s+[\d,kKmM]+\s+likes\s*[:\-]\s*)?["'`]([A-Za-z0-9_!@#$%&*-]{3,32})["'`]/gi,
  ];
  for (var p = 0; p < patterns.length; p++) {
    var re = patterns[p];
    var m;
    while ((m = re.exec(text)) !== null) {
      var rawCode = String(m[1] || '').trim();
      var norm = normalizePromoCodeGas_(rawCode);
      if (!isValidPromoCodeGas_(rawCode) || seen[norm]) continue;
      seen[norm] = true;
      var reward = m[2] ? String(m[2]).replace(/\s+/g, ' ').trim().slice(0, 180) : null;
      out.push({
        code: rawCode,
        rewardDescription: reward,
        status: 'unverified',
        sourceReportedStatus: 'announced_in_official_text',
        sourceUrl: sourceUrl,
        expiresAt: null,
      });
    }
  }
  return out;
}

function collectRobloxOfficialSignalsGas_(game, counters) {
  var placeUrl = 'https://www.roblox.com/games/' + (game.root_place_id || game.universe_id);
  var found = extractCodesFromTextGas_(game.description || '', placeUrl);

  if (game.creator_type === 'Group' && game.creator_id) {
    var groupData = fetchJsonSafe_(
      'https://groups.roblox.com/v1/groups/' + game.creator_id,
      counters
    );
    var shoutBody = groupData && groupData.shout && groupData.shout.body;
    if (shoutBody) {
      var groupUrl = 'https://www.roblox.com/groups/' + game.creator_id;
      var shoutCodes = extractCodesFromTextGas_(shoutBody, groupUrl);
      var seen = {};
      for (var i = 0; i < found.length; i++) seen[normalizePromoCodeGas_(found[i].code)] = true;
      for (var j = 0; j < shoutCodes.length; j++) {
        var norm = normalizePromoCodeGas_(shoutCodes[j].code);
        if (!seen[norm]) {
          seen[norm] = true;
          found.push(shoutCodes[j]);
        }
      }
    }
  }

  return {
    hasProviderData: found.length > 0,
    codes: found,
  };
}

function collectFandomMediaWikiGas_(game, counters) {
  var uid = String(game.universe_id);
  var candidates = [];
  if (game.wiki_subdomain) candidates.push(game.wiki_subdomain);
  if (CURATED_WIKI_MAP[uid] && candidates.indexOf(CURATED_WIKI_MAP[uid]) === -1) {
    candidates.push(CURATED_WIKI_MAP[uid]);
  }
  var slugBase = slugify_(game.name).replace(/-simulator$/, '-simulator');
  if (slugBase && slugBase.length >= 4 && candidates.indexOf(slugBase) === -1) {
    candidates.push(slugBase);
  }

  for (var i = 0; i < Math.min(2, candidates.length); i++) {
    var sub = candidates[i];
    if (!/^[a-z0-9-]{2,64}$/.test(sub)) continue;
    var apiUrl =
      'https://' +
      sub +
      '.fandom.com/api.php?action=parse&page=Codes&prop=wikitext&format=json&redirects=1';
    var data = fetchJsonSafe_(apiUrl, counters);
    var wikitext = data && data.parse && data.parse.wikitext && data.parse.wikitext['*'];
    if (!wikitext || wikitext.length < 30) continue;

    var wikiPageUrl = 'https://' + sub + '.fandom.com/wiki/Codes';
    var parsedCodes = parseMediaWikiCodesGas_(wikitext, wikiPageUrl);
    if (parsedCodes.length > 0) {
      return {
        hasProviderData: true,
        codes: parsedCodes,
        resolvedWikiSubdomain: sub,
      };
    }
  }

  return { hasProviderData: false, codes: [] };
}

function parseMediaWikiCodesGas_(wikitext, sourceUrl) {
  var lines = String(wikitext).split(/\r?\n/);
  var sectionStatus = 'unverified';
  var seen = {};
  var out = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    if (/^==+.*==+$/.test(line)) {
      var h = line.toLowerCase();
      if (h.indexOf('expired') !== -1 || h.indexOf('inactive') !== -1 || h.indexOf('old') !== -1) {
        sectionStatus = 'expired';
      } else if (h.indexOf('active') !== -1 || h.indexOf('working') !== -1 || h.indexOf('current') !== -1) {
        sectionStatus = 'active';
      } else {
        sectionStatus = 'unverified';
      }
      continue;
    }

    // Wikitext table row: | Code || Reward || Status
    if (line.indexOf('|') === 0 && line.indexOf('|-') !== 0 && line.indexOf('|}') !== 0 && line.indexOf('{|') !== 0) {
      var cells = line.replace(/^\|+/, '').split('||');
      if (cells.length >= 2) {
        var c0 = cleanWikiCellGas_(cells[0]);
        var c1 = cleanWikiCellGas_(cells[1]);
        var c2 = cells[2] ? cleanWikiCellGas_(cells[2]).toLowerCase() : '';
        var rowStatus = sectionStatus;
        if (c2.indexOf('expired') !== -1 || c2.indexOf('inactive') !== -1) rowStatus = 'expired';
        else if (c2.indexOf('active') !== -1 || c2.indexOf('working') !== -1) rowStatus = 'active';
        var norm = normalizePromoCodeGas_(c0);
        if (isValidPromoCodeGas_(c0) && !seen[norm]) {
          seen[norm] = true;
          out.push({
            code: c0,
            rewardDescription: c1 && c1.length >= 2 ? c1.slice(0, 220) : null,
            status: rowStatus,
            sourceReportedStatus: c2 || ('wiki_section:' + sectionStatus),
            sourceUrl: sourceUrl,
            expiresAt: null,
          });
        }
      }
      continue;
    }

    // Bullet item: * '''CODE''' - Reward
    if (line.indexOf('*') === 0) {
      var bm = line.match(/^\*+\s*(?:'''|<code>|<b>)?([A-Za-z0-9_!@#$%&*-]{3,32})(?:'''|<\/code>|<\/b>)?\s*[:\-–—]\s*(.+)$/);
      if (bm) {
        var bCode = bm[1].trim();
        var bNorm = normalizePromoCodeGas_(bCode);
        var bReward = cleanWikiCellGas_(bm[2]).slice(0, 220);
        if (isValidPromoCodeGas_(bCode) && !seen[bNorm]) {
          seen[bNorm] = true;
          out.push({
            code: bCode,
            rewardDescription: bReward || null,
            status: sectionStatus,
            sourceReportedStatus: 'wiki_list:' + sectionStatus,
            sourceUrl: sourceUrl,
            expiresAt: null,
          });
        }
      }
    }
  }

  return out.slice(0, 80);
}

function cleanWikiCellGas_(raw) {
  return String(raw || '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/'''|''|<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBloxArchiveSlugCandidatesGas_(game) {
  var seen = {};
  var out = [];
  function addSlug(raw) {
    if (!raw) return;
    var s = slugify_(raw);
    if (!s || s === 'experience') return;
    var withCodes = s.slice(-6) === '-codes' ? s : s + '-codes';
    if (!seen[withCodes]) {
      seen[withCodes] = true;
      out.push(withCodes);
    }
    var base = s.slice(-6) === '-codes' ? s.slice(0, -6) : s;
    if (base && !seen[base]) {
      seen[base] = true;
      out.push(base);
    }
  }

  var strippedName = String(game.name || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  addSlug(game.slug);
  addSlug(strippedName);
  addSlug(game.name);
  return out.slice(0, 4);
}

function collectBloxArchiveGas_(game, baseUrl, apiKey, counters) {
  var candidates = buildBloxArchiveSlugCandidatesGas_(game);
  if (candidates.length === 0) return { hasProviderData: false, codes: [] };

  var payload = null;
  var matchedSlug = candidates[0];

  for (var ci = 0; ci < candidates.length; ci++) {
    var candidateSlug = candidates[ci];
    var url =
      baseUrl +
      '/games/' +
      encodeURIComponent(candidateSlug) +
      '?locale=en';
    counters.apiRequests += 1;
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
        'User-Agent': 'RoMetricSidecar/1.0',
      },
      muteHttpExceptions: true,
    });
    var statusCode = res.getResponseCode();
    if (statusCode === 429) {
      counters.http429Count += 1;
      break;
    }
    if (statusCode >= 200 && statusCode < 300) {
      payload = JSON.parse(res.getContentText() || '{}');
      matchedSlug = candidateSlug;
      break;
    }
  }

  if (!payload) return { hasProviderData: false, codes: [] };

  var attributionUrl =
    payload.url ||
    payload.pageUrl ||
    (payload.game && (payload.game.url || payload.game.pageUrl)) ||
    'https://bloxarchive.com/' + encodeURIComponent(matchedSlug);

  // BloxArchive Partner API v1 returns either an array OR { active: [], pending: [], expired: [] }
  var rawItems = [];
  function pushBucket(arr, forcedStatus) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      rawItems.push({ item: arr[i], forcedStatus: forcedStatus });
    }
  }

  var codesNode = payload.codes || (payload.data && payload.data.codes) || null;
  if (Array.isArray(codesNode)) {
    pushBucket(codesNode, null);
  } else if (codesNode && typeof codesNode === 'object') {
    pushBucket(codesNode.active, 'active');
    pushBucket(codesNode.working, 'active');
    pushBucket(codesNode.pending, 'unverified');
    pushBucket(codesNode.expired, 'expired');
  }
  pushBucket(payload.active_codes || payload.active, 'active');
  pushBucket(payload.expired_codes || payload.expired, 'expired');

  var seenCodes = {};
  var out = [];
  for (var j = 0; j < rawItems.length; j++) {
    var entry = rawItems[j];
    var item = entry.item;
    if (!item) continue;
    var c =
      typeof item === 'string'
        ? item.trim()
        : String(item.code || item.value || item.name || '').trim();
    if (!isValidPromoCodeGas_(c)) continue;
    var norm = c.replace(/\s+/g, '').toUpperCase();
    if (seenCodes[norm]) continue;
    seenCodes[norm] = true;

    var st = entry.forcedStatus
      ? entry.forcedStatus
      : String(
          item.status ||
            (item.expired ? 'expired' : item.verified ? 'active' : 'active')
        ).toLowerCase();
    var mapped =
      st === 'active' || st === 'working' || st === 'confirmed' || st === 'verified'
        ? 'active'
        : st === 'expired' || st === 'inactive'
          ? 'expired'
          : 'unverified';
    out.push({
      code: c,
      rewardDescription:
        typeof item === 'object' && (item.reward || item.rewards || item.description)
          ? String(item.reward || item.rewards || item.description).slice(0, 220)
          : null,
      status: mapped,
      sourceReportedStatus: st || 'active',
      sourceUrl: attributionUrl,
      expiresAt:
        typeof item === 'object' ? item.expiresAt || item.expires_at || null : null,
    });
  }
  return { hasProviderData: out.length > 0, codes: out };
}

function upsertGameCodesGas_(universeId, sourceId, discoveredCodes) {
  var cfg = getSupabaseConfig_();
  var stats = { discovered: 0, updated: 0, expired: 0 };
  var nowIso = new Date().toISOString();

  var existingRes = UrlFetchApp.fetch(
    cfg.baseUrl +
      '/rest/v1/game_codes?select=id,normalized_code,status,reward_description,admin_locked&universe_id=eq.' +
      universeId,
    {
      method: 'get',
      headers: getSupabaseHeaders_(),
      muteHttpExceptions: true,
    }
  );
  var existingRows =
    existingRes.getResponseCode() >= 200 && existingRes.getResponseCode() < 300
      ? JSON.parse(existingRes.getContentText() || '[]')
      : [];

  var existingMap = {};
  for (var i = 0; i < existingRows.length; i++) {
    existingMap[existingRows[i].normalized_code] = existingRows[i];
  }

  var toUpsert = [];
  var verLogs = [];

  for (var j = 0; j < discoveredCodes.length; j++) {
    var item = discoveredCodes[j];
    var norm = normalizePromoCodeGas_(item.code);
    var prev = existingMap[norm];

    if (prev && prev.admin_locked) continue;

    if (!prev) {
      stats.discovered += 1;
      toUpsert.push({
        universe_id: Number(universeId),
        code: item.code,
        normalized_code: norm,
        reward_description: item.rewardDescription,
        status: item.status,
        source_id: sourceId,
        source_url: item.sourceUrl,
        source_reported_status: item.sourceReportedStatus,
        discovered_at: nowIso,
        last_verified_at: nowIso,
        expires_at: item.expiresAt,
        updated_at: nowIso,
      });
      verLogs.push({
        universe_id: Number(universeId),
        code_text: item.code,
        previous_status: null,
        new_status: item.status,
        actor: 'apps_script:' + sourceId,
        reason: 'Discovered by scheduled sidecar collection',
        verified_at: nowIso,
      });
    } else {
      var statusChanged = prev.status !== item.status;
      var rewardChanged = Boolean(item.rewardDescription) && prev.reward_description !== item.rewardDescription;
      if (statusChanged || rewardChanged) {
        stats.updated += 1;
        if (statusChanged && item.status === 'expired') stats.expired += 1;
        toUpsert.push({
          universe_id: Number(universeId),
          code: item.code,
          normalized_code: norm,
          reward_description: item.rewardDescription || prev.reward_description,
          status: item.status,
          source_id: sourceId,
          source_url: item.sourceUrl,
          source_reported_status: item.sourceReportedStatus,
          last_verified_at: nowIso,
          expires_at: item.expiresAt,
          updated_at: nowIso,
        });
        if (statusChanged) {
          verLogs.push({
            code_id: prev.id,
            universe_id: Number(universeId),
            code_text: item.code,
            previous_status: prev.status,
            new_status: item.status,
            actor: 'apps_script:' + sourceId,
            reason: 'Status refreshed by scheduled sidecar collection',
            verified_at: nowIso,
          });
        }
      }
    }
  }

  if (toUpsert.length > 0) {
    supabaseWrite_(
      'game_codes?on_conflict=universe_id,normalized_code',
      'POST',
      toUpsert,
      'resolution=merge-duplicates'
    );
  }
  if (verLogs.length > 0) {
    supabaseWrite_('code_verification_logs', 'POST', verLogs);
  }

  return stats;
}

/* ============================================================================
 * INTERNAL HELPERS (Supabase REST, Parallel UrlFetchApp, Drive Folders)
 * ============================================================================ */

function getSupabaseConfig_() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = (props.getProperty('SUPABASE_URL') || '').trim().replace(/\/+$/, '');
  var key = (props.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!baseUrl || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Script Properties.'
    );
  }
  return { baseUrl: baseUrl, key: key, isJwt: key.indexOf('eyJ') === 0 };
}

function getSupabaseHeaders_(prefer) {
  var cfg = getSupabaseConfig_();
  var headers = {
    apikey: cfg.key,
    'Content-Type': 'application/json',
  };
  if (cfg.isJwt) {
    headers.Authorization = 'Bearer ' + cfg.key;
  }
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
}

function fetchPaginatedSupabase_(baseQuery, maxPages) {
  var cfg = getSupabaseConfig_();
  var headers = getSupabaseHeaders_();
  var all = [];
  var pageSize = 1000;
  for (var p = 0; p < maxPages; p++) {
    var url =
      cfg.baseUrl +
      '/rest/v1/' +
      baseQuery +
      '&limit=' +
      pageSize +
      '&offset=' +
      p * pageSize;
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) break;
    var rows = JSON.parse(res.getContentText() || '[]');
    if (!rows || rows.length === 0) break;
    for (var i = 0; i < rows.length; i++) all.push(rows[i]);
    if (rows.length < pageSize) break;
  }
  return all;
}

function fetchAllSupabaseGames_(selectCols, extraFilter) {
  return fetchPaginatedSupabase_(
    'games?select=' + selectCols + (extraFilter || '') + '&order=current_ccu.desc',
    4
  );
}

function supabaseWrite_(path, method, bodyObj, prefer) {
  var cfg = getSupabaseConfig_();
  var res = UrlFetchApp.fetch(cfg.baseUrl + '/rest/v1/' + path, {
    method: method.toLowerCase(),
    headers: getSupabaseHeaders_(prefer),
    payload: JSON.stringify(bodyObj),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  return code >= 200 && code < 300;
}

function supabasePatchByFilter_(path, patchObj) {
  var cfg = getSupabaseConfig_();
  UrlFetchApp.fetch(cfg.baseUrl + '/rest/v1/' + path, {
    method: 'patch',
    headers: getSupabaseHeaders_(),
    payload: JSON.stringify(patchObj),
    muteHttpExceptions: true,
  });
}

function logCollectionJob_(job) {
  supabaseWrite_('collection_jobs', 'POST', {
    tier: job.tier,
    triggered_by: job.triggered_by,
    started_at: job.started_at,
    completed_at: new Date().toISOString(),
    duration_ms: job.duration_ms,
    games_attempted: job.games_attempted,
    games_succeeded: job.games_succeeded,
    games_failed: job.games_failed,
    api_requests: job.api_requests,
    http_429_count: job.http_429_count,
    status: job.status,
    error_summary: job.error_summary,
  });
}

function fetchJsonSafe_(url, counters) {
  counters.apiRequests += 1;
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Accept: 'application/json', 'User-Agent': 'RoMetricSidecar/1.0' },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code === 429) {
    counters.http429Count += 1;
    Utilities.sleep(1000);
    counters.apiRequests += 1;
    res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Accept: 'application/json', 'User-Agent': 'RoMetricSidecar/1.0' },
      muteHttpExceptions: true,
    });
    code = res.getResponseCode();
  }
  if (code < 200 || code >= 300) return null;
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    return null;
  }
}

function fetchAllJsonSafe_(urls, counters) {
  if (!urls || urls.length === 0) return [];
  counters.apiRequests += urls.length;
  var requests = urls.map(function (u) {
    return {
      url: u,
      method: 'get',
      headers: { Accept: 'application/json', 'User-Agent': 'RoMetricSidecar/1.0' },
      muteHttpExceptions: true,
    };
  });
  var responses = UrlFetchApp.fetchAll(requests);
  var out = [];
  for (var i = 0; i < responses.length; i++) {
    var code = responses[i].getResponseCode();
    if (code === 429) counters.http429Count += 1;
    if (code >= 200 && code < 300) {
      try {
        out.push(JSON.parse(responses[i].getContentText()));
      } catch (e) {
        out.push(null);
      }
    } else {
      out.push(null);
    }
  }
  return out;
}

function chunkArray_(arr, size) {
  var res = [];
  for (var i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

function slugify_(input) {
  var cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || 'experience';
}

function getOrCreateFolderPath_(segments) {
  var parent = DriveApp.getRootFolder();
  for (var i = 0; i < segments.length; i++) {
    var name = segments[i];
    var iter = parent.getFoldersByName(name);
    parent = iter.hasNext() ? iter.next() : parent.createFolder(name);
  }
  return parent;
}

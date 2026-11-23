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
 * ----------------------------------------------------------------------------
 * ONE-TIME SETUP (2 minutes):
 *   1. Open https://script.google.com -> Click "New project" -> Name it "RoMetric Sidecar".
 *   2. Paste this entire file into Code.gs and Save.
 *   3. Go to Project Settings (gear icon) -> Script Properties -> Add 2 properties:
 *        - SUPABASE_URL              = https://YOUR_PROJECT_REF.supabase.co
 *        - SUPABASE_SERVICE_ROLE_KEY = your_supabase_service_role_or_secret_key
 *   4. Return to Editor, select `setupRoMetricSidecar` in the top toolbar, and click Run.
 *      Approve Google Drive + External Request permissions once.
 *   5. Done! (Optionally run `runDiscoveryAndHygiene` once manually to immediately
 *      expand your catalog toward 1,000–3,000 active games.)
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
      fn === 'runNightlyDriveArchive'
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

  Logger.log(
    'RoMetric Sidecar configured for ' + cfg.baseUrl + '. Triggers registered.'
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

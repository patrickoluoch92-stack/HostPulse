/* eslint-disable no-console */
const { PrismaClient, HospitalityCategory } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

dotenv.config();

const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const COUNTY_OSM_IDS_URL =
  'https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/osm-ids.json';
const COUNTY_COORDS_BASE =
  'https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/coordinates';

const BASE_USER_AGENT = 'HostPulseHospitalitySync/1.0 (contact: dev@hostpulse.local)';

const REQUIRED_MINIMUM_FIELDS = ['name', 'county', 'category'];

const CATEGORY_BY_TAG = [
  { match: /resort/i, category: HospitalityCategory.RESORT },
  { match: /lodge/i, category: HospitalityCategory.LODGE },
  { match: /guest[\s-]?house/i, category: HospitalityCategory.GUEST_HOUSE },
  { match: /apartment|serviced/i, category: HospitalityCategory.SERVICED_APARTMENT },
  { match: /airbnb/i, category: HospitalityCategory.AIRBNB },
  { match: /safari/i, category: HospitalityCategory.SAFARI_OPERATOR },
  { match: /tour|travel/i, category: HospitalityCategory.TOURS_TRAVEL },
  { match: /hotel/i, category: HospitalityCategory.HOTEL },
];

const COUNTY_ALIASES = {
  "Murang'a": 'Muranga',
  'Homa Bay': 'Homabay',
  'Elgeyo-Marakwet': 'Elgeyo-Marakwet',
  'Taita Taveta': 'Taita Taveta',
  'Tana River': 'Tana River',
  'Tharaka Nithi': 'Tharaka Nithi',
  'Trans Nzoia': 'Trans Nzoia',
  'Uasin Gishu': 'Uasin Gishu',
  'West Pokot': 'West Pokot',
};

const COUNTY_COORDINATE_SLUGS = {
  "Murang'a": 'muranga',
  'Homa Bay': 'homabay',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCounty(value) {
  if (!value) {
    return '';
  }
  const cleaned = value.replace(/\s+county$/i, '').trim();
  for (const [canonical, alias] of Object.entries(COUNTY_ALIASES)) {
    if (normalizeText(cleaned) === normalizeText(canonical) || normalizeText(cleaned) === normalizeText(alias)) {
      return canonical;
    }
  }
  return cleaned
    .split(' ')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

function parseCoord(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const pointMatch = value.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!pointMatch) {
    return null;
  }
  const lng = Number(pointMatch[1]);
  const lat = Number(pointMatch[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

function inferCategory(name, tourismTag, extraTags) {
  const combined = [name, tourismTag, extraTags].filter(Boolean).join(' ');
  if (/guest[\s-]?house/i.test(combined)) {
    return HospitalityCategory.GUEST_HOUSE;
  }
  if (/hotel|motel/i.test(combined)) {
    return HospitalityCategory.HOTEL;
  }
  if (/resort|spa/i.test(combined)) {
    return HospitalityCategory.RESORT;
  }
  if (/lodge|camp/i.test(combined)) {
    return HospitalityCategory.LODGE;
  }
  if (/serviced|apartment|suite/i.test(combined)) {
    return HospitalityCategory.SERVICED_APARTMENT;
  }
  if (/airbnb|bnb|bed and breakfast/i.test(combined)) {
    return HospitalityCategory.AIRBNB;
  }
  if (/safari/i.test(combined)) {
    return HospitalityCategory.SAFARI_OPERATOR;
  }
  if (/travel|tour|agency|operator/i.test(combined)) {
    return HospitalityCategory.TOURS_TRAVEL;
  }
  for (const rule of CATEGORY_BY_TAG) {
    if (rule.match.test(combined)) {
      return rule.category;
    }
  }
  if (/camp/i.test(combined)) {
    return HospitalityCategory.LODGE;
  }
  if (/travel|tour/i.test(combined)) {
    return HospitalityCategory.TOURS_TRAVEL;
  }
  return HospitalityCategory.HOTEL;
}

function toSourceRef(source, rawId) {
  if (!rawId) {
    return null;
  }
  return `${source}:${rawId}`;
}

function computeDedupeKey(input) {
  const base = [
    normalizeText(input.name),
    normalizeCounty(input.county),
    normalizeText(input.phone || ''),
    normalizeText(input.website || ''),
  ].join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function qualityScoreFor(record) {
  let score = 0;
  if (record.phone) score += 2;
  if (record.email) score += 2;
  if (record.website) score += 2;
  if (record.bookingLink) score += 1;
  if (record.latitude && record.longitude) score += 2;
  if (record.description) score += 1;
  if (record.source === 'overpass') score += 2;
  if (record.source === 'wikidata') score += 1;
  return score;
}

function isValidRecord(record) {
  for (const field of REQUIRED_MINIMUM_FIELDS) {
    if (!record[field]) {
      return false;
    }
  }
  if (record.name.length < 3) {
    return false;
  }
  if (
    normalizeText(record.name) === normalizeText(record.county) ||
    /\bcounty\b/i.test(record.name)
  ) {
    return false;
  }
  if (record.source === 'wikidata') {
    const hasHospitalityWord =
      /hotel|resort|lodge|guest|apartment|airbnb|travel|tour|safari|camp/i.test(record.name) ||
      /hotel|resort|lodge|guest|apartment|travel|tour|safari/i.test(record.description || '');
    if (!hasHospitalityWord) {
      return false;
    }
  }
  if (!record.phone && !record.email && !record.website && !record.bookingLink) {
    return false;
  }
  return true;
}

function sanitizePhone(value) {
  if (!value) {
    return null;
  }
  const compact = String(value).replace(/[^\d+]/g, '');
  if (compact.length < 9) {
    return null;
  }
  return compact;
}

function sanitizeEmail(value) {
  if (!value) {
    return null;
  }
  const email = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function sanitizeUrl(value) {
  if (!value) {
    return null;
  }
  let url = String(value).trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'user-agent': BASE_USER_AGENT,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'user-agent': BASE_USER_AGENT,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.text();
}

async function loadCountyMeta() {
  const [osmIds, counties] = await Promise.all([
    fetchJson(COUNTY_OSM_IDS_URL),
    fetchJson('https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/counties.json'),
  ]);

  const byName = new Map();
  for (const county of counties) {
    const countyName = normalizeCounty(county.name);
    byName.set(normalizeText(countyName), {
      name: countyName,
      capital: county.capital || null,
      code: county.code || null,
      relationId: null,
      center: null,
    });
  }

  for (const osm of osmIds) {
    const key = normalizeText(normalizeCounty(osm.name));
    const existing = byName.get(key);
    if (existing) {
      existing.relationId = osm.osm_id;
    } else {
      byName.set(key, {
        name: normalizeCounty(osm.name),
        capital: null,
        code: null,
        relationId: osm.osm_id,
        center: null,
      });
    }
  }

  const finalCounties = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  await Promise.all(
    finalCounties.map(async (county) => {
      const slug =
        COUNTY_COORDINATE_SLUGS[county.name] ?? normalizeText(county.name).replace(/\s+/g, '-');
      try {
        const coords = await fetchJson(`${COUNTY_COORDS_BASE}/${slug}.json`);
        if (Array.isArray(coords.center) && coords.center.length === 2) {
          county.center = { longitude: Number(coords.center[0]), latitude: Number(coords.center[1]) };
        }
      } catch {
        county.center = null;
      }
    }),
  );

  if (finalCounties.length !== 47) {
    throw new Error(`Expected 47 counties but resolved ${finalCounties.length}`);
  }

  return finalCounties;
}

function buildOverpassQuery(relationId) {
  const areaId = 3600000000 + Number(relationId);
  return `
[out:json][timeout:120];
area(${areaId})->.searchArea;
(
  node["tourism"~"hotel|guest_house|hostel|resort|apartment|camp_site|motel"](area.searchArea);
  way["tourism"~"hotel|guest_house|hostel|resort|apartment|camp_site|motel"](area.searchArea);
  relation["tourism"~"hotel|guest_house|hostel|resort|apartment|camp_site|motel"](area.searchArea);
  node["office"~"travel_agent|tourism"](area.searchArea);
  way["office"~"travel_agent|tourism"](area.searchArea);
  relation["office"~"travel_agent|tourism"](area.searchArea);
  node["shop"="travel_agency"](area.searchArea);
  way["shop"="travel_agency"](area.searchArea);
  relation["shop"="travel_agency"](area.searchArea);
);
out tags center qt;
`;
}

function buildOverpassRadiusQuery(county) {
  if (!county.center) {
    return null;
  }
  return `
[out:json][timeout:90];
(
  node["tourism"~"hotel|guest_house|hostel|resort|apartment|camp_site|motel"](around:130000,${county.center.latitude},${county.center.longitude});
  way["tourism"~"hotel|guest_house|hostel|resort|apartment|camp_site|motel"](around:130000,${county.center.latitude},${county.center.longitude});
  node["office"~"travel_agent|tourism"](around:130000,${county.center.latitude},${county.center.longitude});
  way["office"~"travel_agent|tourism"](around:130000,${county.center.latitude},${county.center.longitude});
  node["shop"="travel_agency"](around:130000,${county.center.latitude},${county.center.longitude});
  way["shop"="travel_agency"](around:130000,${county.center.latitude},${county.center.longitude});
);
out tags center qt;
`;
}

async function queryOverpassForCounty(county) {
  if (!county.relationId || process.env.SKIP_OVERPASS === '1') {
    return [];
  }
  const query = buildOverpassQuery(county.relationId);
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const payload = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      return Array.isArray(payload.elements) ? payload.elements : [];
    } catch (error) {
      console.warn(`[sync] Overpass failed for ${county.name} via ${endpoint}: ${error.message}`);
    }
  }
  return [];
}

function mapOverpassElement(county, element) {
  const tags = element.tags || {};
  const name = tags.name || tags['name:en'] || null;
  if (!name) {
    return null;
  }
  const lat = element.lat ?? element.center?.lat ?? null;
  const lng = element.lon ?? element.center?.lon ?? null;
  const website = sanitizeUrl(tags.website || tags['contact:website'] || tags.url || null);
  const bookingLink = sanitizeUrl(tags.booking || tags['booking:url'] || null);
  const phone = sanitizePhone(tags.phone || tags['contact:phone'] || tags.mobile || null);
  const email = sanitizeEmail(tags.email || tags['contact:email'] || null);
  const amenities = [];
  if (tags.internet_access && tags.internet_access !== 'no') amenities.push('internet');
  if (tags['swimming_pool'] && tags['swimming_pool'] !== 'no') amenities.push('swimming_pool');
  if (tags.parking && tags.parking !== 'no') amenities.push('parking');
  if (tags.restaurant && tags.restaurant !== 'no') amenities.push('restaurant');
  if (tags['air_conditioning'] && tags['air_conditioning'] !== 'no') amenities.push('air_conditioning');

  const category = inferCategory(name, tags.tourism || tags.office || tags.shop, JSON.stringify(tags));
  const town = tags['addr:city'] || tags.city || county.capital || null;
  const area = tags['addr:suburb'] || tags['addr:district'] || tags.neighbourhood || null;
  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:postcode'],
    tags['addr:city'],
  ].filter(Boolean);
  const address = addressParts.length ? addressParts.join(', ') : null;
  const description = tags.description || tags['description:en'] || tags['operator:type'] || null;

  const record = {
    name: name.trim(),
    normalizedName: normalizeText(name),
    category,
    county: county.name,
    town,
    area,
    address,
    phone,
    email,
    website,
    bookingLink,
    latitude: lat,
    longitude: lng,
    description,
    amenities,
    source: 'overpass',
    sourceRef: toSourceRef('osm', `${element.type}/${element.id}`),
    metadata: {
      osmType: element.type,
      osmId: element.id,
      tags,
    },
    lastSeenAt: new Date(),
  };

  return record;
}

async function queryWikidataForCounty(county) {
  const coordFilter = county.center
    ? `SERVICE wikibase:around {
      ?item wdt:P625 ?location .
      bd:serviceParam wikibase:center "Point(${county.center.longitude} ${county.center.latitude})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "80" .
      bd:serviceParam wikibase:distance ?distance .
    }`
    : '?item wdt:P625 ?location .';

  const query = `
SELECT ?item ?itemLabel ?instanceLabel ?location ?website ?email ?phone WHERE {
  VALUES ?instance {
    wd:Q27686
    wd:Q188600
    wd:Q167270
    wd:Q10542
  }
  ?item wdt:P31/wdt:P279* ?instance .
  ?item wdt:P17 wd:Q114 .
  ${coordFilter}
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P968 ?email . }
  OPTIONAL { ?item wdt:P1329 ?phone . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 400`;

  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  try {
    const data = await fetchJson(url);
    return data.results?.bindings || [];
  } catch (error) {
    console.warn(`[sync] Wikidata failed for ${county.name}: ${error.message}`);
    return [];
  }
}

async function queryWikidataCountyAdmin(county) {
  const escapedCounty = county.name.replace(/"/g, '\\"');
  const query = `
SELECT ?item ?itemLabel ?instanceLabel ?location ?website ?email ?phone WHERE {
  VALUES ?instance {
    wd:Q27686
    wd:Q188600
    wd:Q167270
    wd:Q10542
  }
  ?item wdt:P31/wdt:P279* ?instance .
  ?item wdt:P131* ?admin .
  ?admin rdfs:label ?adminLabel .
  FILTER(LANG(?adminLabel) = "en")
  FILTER(
    LCASE(REPLACE(?adminLabel, " county$", "")) = LCASE("${escapedCounty}")
  )
  OPTIONAL { ?item wdt:P625 ?location . }
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P968 ?email . }
  OPTIONAL { ?item wdt:P1329 ?phone . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 250`;

  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  try {
    const data = await fetchJson(url);
    return data.results?.bindings || [];
  } catch (error) {
    console.warn(`[sync] Wikidata-admin failed for ${county.name}: ${error.message}`);
    return [];
  }
}

function mapWikidataRow(county, row) {
  const name = row.itemLabel?.value;
  if (!name) {
    return null;
  }
  const coords = parseCoord(row.location?.value || null);
  const website = sanitizeUrl(row.website?.value || null);
  const email = sanitizeEmail(row.email?.value || null);
  const phone = sanitizePhone(row.phone?.value || null);

  const category = inferCategory(name, row.instanceLabel?.value || '', '');
  return {
    name: name.trim(),
    normalizedName: normalizeText(name),
    category,
    county: county.name,
    town: county.capital || null,
    area: null,
    address: null,
    phone,
    email,
    website,
    bookingLink: null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    description: row.instanceLabel?.value
      ? `${row.instanceLabel.value} in ${county.name}`
      : null,
    amenities: [],
    source: 'wikidata',
    sourceRef: row.item?.value || null,
    metadata: {
      item: row.item?.value || null,
      instance: row.instanceLabel?.value || null,
    },
    lastSeenAt: new Date(),
  };
}

function hydrateRecord(record) {
  const county = normalizeCounty(record.county);
  const normalizedName = normalizeText(record.name);
  const dedupeKey = computeDedupeKey({
    name: record.name,
    county,
    phone: record.phone,
    website: record.website || record.bookingLink,
  });
  const qualityScore = qualityScoreFor(record);
  return {
    ...record,
    county,
    normalizedName,
    dedupeKey,
    qualityScore,
    isVerified: qualityScore >= 6,
    isActive: true,
  };
}

function mergeCandidates(records) {
  const map = new Map();
  const sourceRefMap = new Map();
  for (const raw of records) {
    if (!raw) continue;
    const candidate = hydrateRecord(raw);
    if (!isValidRecord(candidate)) {
      continue;
    }
    const mapKey =
      candidate.sourceRef && sourceRefMap.has(candidate.sourceRef)
        ? sourceRefMap.get(candidate.sourceRef)
        : candidate.dedupeKey;
    const existing = map.get(mapKey);
    if (!existing || candidate.qualityScore > existing.qualityScore) {
      map.set(mapKey, candidate);
      if (candidate.sourceRef) {
        sourceRefMap.set(candidate.sourceRef, mapKey);
      }
      continue;
    }
    const merged = {
      ...existing,
      phone: existing.phone || candidate.phone,
      email: existing.email || candidate.email,
      website: existing.website || candidate.website,
      bookingLink: existing.bookingLink || candidate.bookingLink,
      description: existing.description || candidate.description,
      amenities: [...new Set([...(existing.amenities || []), ...(candidate.amenities || [])])],
      qualityScore: Math.max(existing.qualityScore, candidate.qualityScore),
      isVerified: existing.isVerified || candidate.isVerified,
      metadata: {
        ...existing.metadata,
        mergedSources: [...new Set([existing.source, candidate.source])],
      },
    };
    map.set(mapKey, merged);
    if (candidate.sourceRef) {
      sourceRefMap.set(candidate.sourceRef, mapKey);
    }
  }
  return [...map.values()];
}

async function loadExistingDedupe(prisma) {
  const [existing, existingProperties] = await Promise.all([
    prisma.hospitalityBusiness.findMany({
      select: {
        dedupeKey: true,
        normalizedName: true,
        county: true,
        phone: true,
        website: true,
        bookingLink: true,
      },
    }),
    prisma.property.findMany({
      select: {
        name: true,
        location: true,
      },
    }),
  ]);

  const propertySoftKeys = existingProperties.map((item) => {
    const locationObject =
      item.location && typeof item.location === 'object' && !Array.isArray(item.location)
        ? item.location
        : {};
    const countyValue =
      typeof locationObject.county === 'string'
        ? locationObject.county
        : typeof locationObject.area === 'string'
          ? locationObject.area
          : 'kenya';
    return [normalizeText(item.name), normalizeText(countyValue), '', ''].join('|');
  });

  return {
    dedupeKeys: new Set(existing.map((item) => item.dedupeKey)),
    softKeys: new Set(
      [
        ...existing.map((item) =>
          [
            item.normalizedName,
            normalizeText(item.county),
            normalizeText(item.phone || ''),
            normalizeText(item.website || item.bookingLink || ''),
          ].join('|'),
        ),
        ...propertySoftKeys,
      ],
    ),
  };
}

function hasSoftDuplicate(candidate, softKeys) {
  const soft = [
    candidate.normalizedName,
    normalizeText(candidate.county),
    normalizeText(candidate.phone || ''),
    normalizeText(candidate.website || candidate.bookingLink || ''),
  ].join('|');
  return softKeys.has(soft);
}

async function ingest({
  dryRun = false,
  reset = false,
  countiesFilter = [],
  minQuality = 4,
  outputPath = path.join(process.cwd(), 'artifacts', 'hospitality-sync-report.json'),
} = {}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required in the environment');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['error', 'warn'],
  });
  const startedAt = new Date();

  try {
    if (reset) {
      await prisma.hospitalityBusiness.deleteMany({});
      console.log('[sync] Cleared existing hospitality dataset before ingestion.');
    }

    const counties = await loadCountyMeta();
    const targetCounties =
      countiesFilter.length > 0
        ? counties.filter((county) =>
            countiesFilter.some((item) => normalizeText(item) === normalizeText(county.name)),
          )
        : counties;

    if (targetCounties.length === 0) {
      throw new Error('No counties selected for sync run');
    }

    console.log(`[sync] Counties targeted: ${targetCounties.length}`);

    const discovered = [];
    for (const county of targetCounties) {
      console.log(`[sync] Discovering in ${county.name}...`);
      const [overpass, wikidataGeo] = await Promise.all([
        queryOverpassForCounty(county),
        queryWikidataForCounty(county),
      ]);

      const wikidataAdmin = [];

      const mapped = [
        ...overpass.map((entry) => mapOverpassElement(county, entry)),
        ...wikidataGeo.map((entry) => mapWikidataRow(county, entry)),
        ...wikidataAdmin.map((entry) => mapWikidataRow(county, entry)),
      ];
      discovered.push(...mapped);
      await sleep(300);
    }

    console.log(`[sync] Raw discovered entries: ${discovered.length}`);

    const uniqueCandidates = mergeCandidates(discovered).filter((entry) => entry.qualityScore >= minQuality);
    console.log(`[sync] Unique validated candidates: ${uniqueCandidates.length}`);

    const existing = await loadExistingDedupe(prisma);

    const toInsert = uniqueCandidates.filter(
      (candidate) => !existing.dedupeKeys.has(candidate.dedupeKey) && !hasSoftDuplicate(candidate, existing.softKeys),
    );

    const duplicatesRejected = uniqueCandidates.length - toInsert.length;
    console.log(`[sync] New insert candidates: ${toInsert.length}, rejected duplicates: ${duplicatesRejected}`);

    let insertedCount = 0;
    if (!dryRun && toInsert.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const result = await prisma.hospitalityBusiness.createMany({
          data: chunk.map((entry) => ({
            name: entry.name,
            normalizedName: entry.normalizedName,
            dedupeKey: entry.dedupeKey,
            category: entry.category,
            county: entry.county,
            town: entry.town,
            area: entry.area,
            address: entry.address,
            phone: entry.phone,
            email: entry.email,
            website: entry.website,
            bookingLink: entry.bookingLink,
            latitude: entry.latitude,
            longitude: entry.longitude,
            description: entry.description,
            amenities: entry.amenities || [],
            source: entry.source,
            sourceRef: entry.sourceRef,
            qualityScore: entry.qualityScore,
            isVerified: entry.isVerified,
            isActive: entry.isActive,
            metadata: entry.metadata || {},
            lastSeenAt: entry.lastSeenAt,
          })),
          skipDuplicates: true,
        });
        insertedCount += result.count;
      }
    }

    const allBusinesses = await prisma.hospitalityBusiness.findMany({
      select: { county: true, category: true },
    });

    const byCounty = {};
    const byCategory = {};
    for (const entry of allBusinesses) {
      byCounty[entry.county] = (byCounty[entry.county] || 0) + 1;
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    }

    const countiesCovered = Object.keys(byCounty).sort();
    const countyGaps = counties
      .map((county) => county.name)
      .filter((countyName) => !countiesCovered.includes(countyName));

    const report = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      dryRun,
      targetedCountyCount: targetCounties.length,
      totalDiscoveredRaw: discovered.length,
      totalUniqueValidated: uniqueCandidates.length,
      duplicatesRejected,
      insertedCount,
      currentTotalInDatabase: allBusinesses.length,
      byCategory,
      byCounty,
      countiesCovered,
      countyGaps,
      sampleInserted: toInsert.slice(0, 15).map((entry) => ({
        name: entry.name,
        category: entry.category,
        county: entry.county,
        website: entry.website,
        phone: entry.phone,
        source: entry.source,
        qualityScore: entry.qualityScore,
      })),
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[sync] Report written to ${outputPath}`);

    return report;
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    reset: false,
    counties: [],
    minQuality: 4,
    outputPath: path.join(process.cwd(), 'artifacts', 'hospitality-sync-report.json'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      options.dryRun = true;
    } else if (token === '--reset') {
      options.reset = true;
    } else if (token === '--counties' && argv[i + 1]) {
      options.counties = argv[i + 1].split(',').map((value) => value.trim()).filter(Boolean);
      i += 1;
    } else if (token === '--min-quality' && argv[i + 1]) {
      options.minQuality = Number(argv[i + 1]) || 4;
      i += 1;
    } else if (token === '--out' && argv[i + 1]) {
      options.outputPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  ingest({
    dryRun: options.dryRun,
    reset: options.reset,
    countiesFilter: options.counties,
    minQuality: options.minQuality,
    outputPath: options.outputPath,
  })
    .then((report) => {
      console.log('[sync] Completed successfully');
      console.log(
        JSON.stringify(
          {
            insertedCount: report.insertedCount,
            currentTotalInDatabase: report.currentTotalInDatabase,
            countiesCovered: report.countiesCovered.length,
            countyGaps: report.countyGaps,
          },
          null,
          2,
        ),
      );
    })
    .catch((error) => {
      console.error('[sync] Failed', error);
      process.exit(1);
    });
}

module.exports = {
  ingest,
};

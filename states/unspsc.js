// UNSPSC (the commodity codes some state portals publish) -> a readable category and a NAICS prefix.
// The NAICS prefix is only used to look up similar past awards on USAspending (see sam-estimates.js);
// USAspending accepts NAICS prefixes of 2, 4 or 6 digits. The crosswalk is deliberately coarse (segment level,
// a few family overrides): a broad-but-honest estimate beats none, and the page labels it as a rough guide.

const SEGMENTS = {
  10: "Live plant and animal material", 11: "Mineral, textile and plant/animal materials", 12: "Chemicals and gases",
  13: "Resins, rubber, foam and plastics", 14: "Paper materials and products", 15: "Fuels and lubricants",
  20: "Mining and drilling machinery", 21: "Farming, fishing and forestry machinery", 22: "Construction machinery",
  23: "Industrial manufacturing machinery", 24: "Material handling and storage machinery", 25: "Vehicles and transport equipment",
  26: "Power generation and distribution machinery", 27: "Tools and general machinery", 30: "Building and construction components",
  31: "Manufacturing components and supplies", 32: "Electronic components", 39: "Electrical systems and lighting",
  40: "Distribution and conditioning systems (HVAC, plumbing, piping)", 41: "Laboratory and testing equipment",
  42: "Medical equipment and supplies", 43: "IT, broadcasting and telecommunications", 44: "Office equipment and supplies",
  45: "Printing, photographic and audio-visual equipment", 46: "Defense, law enforcement and safety equipment",
  47: "Cleaning equipment and supplies", 48: "Service industry machinery", 49: "Sports and recreational equipment",
  50: "Food, beverage and tobacco", 51: "Drugs and pharmaceuticals", 52: "Appliances and consumer electronics",
  53: "Apparel and personal care", 55: "Published products", 56: "Furniture and furnishings", 60: "Musical instruments, toys and crafts",
  70: "Agriculture, forestry and wildlife services", 71: "Mining and oil and gas services",
  72: "Building construction and facility maintenance services", 73: "Industrial production and manufacturing services",
  76: "Industrial cleaning services", 77: "Environmental services", 78: "Transportation, storage and mail services",
  80: "Management, business and administrative services", 81: "Engineering, research and technology services",
  82: "Editorial, design and graphic services", 83: "Public utilities and public-sector services", 84: "Financial and insurance services",
  85: "Healthcare services", 86: "Education and training services", 90: "Travel, food, lodging and entertainment services",
  91: "Personal and domestic services", 92: "Defense, public order and security services", 93: "Politics and civic affairs services",
  94: "Organizations and clubs", 95: "Land, buildings and right-of-way"
};

// UNSPSC segment -> NAICS prefix (2, 4 or 6 digits). Segments absent here (e.g. 43) go through the family table, else get no estimate.
const NAICS_BY_SEGMENT = {
  12: "3251", 14: "3222", 15: "4247", 22: "3331", 23: "3332", 24: "3339", 25: "3361", 26: "3353", 31: "3329", 32: "3344",
  39: "3351", 41: "3345", 42: "3391", 44: "4241", 46: "3329", 47: "3256", 48: "3333",
  50: "4244", 51: "3254", 53: "3152", 56: "3371", 70: "1151", 72: "23", 76: "5617", 77: "5629", 78: "48", 80: "5416",
  81: "5413", 82: "5418", 85: "62", 86: "61", 92: "5616"
};
// Family (first 4 digits) overrides where the segment is too mixed.
const NAICS_BY_FAMILY = {
  4321: "3341", 4322: "3342", 4323: "5112", 4320: "3341", 4324: "3341", 4325: "3341", 4326: "3341", 4327: "3342", 4328: "3342",
  8111: "5415", 8110: "5415", 8112: "5415", 8113: "5415", 8010: "5416", 8011: "5416", 8012: "5411", 8014: "5418",
  8015: "5416", 8016: "5614", 8017: "5416", 8411: "5412", 8412: "5239",
  7210: "5617", 7211: "2362", 7212: "2362", 7213: "2373", 7215: "5617"
};

// Accepts "7210", "7210;2611", "72101500", arrays. Returns [{ code, segment, family }] without duplicates.
function parse(raw) {
  const out = [], seen = new Set();
  for (const t of String(Array.isArray(raw) ? raw.join(" ") : raw || "").split(/[^0-9]+/)) {
    if (t.length < 2) continue;
    const code = t.slice(0, 8);
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, segment: code.slice(0, 2), family: code.length >= 4 ? code.slice(0, 4) : null });
  }
  return out;
}

// "Building construction and facility maintenance services; IT, broadcasting and telecommunications"
function category(raw) {
  const names = [];
  for (const c of parse(raw)) {
    const n = SEGMENTS[c.segment];
    if (n && !names.includes(n)) names.push(n);
  }
  if (!names.length) return null;
  return names.length > 2 ? names.slice(0, 2).join("; ") + " (+" + (names.length - 2) + " more)" : names.join("; ");
}

// First code that maps to a NAICS prefix wins (portals list the primary commodity first).
function naics(raw) {
  for (const c of parse(raw)) {
    const n = (c.family && NAICS_BY_FAMILY[c.family]) || NAICS_BY_SEGMENT[c.segment];
    if (n) return n;
  }
  return null;
}

module.exports = { parse, category, naics, SEGMENTS };

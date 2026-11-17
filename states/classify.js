// Some portals (Missouri, South Dakota) publish only the bid TYPE (RFP, IFB, RFQ, ...), not a subject category.
// This guesses a real category from the title/description, using the same labels other states publish so they merge in the filter.
// First matching rule wins; nothing matching gives "No data" rather than a bid type.
const RULES = [
  ["Construction", /construct|\bbridge|roadway|highway|paving|asphalt|resurfac|\broof|renovat|remodel|demolition|sidewalk|\bHVAC\b|boiler|chiller|elevator|window replacement|flooring|\bbuilding (addition|project)|\bstructure/i],
  ["Architectural, Engineering & Surveying", /architect|engineering|\bsurvey(ing|or)|design services|design-build|geotechnical/i],
  ["Information Technology", /software|\bIT\b|information technology|cyber|network|\bcloud\b|database|website|web ?site|licen[sc]e renewal|computer|server|data (center|management)|telecom|telephone|technology|video|\bwi-?fi\b|digital|\bERP\b|\bsaas\b|application|phone system/i],
  ["Medical & Health Care", /medical|health|clinic|hospital|pharmac|dental|nursing|patient|behavioral|mental|laborator|vaccine|drug|substance|diagnostic|ambulance|\bEMS\b/i],
  ["Health and Human Services", /human services|child welfare|foster|social service|case management|disabilit|aging|senior|family|youth|homeless|housing assist/i],
  ["Educational & Recreational", /educat|training|school|curricul|library|recreation|park|museum|student|scholar|tuition|\bcourse/i],
  ["Environmental", /environment|remediation|wastewater|stormwater|\bwaste\b|\brecycl|hazardous|\bwater (quality|treatment)|air quality|asbestos|mold|\bwell\b/i],
  ["Utilities & Green Energies", /utilit|electric(al)? (power|service)|natural gas|solar|energy|\bfuel\b|propane|generator|lighting/i],
  ["Transportation, Bus, Rail, Marine & Aviation", /vehicle|\btruck|\bbus\b|transit|aircraft|aviation|airport|\brail|snow ?plow|tractor|\bvan\b|\btrailer|fleet|\btire|pickup|\bcar\b|\bSUV\b/i],
  ["Facilities, Maintenance, Repair & Building Operations", /maintenance|janitor|custodial|cleaning|repair|pest|mowing|landscap|grounds|inspection|testing|painting|plumbing|\bsecurity (system|guard|service)|fire (alarm|suppression|sprinkler)/i],
  ["Professional Services", /consult|legal|audit|accounting|actuar|financial|investment|banking|insurance|workers. comp|\bTPA\b|master plan|mitigation|planning|advisory|study|assessment|evaluation|research|program management|\bstaffing|personnel|temporary (help|staff)|translation|interpret|court reporter/i],
  ["Administrative & Technical", /printing|mailing|postage|advertis|marketing|media|communications|uniform|document|records|storage|shredding|courier|delivery/i],
  ["Food, Beverages, Commissary & Vending", /\bfood|beverage|catering|meal|vending|commissary|dairy|produce|bread|\bmeat/i],
  ["Goods", /equipment|supplies|furniture|purchase of|\bparts\b|materials|chemical|\bammunition|apparel|\bkit\b|\bpaper\b|toner|\btools?\b|instrument|\bmachine|\bpump|\bsalt\b|\bgravel|aggregate/i]
];

function classify(...texts) {
  const s = texts.filter(Boolean).join(" ");
  for (const [label, re] of RULES) if (re.test(s)) return label;
  return "No data";
}

module.exports = { classify };

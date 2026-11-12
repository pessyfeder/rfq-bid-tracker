// "Today" as a YYYY-MM-DD string in US Eastern time. Every due date is Eastern, so comparisons against
// due dates must not use the UTC date (which is already tomorrow from 20:00 ET).
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
function etToday(now) { return fmt.format(now || new Date()); }
module.exports = { etToday };

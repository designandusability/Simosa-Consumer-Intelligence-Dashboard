import "server-only";
import { JWT } from "google-auth-library";
import { DashboardError } from "./http";
import { MONTH } from "./analytics.mjs";
import { tamashaDashboard } from "./dashboard-access.mjs";

const clients = new Map();

export function openDashboardSheets(dashboardId) {
  const tamasha = dashboardId === tamashaDashboard.id;
  const sheet = (tamasha ? process.env.TAMASHA_GOOGLE_SPREADSHEET_ID : process.env.GOOGLE_SPREADSHEET_ID)?.trim();
  const accountSetting = (tamasha && process.env.TAMASHA_GOOGLE_SERVICE_ACCOUNT_JSON?.trim())
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let account;
  try {
    account = JSON.parse(accountSetting ?? "{}");
  } catch {
    throw new DashboardError("The Google Sheets service-account setting is invalid. Contact the dashboard administrator.");
  }
  if (!sheet || !/^[\w-]+$/.test(sheet) || !account?.client_email || !account?.private_key) {
    throw new DashboardError(tamasha
      ? "The Tamasha reporting sheet is not configured. Contact the dashboard administrator."
      : "Google Sheets is not configured. Add the sheet ID and service-account credentials to the server.");
  }
  if (!clients.has(dashboardId)) clients.set(dashboardId, new JWT({
    email: account.client_email, key: account.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  }));
  const credentials = clients.get(dashboardId);

  async function sheetsRequest(path = "", parameters = new URLSearchParams()) {
    let response;
    try {
      const { token } = await credentials.getAccessToken();
      if (!token) throw new Error("Token unavailable");
      response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet}${path}?${parameters}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store", signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new DashboardError("The dashboard could not reach Google Sheets. Check the service account or try again.");
    }
    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        throw new DashboardError("Google Sheets denied access. Check that the spreadsheet is shared with the service account.");
      }
      throw new DashboardError("Google Sheets did not return the required data. Try again or contact the dashboard administrator.");
    }
    return response.json();
  }

  async function tabTitles() {
    const result = await sheetsRequest("", new URLSearchParams({ fields: "sheets(properties(title))" }));
    return new Set(result.sheets?.map(({ properties }) => properties.title) ?? []);
  }

  async function readTabs(names) {
    const unique = [...new Set(names)];
    if (!unique.length) return {};
    const query = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" });
    for (const title of unique) query.append("ranges", `'${title.replaceAll("'", "''")}'`);
    const result = await sheetsRequest("/values:batchGet", query);
    return Object.fromEntries(unique.map((name, index) => {
      const [headers = [], ...rows] = result.valueRanges?.[index]?.values ?? [];
      return [name, rows.map((row) => Object.fromEntries(headers.flatMap((header, col) =>
        String(header).trim() ? [[String(header).trim(), row[col] ?? ""]] : [])))];
    }));
  }

  return { tabTitles, readTabs };
}

export function availableMonths(tabs) {
  return [...tabs].filter((name) => name.startsWith("summary_")).map((name) => name.slice(8))
    .filter((key) => MONTH.test(key)).sort().reverse();
}

export function requireMonth(month, tabs) {
  if (!month || !MONTH.test(month) || !tabs.has(`summary_${month}`)) {
    throw new DashboardError("That reporting month is unavailable.", 400);
  }
  return month;
}

export function requireTabs(titles, required) {
  if (required.some((title) => !titles.has(title))) {
    throw new DashboardError("One or more worksheets are missing for this reporting month.");
  }
}

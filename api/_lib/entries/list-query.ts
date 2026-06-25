import type { VercelRequest } from "@vercel/node";

export interface EntryListQuery {
  lite: boolean;
  paginated: boolean;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export function parseEntryListQuery(req: VercelRequest): EntryListQuery {
  const lite = req.query.lite === "1" || req.query.lite === "true";
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;
  const hasPage = pageRaw !== undefined && String(pageRaw).trim() !== "";
  const hasLimit = limitRaw !== undefined && String(limitRaw).trim() !== "";
  const paginated = hasPage || hasLimit;

  const page = Math.max(1, parseInt(String(pageRaw ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(limitRaw ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );

  return { lite, paginated, page, limit };
}

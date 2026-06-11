// ============================================================
// usePagination — Generic client-side pagination helper
// ============================================================

import { useState, useMemo } from 'react';

/**
 * Manages page, search, and filter state and exposes
 * helpers for resetting page when filters change.
 *
 * @param {Object} defaults  - { page, limit, search, ...extras }
 */
export function usePagination({ page: initPage = 1, limit = 20, search: initSearch = '', ...extras } = {}) {
  const [page, setPage] = useState(initPage);
  const [search, setSearch] = useState(initSearch);
  const [filters, setFilters] = useState(extras);

  const setSearchReset = (val) => {
    setSearch(val);
    setPage(1);
  };

  const setFilter = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const reset = () => {
    setPage(initPage);
    setSearch(initSearch);
    setFilters(extras);
  };

  return {
    page,
    limit,
    search,
    filters,
    setPage,
    setSearch: setSearchReset,
    setFilter,
    reset,
    // convenience: spread into query params
    queryParams: useMemo(() => ({ page, limit, search, ...filters }), [page, limit, search, filters]),
  };
}

/**
 * Slice a local array for client-side pagination.
 * Returns { items, totalPages, isEmpty }.
 */
export function useLocalPagination(data = [], { page = 1, limit = 20 } = {}) {
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * limit;
  const items = data.slice(start, start + limit);

  return { items, total, totalPages, isEmpty: total === 0 };
}

"use client";

import { useState } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilter: (filters: FilterOptions) => void;
  mediaOptions?: string[];
  projectOptions?: string[];
}

export interface FilterOptions {
  media: string[];
  profitRange: { min?: number; max?: number };
  roasRange: { min?: number; max?: number };
  status: string[];
}

const defaultFilters: FilterOptions = {
  media: [],
  profitRange: {},
  roasRange: {},
  status: [],
};

export function SearchFilter({
  onSearch,
  onFilter,
  mediaOptions = ["Meta", "TikTok", "Pangle", "YouTube", "LINE"],
  projectOptions = [],
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch(value);
  };

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilter(updated);
  };

  const toggleMedia = (media: string) => {
    const newMedia = filters.media.includes(media)
      ? filters.media.filter((m) => m !== media)
      : [...filters.media, media];
    handleFilterChange({ media: newMedia });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery("");
    onSearch("");
    onFilter(defaultFilters);
  };

  const activeFilterCount =
    filters.media.length +
    (filters.profitRange.min !== undefined || filters.profitRange.max !== undefined ? 1 : 0) +
    (filters.roasRange.min !== undefined || filters.roasRange.max !== undefined ? 1 : 0) +
    filters.status.length;

  return (
    <div className="space-y-3">
      {/* 検索バー */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="CPN名、案件名で検索..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                onSearch("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
            >
              <X className="h-3 w-3 text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 border rounded-lg flex items-center gap-2 text-sm transition-colors ${
            showFilters || activeFilterCount > 0
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Filter className="h-4 w-4" />
          フィルター
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* フィルターパネル */}
      {showFilters && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 animate-slide-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 媒体フィルター */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">媒体</label>
              <div className="flex flex-wrap gap-1.5">
                {mediaOptions.map((media) => (
                  <button
                    key={media}
                    onClick={() => toggleMedia(media)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      filters.media.includes(media)
                        ? "bg-indigo-600 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    {media}
                  </button>
                ))}
              </div>
            </div>

            {/* 利益フィルター */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">利益</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="min"
                  value={filters.profitRange.min ?? ""}
                  onChange={(e) =>
                    handleFilterChange({
                      profitRange: {
                        ...filters.profitRange,
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-slate-400">〜</span>
                <input
                  type="number"
                  placeholder="max"
                  value={filters.profitRange.max ?? ""}
                  onChange={(e) =>
                    handleFilterChange({
                      profitRange: {
                        ...filters.profitRange,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* ROASフィルター */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">ROAS (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="min"
                  value={filters.roasRange.min ?? ""}
                  onChange={(e) =>
                    handleFilterChange({
                      roasRange: {
                        ...filters.roasRange,
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-slate-400">〜</span>
                <input
                  type="number"
                  placeholder="max"
                  value={filters.roasRange.max ?? ""}
                  onChange={(e) =>
                    handleFilterChange({
                      roasRange: {
                        ...filters.roasRange,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* クイックフィルター */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">クイック</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleFilterChange({ profitRange: { min: 0 } })}
                  className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                >
                  黒字のみ
                </button>
                <button
                  onClick={() => handleFilterChange({ profitRange: { max: -1 } })}
                  className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                >
                  赤字のみ
                </button>
                <button
                  onClick={() => handleFilterChange({ roasRange: { min: 150 } })}
                  className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                >
                  ROAS150%↑
                </button>
              </div>
            </div>
          </div>

          {/* クリアボタン */}
          {activeFilterCount > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                フィルターをクリア
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


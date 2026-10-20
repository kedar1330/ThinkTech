'use client';

import { useMemo, useState } from 'react';
import type { CatalogueCategoryItem, ClothingStyleItem } from '@styleme/contracts';
import { StyleCard } from './StyleCard';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CategoryExplorerProps {
  initialCategories: CatalogueCategoryItem[];
  initialStyles: ClothingStyleItem[];
  userDepartment?: string;
  userBodyShape?: string;
}

export function CategoryExplorer({
  initialCategories,
  initialStyles,
  userDepartment,
  userBodyShape,
}: CategoryExplorerProps) {
  const [department, setDepartment] = useState<string>(userDepartment ?? 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBodyShape, setSelectedBodyShape] = useState<string>(userBodyShape ?? 'all');
  const [selectedGoal, setSelectedGoal] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter categories by department
  const filteredCategories = useMemo(() => {
    if (department === 'all') return initialCategories;
    return initialCategories.filter((cat) => cat.department === department);
  }, [initialCategories, department]);

  // Available unique styling goals from the styles
  const allGoals = useMemo(() => {
    const goalsSet = new Set<string>();
    initialStyles.forEach((style) => {
      style.stylingGoals?.forEach((g) => goalsSet.add(g));
    });
    return Array.from(goalsSet);
  }, [initialStyles]);

  // Available unique body shapes from the styles
  const allBodyShapes = useMemo(() => {
    const shapesSet = new Set<string>();
    initialStyles.forEach((style) => {
      style.bodyShapes?.forEach((s) => shapesSet.add(s));
    });
    return Array.from(shapesSet);
  }, [initialStyles]);

  // Filter styles
  const filteredStyles = useMemo(() => {
    return initialStyles.filter((style) => {
      if (department !== 'all' && style.department !== department) {
        return false;
      }
      if (selectedCategory !== 'all' && style.categoryKey !== selectedCategory) {
        return false;
      }
      if (selectedBodyShape !== 'all' && !style.bodyShapes?.includes(selectedBodyShape)) {
        return false;
      }
      if (selectedGoal !== 'all' && !style.stylingGoals?.includes(selectedGoal)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = style.name.toLowerCase().includes(q);
        const matchesDesc = style.description.toLowerCase().includes(q);
        const matchesCategory = style.categoryKey.toLowerCase().includes(q);
        const matchesAttr = style.attributes?.some((a) => a.valueId.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesCategory && !matchesAttr) {
          return false;
        }
      }
      return true;
    });
  }, [initialStyles, department, selectedCategory, selectedBodyShape, selectedGoal, searchQuery]);

  const handleResetFilters = () => {
    setDepartment('all');
    setSelectedCategory('all');
    setSelectedBodyShape('all');
    setSelectedGoal('all');
    setSearchQuery('');
  };

  const hasActiveFilters =
    department !== 'all' ||
    selectedCategory !== 'all' ||
    selectedBodyShape !== 'all' ||
    selectedGoal !== 'all' ||
    searchQuery.trim().length > 0;

  return (
    <div className="space-y-8">
      {/* Search and Top Filters Bar */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Department Switcher */}
          <div
            className="inline-flex rounded-lg bg-surface-raised p-1 border border-border"
            role="radiogroup"
            aria-label="Department filter"
          >
            {(['all', 'women', 'men'] as const).map((dep) => (
              <button
                key={dep}
                type="button"
                onClick={() => {
                  setDepartment(dep);
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                  department === dep
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {dep === 'all' ? 'All Departments' : dep}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search silhouettes, styles or attributes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
              aria-label="Search clothing styles"
            />
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-muted-foreground">Categories</p>
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Category filter">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-plum text-white font-medium'
                  : 'bg-surface-raised border border-border text-foreground hover:border-plum/40'
              }`}
            >
              All Categories
            </button>
            {filteredCategories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  selectedCategory === cat.key
                    ? 'bg-plum text-white font-medium'
                    : 'bg-surface-raised border border-border text-foreground hover:border-plum/40'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/80">
          <div>
            <label htmlFor="body-shape-filter" className="block text-xs font-medium text-muted-foreground mb-1">
              Body Shape
            </label>
            <select
              id="body-shape-filter"
              value={selectedBodyShape}
              onChange={(e) => setSelectedBodyShape(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-plum"
            >
              <option value="all">All body shapes</option>
              {allBodyShapes.map((shape) => (
                <option key={shape} value={shape}>
                  {shape.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="styling-goal-filter" className="block text-xs font-medium text-muted-foreground mb-1">
              Styling Goal
            </label>
            <select
              id="styling-goal-filter"
              value={selectedGoal}
              onChange={(e) => setSelectedGoal(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-plum"
            >
              <option value="all">All styling goals</option>
              {allGoals.map((goal) => (
                <option key={goal} value={goal}>
                  {goal.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter stats & Reset */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            Showing <strong className="text-foreground">{filteredStyles.length}</strong> styles
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-plum hover:underline"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Styles Grid */}
      {filteredStyles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center space-y-3 bg-surface/50">
          <SlidersHorizontal className="size-8 mx-auto text-muted-foreground" aria-hidden="true" />
          <h3 className="font-display text-xl text-primary">No styles match your filters</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Try adjusting your category, body shape, or styling goal filters to view more recommendations.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg bg-plum px-4 py-2 text-xs font-medium text-white hover:bg-plum/90"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStyles.map((style) => (
            <StyleCard key={style.styleId} style={style} />
          ))}
        </div>
      )}
    </div>
  );
}

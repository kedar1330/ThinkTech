'use client';

import { useId, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cityLabel, searchCities } from '@styleme/contracts';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

/**
 * Searchable Indian-city picker (WAI-ARIA combobox pattern). The submitted value is the city ID from
 * the shared list, so the server validates against exactly what the user picked.
 */
export function CityCombobox({
  id,
  name,
  value: controlled,
  defaultValue,
  required,
  invalid,
  describedBy,
  onSelect,
}: {
  id: string;
  name: string;
  value?: string;
  defaultValue?: string | null;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onSelect?: (cityId: string) => void;
}) {
  const listId = useId();
  const [own, setOwn] = useState(defaultValue ?? '');
  const value = controlled ?? own;
  const [query, setQuery] = useState(cityLabel(value) ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchCities(query, 8), [query]);

  const select = (cityId: string) => {
    setOwn(cityId);
    onSelect?.(cityId);
  };
  const choose = (cityId: string) => {
    select(cityId);
    setQuery(cityLabel(cityId) ?? '');
    setOpen(false);
  };

  return (
    <div className="relative">
      <MapPin
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id={id}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Start typing your city"
        required={required}
        value={query}
        className={cn(inputClass, 'pl-10')}
        onChange={(e) => {
          setQuery(e.target.value);
          select('');
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && results[active]) {
            e.preventDefault();
            choose(results[active].id);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <input type="hidden" name={name} value={value} />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Cities"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {results.map((city, i) => (
            <li
              key={city.id}
              id={`${listId}-${city.id}`}
              role="option"
              aria-selected={i === active}
              className={cn(
                'flex cursor-pointer justify-between gap-3 px-3.5 py-2 text-sm',
                i === active && 'bg-surface-muted',
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(city.id)}
            >
              <span>{city.name}</span>
              <span className="text-xs text-muted-foreground">{city.state}</span>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim().length > 0 && results.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground shadow-lg">
          No matching city. Try the nearest larger city.
        </p>
      )}
    </div>
  );
}

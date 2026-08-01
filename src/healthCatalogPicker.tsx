import { Plus } from "lucide-react";
import { useState } from "react";
import { HealthCatalogEntry } from "./types";

/** Picker for the Health quick log's "Vaccine"/"Medication" fields — same
 * collapsed-summary-until-opened, search-then-pick shape as `MilestonePicker`
 * (reuses its `training-picker-*` CSS classes so it looks and behaves the same),
 * but flat (a health catalog isn't hierarchical the way milestone tracks are) and
 * with a capability `MilestonePicker` doesn't need: typing a name nothing matches
 * offers to add it as a new household catalog entry on the spot, so a vet-directed
 * product that isn't in the built-in list never blocks logging a dose. */
export function HealthCatalogPicker({
  entries,
  value,
  onChange,
  onAddCustom,
  emptyLabel = "Nothing picked",
  searchPlaceholder = "Search or add a new one…",
}: {
  entries: HealthCatalogEntry[];
  value: string;
  onChange: (id: string) => void;
  /** Persists a new household catalog entry and resolves to its id. */
  onAddCustom: (name: string) => Promise<string>;
  emptyLabel?: string;
  searchPlaceholder?: string;
}) {
  const selected = entries.find((entry) => entry.id === value);
  const [open, setOpen] = useState(!value);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const search = query.trim().toLowerCase();
  const matches = entries.filter((entry) => search === "" || entry.name.toLowerCase().includes(search));
  const exactMatch = entries.some((entry) => entry.name.toLowerCase() === search);
  const canAddCustom = search !== "" && !exactMatch;

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  async function addCustom() {
    if (adding) return;
    setAdding(true);
    const id = await onAddCustom(query.trim());
    setAdding(false);
    choose(id);
  }

  if (!open) {
    return (
      <div className="training-picker-selected">
        <div>
          <strong>{selected?.name ?? emptyLabel}</strong>
          {selected?.custom && <p className="small">Custom</p>}
        </div>
        <button className="text-button" type="button" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="training-picker">
      <input
        type="search"
        className="training-picker-search"
        placeholder={searchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={searchPlaceholder}
      />
      <div className="training-picker-list">
        {matches.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`training-picker-option training-picker-category-leaf ${value === entry.id ? "active" : ""}`}
            onClick={() => choose(entry.id)}
          >
            <span className="training-picker-option-title">{entry.name}</span>
            {entry.custom && <span className="training-picker-meta">Custom</span>}
          </button>
        ))}
        {canAddCustom && (
          <button
            type="button"
            className="training-picker-option training-picker-add-new"
            onClick={addCustom}
            disabled={adding}
          >
            <span className="training-picker-option-title">
              <Plus size={14} aria-hidden /> {adding ? "Adding…" : `Add "${query.trim()}" as new`}
            </span>
          </button>
        )}
        {matches.length === 0 && !canAddCustom && <p className="small">Nothing matches "{query.trim()}".</p>}
      </div>
    </div>
  );
}

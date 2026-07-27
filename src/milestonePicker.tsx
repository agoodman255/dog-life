import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Milestone } from "./types";
import { milestoneProgress } from "./utils";

export const TRACK_LABELS: Record<Milestone["track"], string> = {
  obedience: "Obedience",
  handling: "Handling",
  socialization: "Socialization",
  confidence: "Confidence",
  health: "Health",
  relationship: "Relationship",
};

export const TRACK_ORDER: Milestone["track"][] = ["obedience", "socialization", "confidence", "handling", "health"];

/** A pinned leaf shown alongside the grouped milestone list — Quick log's "Alone
 * time" (a real option that isn't a milestone) or a form's "Write my own steps
 * below" (clears the selection rather than picking one). */
export interface MilestonePickerPinnedOption {
  id: string;
  label: string;
}

/** Shared browser for picking a milestone: grouped by track (mirroring the Training
 * page's tabs) with a search box and per-category disclosure, so it's navigable on a
 * phone where a flat 36-option <select> isn't. Originally built for the Quick log's
 * training type (2026-07-27); pulled out to its own module (2026-07-28) so
 * ItemForm's "pull steps from a milestone" picker could look and behave the same
 * without importing components.tsx.
 *
 * Collapsed to a single row until opened, so the common case (arriving with a
 * choice already made) stays one line. */
export function MilestonePicker({
  milestones,
  dogIds = [],
  dogs = [],
  value,
  onChange,
  noneOption,
  pinnedOptions = [],
  emptyLabel = "Nothing picked",
  searchPlaceholder = "Search training types or steps…",
}: {
  milestones: Milestone[];
  /** Whose progress to show next to each milestone. Omit to hide progress. */
  dogIds?: string[];
  dogs?: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  /** Rendered above the categories; choosing it clears the selection back to "".
   * Use for forms where no milestone is a valid, common choice (e.g. "write my own
   * steps"), rather than an incomplete state. When set and `value` is empty, the
   * picker starts collapsed showing this as the current choice instead of forcing
   * the browser open. */
  noneOption?: MilestonePickerPinnedOption;
  /** Extra leaves appended after the categories — e.g. Quick log's "Alone time",
   * which isn't a milestone but shares the same picker. */
  pinnedOptions?: MilestonePickerPinnedOption[];
  emptyLabel?: string;
  searchPlaceholder?: string;
}) {
  const selected = milestones.find((entry) => entry.id === value);
  const [open, setOpen] = useState(!value && !noneOption);
  const [query, setQuery] = useState("");
  const [expandedTrack, setExpandedTrack] = useState<string | null>(selected?.track ?? null);

  const search = query.trim().toLowerCase();
  const matchesSearch = (milestone: Milestone) =>
    search === "" ||
    milestone.title.toLowerCase().includes(search) ||
    milestone.steps.some((step) => step.title.toLowerCase().includes(search));

  const groups = TRACK_ORDER.map((track) => ({
    track,
    label: TRACK_LABELS[track],
    entries: milestones.filter((milestone) => milestone.track === track && matchesSearch(milestone)),
  })).filter((group) => search === "" || group.entries.length > 0);

  const matchingPinned = pinnedOptions.filter((option) => search === "" || option.label.toLowerCase().includes(search));

  const selectedPinned = pinnedOptions.find((option) => option.id === value);
  const selectedLabel = selectedPinned?.label ?? selected?.title ?? (value === "" ? noneOption?.label : "") ?? "";

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="training-picker-selected">
        <div>
          <strong>{selectedLabel || emptyLabel}</strong>
          {selected && <p className="small">{TRACK_LABELS[selected.track]}</p>}
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
        {noneOption && (
          <button
            type="button"
            className={`training-picker-option training-picker-category-leaf ${value === "" ? "active" : ""}`}
            onClick={() => choose("")}
          >
            <span className="training-picker-option-title">{noneOption.label}</span>
          </button>
        )}
        {groups.map((group) => {
          const isExpanded = expandedTrack === group.track || (search !== "" && group.entries.length > 0);
          return (
            <div className="training-picker-category" key={group.track}>
              <button
                type="button"
                className="training-picker-category-header"
                aria-expanded={isExpanded}
                onClick={() => setExpandedTrack(isExpanded ? null : group.track)}
              >
                <span>{group.label}</span>
                <ChevronDown size={16} aria-hidden className={isExpanded ? "rotated" : ""} />
              </button>
              {isExpanded && (
                <div className="training-picker-children">
                  {group.entries.map((milestone) => (
                    <button
                      key={milestone.id}
                      type="button"
                      className={`training-picker-option ${value === milestone.id ? "active" : ""}`}
                      onClick={() => choose(milestone.id)}
                    >
                      <span className="training-picker-option-title">{milestone.title}</span>
                      {dogIds.length > 0 && (
                        <span className="training-picker-meta">
                          {dogIds
                            .map((dogId) => {
                              const name = dogs.find((dog) => dog.id === dogId)?.name ?? "";
                              return `${name} ${milestoneProgress(milestone, dogId)}%`;
                            })
                            .join(" · ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {matchingPinned.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`training-picker-option training-picker-category-leaf ${value === option.id ? "active" : ""}`}
            onClick={() => choose(option.id)}
          >
            <span className="training-picker-option-title">{option.label}</span>
          </button>
        ))}
        {groups.length === 0 && matchingPinned.length === 0 && <p className="small">Nothing matches "{query.trim()}".</p>}
      </div>
    </div>
  );
}

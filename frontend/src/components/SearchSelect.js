import { useEffect, useMemo, useRef, useState } from "react";

export default function SearchSelect({
  label,
  placeholder = "Search…",
  options = [],
  value = "",
  onChange,
  disabled = false,
  emptyText = "No matches"
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.search || o.label || "").toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="search-select" ref={wrapRef}>
      {label ? <span>{label}</span> : null}
      <button
        type="button"
        className="search-select-toggle"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
      >
        {selected ? (
          <span className="search-select-current">
            {selected.art ? <img src={selected.art} alt="" /> : null}
            {selected.label}
          </span>
        ) : (
          <span className="muted">{placeholder}</span>
        )}
      </button>
      {open ? (
        <div className="search-select-menu">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
          />
          <div className="search-select-list">
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`search-option ${String(o.value) === String(value) ? "selected" : ""}`}
                onClick={() => {
                  onChange(o.value, o);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.art ? <img src={o.art} alt="" /> : null}
                <span>
                  {o.label}
                  {o.sublabel ? <span className="muted"> · {o.sublabel}</span> : null}
                </span>
              </button>
            ))}
            {!filtered.length ? <p className="muted">{emptyText}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

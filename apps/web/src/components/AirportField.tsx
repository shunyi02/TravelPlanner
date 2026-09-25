import { useState } from 'react';
import { findAirport, searchAirports } from '../airports';

/** A plain text input for an IATA airport code, with an autosuggest dropdown
 *  (code/name/city match) and a resolved "code — name, city" hint once the
 *  typed value matches a known airport. Bundled data (see ../airports.ts) —
 *  no network call, so it also works for codes not in the list (just no hint). */
export function AirportField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const results = open ? searchAirports(value) : [];
  const resolved = findAirport(value);

  return (
    <div className="autocomplete">
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="autocomplete-input"
      />
      {open && results.length > 0 && (
        <ul className="autocomplete-list">
          {results.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(a.code);
                  setOpen(false);
                }}
              >
                <strong>{a.code}</strong> — {a.name}
                {a.city ? `, ${a.city}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!open && resolved && (
        <p className="airport-field-hint">
          {resolved.name}
          {resolved.city ? `, ${resolved.city}` : ''}
        </p>
      )}
    </div>
  );
}

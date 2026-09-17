import { useState } from 'react';
import type { Accommodation, Place, TripDetail } from '../api';
import { api } from '../api';

/** Inclusive list of YYYY-MM-DD strings between two dates. */
function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function accommodationForDay(day: string, stays: Accommodation[]) {
  const checkingOut = stays.filter((s) => s.checkOutDate.slice(0, 10) === day);
  const staying = stays.filter(
    (s) =>
      s.checkInDate.slice(0, 10) <= day &&
      day < s.checkOutDate.slice(0, 10),
  );
  return { checkingOut, staying };
}

export function ItineraryTab({
  tripId,
  trip,
  places,
  onChange,
}: {
  tripId: string;
  trip: TripDetail;
  places: Place[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [startDate, setStartDate] = useState(
    trip.startDate?.slice(0, 10) ?? '',
  );
  const [endDate, setEndDate] = useState(
    trip.endDate?.slice(0, 10) ?? '',
  );
  const [dateError, setDateError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.addPlace(tripId, {
      name: name.trim(),
      visitDate: visitDate || undefined,
    });
    setName('');
    setVisitDate('');
    onChange();
  };

  const handleSaveDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    try {
      await api.updateTripDates(tripId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onChange();
    } catch (err) {
      setDateError(
        err instanceof Error ? err.message : 'Could not save dates',
      );
    }
  };

  const days =
    startDate && endDate ? daysBetween(startDate, endDate) : [];

  const byDay = new Map<string, Place[]>();
  const unscheduled: Place[] = [];

  for (const p of places) {
    const key = p.visitDate?.slice(0, 10);
    if (key && days.includes(key)) {
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(p);
    } else {
      unscheduled.push(p);
    }
  }

  const [accName, setAccName] = useState('');
  const [accCheckIn, setAccCheckIn] = useState('');
  const [accCheckOut, setAccCheckOut] = useState('');
  const [accError, setAccError] = useState<string | null>(null);

  const handleAddAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim() || !accCheckIn || !accCheckOut) return;
    setAccError(null);

    try {
      await api.addAccommodation(tripId, {
        name: accName.trim(),
        checkInDate: accCheckIn,
        checkOutDate: accCheckOut,
      });

      setAccName('');
      setAccCheckIn('');
      setAccCheckOut('');
      onChange();
    } catch (err) {
      setAccError(
        err instanceof Error
          ? err.message
          : 'Could not add accommodation',
      );
    }
  };

  const accommodations =
    (trip as TripDetail & { accommodations?: Accommodation[] })
      .accommodations ?? [];

  return (
    <div>
      <form
        className="form-inline"
        onSubmit={handleSaveDates}
        style={{ marginBottom: 24 }}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <button className="btn" type="submit">
          Save dates
        </button>
      </form>

      {dateError && (
        <p style={{ color: 'var(--owe)', margin: '0 0 16px' }}>
          {dateError}
        </p>
      )}

      <form
        className="form-inline"
        onSubmit={handleAddAccommodation}
        style={{ marginBottom: 24 }}
      >
        <input
          placeholder="Hotel name"
          value={accName}
          onChange={(e) => setAccName(e.target.value)}
        />
        <input
          type="date"
          value={accCheckIn}
          min={startDate || undefined}
          max={endDate || undefined}
          onChange={(e) => setAccCheckIn(e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          value={accCheckOut}
          min={accCheckIn || startDate || undefined}
          max={endDate || undefined}
          onChange={(e) => setAccCheckOut(e.target.value)}
        />
        <button className="btn" type="submit">
          Add stay
        </button>
      </form>

      {accError && (
        <p style={{ color: 'var(--owe)' }}>{accError}</p>
      )}

      {days.length === 0 ? (
        places.length === 0 ? (
          <p className="empty-state">
            No stops yet. Set trip dates above to plan day by day.
          </p>
        ) : (
          <div>
            {places.map((place, index) => (
              <div className="ledger-row" key={place.id}>
                <div className="row-main">
                  <span className="stop-index">{index + 1}</span>
                  <span className="row-title">{place.name}</span>
                  {place.notes && (
                    <span className="row-sub">{place.notes}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div>
          {days.map((day) => {
            const { checkingOut, staying } = accommodationForDay(
              day,
              accommodations,
            );

            return (
              <div key={day} style={{ marginBottom: 20 }}>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {formatDay(day)}
                </h3>

                {/* Accommodation */}
                {checkingOut.map((s) => (
                  <p
                    key={`checkout-${s.id}`}
                    className="row-sub"
                  >
                    Check out: {s.name}
                  </p>
                ))}

                {staying.map((s) => (
                  <p
                    key={`staying-${s.id}`}
                    className="row-sub"
                  >
                    Staying: {s.name}
                    {s.checkInDate.slice(0, 10) === day
                      ? ' (check-in)'
                      : ''}
                  </p>
                ))}

                {/* Existing place rows */}
                <div
                  style={{
                    borderTop: '1px solid var(--rule)',
                    paddingTop: 4,
                  }}
                >
                  {(byDay.get(day) ?? []).length === 0 ? (
                    <p
                      className="empty-state"
                      style={{ padding: '8px 0' }}
                    >
                      No stops planned.
                    </p>
                  ) : (
                    byDay.get(day)!.map((place) => (
                      <div
                        className="ledger-row"
                        key={place.id}
                      >
                        <div className="row-main">
                          <span className="row-title">
                            {place.name}
                          </span>
                          {place.notes && (
                            <span className="row-sub">
                              {place.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {unscheduled.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--ink-soft)',
                }}
              >
                Unscheduled
              </h3>
              <div
                style={{
                  borderTop: '1px solid var(--rule)',
                  paddingTop: 4,
                }}
              >
                {unscheduled.map((place) => (
                  <div className="ledger-row" key={place.id}>
                    <div className="row-main">
                      <span className="row-title">
                        {place.name}
                      </span>
                      {place.notes && (
                        <span className="row-sub">
                          {place.notes}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <form className="form-inline" onSubmit={handleAdd}>
        <input
          placeholder="Add a stop (e.g. Senso-ji Temple)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="date"
          value={visitDate}
          min={startDate || undefined}
          max={endDate || undefined}
          onChange={(e) => setVisitDate(e.target.value)}
        />
        <button className="btn" type="submit">
          Add stop
        </button>
      </form>
    </div>
  );
}

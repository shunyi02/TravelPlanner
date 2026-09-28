import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { FilePdf, ShareNetwork } from '@phosphor-icons/react';
import type { TripDetail } from '../api';
import { fileSafe, printDocument } from '../print';
import { ItinerarySheet } from './ItinerarySheet';

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Export options for the itinerary: whole trip or one day, everyone or one
 *  person, then print it (Save as PDF) or share it as an image. Either way
 *  the output is ItinerarySheet, not a copy of the screen. */
export function ExportDialog({
  trip,
  days,
  memberNames,
  viewedDay,
  viewedPerson,
  onClose,
}: {
  trip: TripDetail;
  days: string[];
  memberNames: Record<string, string>;
  /** The day open in the itinerary, if any: preselected for "This day". */
  viewedDay: string | null;
  /** The itinerary's "Viewing" filter ("all" or a member id). */
  viewedPerson: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<'trip' | 'day'>(viewedDay ? 'day' : 'trip');
  const [day, setDay] = useState(viewedDay ?? days[0] ?? '');
  const [person, setPerson] = useState(viewedPerson);
  const [job, setJob] = useState<'print' | 'image' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const memberIds = Object.keys(memberNames);

  const personId = person === 'all' ? null : person;
  const places = personId
    ? trip.places.filter((p) => p.assignments.length === 0 || p.assignments.some((a) => a.userId === personId))
    : trip.places;
  const sheetDays = scope === 'day' && day ? [day] : days;
  const title = fileSafe(
    [
      trip.name,
      scope === 'day' && day ? `Day ${days.indexOf(day) + 1}` : 'Itinerary',
      personId ? (memberNames[personId] ?? '').split(' ')[0] : null,
    ]
      .filter(Boolean)
      .join(' – '),
  );

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !job) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, job]);

  const handlePrint = async () => {
    setError(null);
    setJob('print');
    document.body.classList.add('printing-sheet');
    await nextFrame();
    const done = () => {
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing-sheet');
      setJob(null);
      onClose();
    };
    window.addEventListener('afterprint', done);
    printDocument(title);
  };

  const handleImage = async () => {
    setError(null);
    setJob('image');
    try {
      await nextFrame();
      await document.fonts.ready;
      const node = stageRef.current?.firstElementChild as HTMLElement | null;
      if (!node) throw new Error('Nothing to capture');
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${title}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      onClose();
    } catch (err) {
      // Closing the share sheet isn't a failure.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError("Couldn't create the image. Please try again.");
      }
    } finally {
      setJob(null);
    }
  };

  const sheet = (variant: 'print' | 'image') => (
    <ItinerarySheet
      trip={trip}
      days={sheetDays}
      places={places}
      memberNames={memberNames}
      personId={personId}
      scope={scope}
      variant={variant}
    />
  );

  return (
    <>
      <div className="modal-backdrop no-print" onClick={() => !job && onClose()}>
        <div
          className="modal export-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="modal-title" id="export-title">
            Export itinerary
          </h2>

          <fieldset className="export-group">
            <legend>What to include</legend>
            <label className="export-option">
              <input
                ref={firstRef}
                type="radio"
                name="export-scope"
                checked={scope === 'trip'}
                onChange={() => setScope('trip')}
              />
              <span>
                Whole trip
                <span className="export-option-sub">Bookings and every day{days.length ? `, ${days.length} days` : ''}</span>
              </span>
            </label>
            <label className={`export-option${days.length === 0 ? ' disabled' : ''}`}>
              <input
                type="radio"
                name="export-scope"
                checked={scope === 'day'}
                disabled={days.length === 0}
                onChange={() => setScope('day')}
              />
              <span>
                One day
                <span className="export-option-sub">{days.length ? 'Good for sharing the plan in a chat' : 'Set trip dates first'}</span>
              </span>
            </label>
            {scope === 'day' && days.length > 0 && (
              <select className="export-select" aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)}>
                {days.map((d, i) => (
                  <option key={d} value={d}>
                    Day {i + 1} · {formatDay(d)}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          {memberIds.length > 1 && (
            <label className="export-group export-person">
              <span className="export-legend">Whose plan</span>
              <select className="export-select" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="all">Everyone</option>
                {memberIds.map((id) => (
                  <option key={id} value={id}>
                    {memberNames[id]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="export-actions">
            <button type="button" className="btn export-action" onClick={handlePrint} disabled={!!job}>
              <FilePdf size={18} aria-hidden /> Print or save as PDF
            </button>
            <button type="button" className="btn btn-outline export-action" onClick={handleImage} disabled={!!job}>
              <ShareNetwork size={18} aria-hidden /> {job === 'image' ? 'Creating image…' : 'Share as image'}
            </button>
          </div>
          <p className="export-hint">
            To save a PDF, choose <strong>Save as PDF</strong> in the print window. Turn off{' '}
            <strong>Headers and footers</strong> there for a clean page.
          </p>
          <div className="form-actions">
            <button type="button" className="text-btn" onClick={onClose} disabled={!!job}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {job === 'print' && createPortal(<div className="print-root">{sheet('print')}</div>, document.body)}
      {job === 'image' &&
        createPortal(
          <div className="image-stage" ref={stageRef} aria-hidden="true">
            {sheet('image')}
          </div>,
          document.body,
        )}
    </>
  );
}

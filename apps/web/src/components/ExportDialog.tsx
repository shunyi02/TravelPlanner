import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { FilePdf, ShareNetwork } from '@phosphor-icons/react';
import { paperForLocale, renderItinerarySheet, themeDefinitionById } from '@travel-planner/shared';
import type { TripDetail } from '../api';
import { storedThemeId } from '../themes';

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const stageHtml = (sheet: { css: string; body: string }) => `<style>${sheet.css}</style>${sheet.body}`;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Export options for the itinerary: whole trip or one day, everyone or one
 *  person, what to include, then print it (Save as PDF) or share it as an
 *  image. Either way the output is the shared itinerary sheet (the same one
 *  the mobile app turns into a PDF), not a copy of the screen. */
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
  const [include, setInclude] = useState({ map: true, notes: true, checkboxes: true });
  const stageRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const memberIds = Object.keys(memberNames);
  const personId = person === 'all' ? null : person;

  const render = (variant: 'print' | 'image') =>
    renderItinerarySheet(trip, memberNames, {
      scope,
      day: scope === 'day' ? day : undefined,
      personId,
      include,
      variant,
      // Exports are always light and on-brand, even when the app is in dark mode.
      palette: themeDefinitionById(storedThemeId()).light,
      paper: paperForLocale(navigator.language),
    });

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !job) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, job]);

  /** Prints the sheet from a hidden iframe, so the app's own page and styles
   *  stay out of it; the iframe's title becomes the suggested PDF file name. */
  const handlePrint = () => {
    setError(null);
    setJob('print');
    const sheet = render('print');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    const cleanUp = () => {
      frame.remove();
      setJob(null);
      onClose();
    };
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return cleanUp();
      win.addEventListener('afterprint', () => setTimeout(cleanUp, 0));
      win.focus();
      win.print();
    };
    frame.srcdoc = sheet.document;
    document.body.appendChild(frame);
  };

  const handleImage = async () => {
    setError(null);
    setJob('image');
    try {
      await nextFrame();
      await document.fonts.ready;
      const node = stageRef.current?.querySelector('.cuti-sheet') as HTMLElement | null;
      if (!node) throw new Error('Nothing to capture');
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const { title } = render('image');
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

          <fieldset className="export-group">
            <legend>Show</legend>
            <div className="export-toggles">
              {(
                [
                  ['map', 'Route maps'],
                  ['notes', 'Notes'],
                  ['checkboxes', 'Tick boxes'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="export-toggle">
                  <input
                    type="checkbox"
                    checked={include[key]}
                    onChange={(e) => setInclude((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

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

      {job === 'image' &&
        createPortal(
          <div
            className="image-stage"
            ref={stageRef}
            aria-hidden="true"
            // The sheet is our own HTML: user text in it is escaped by renderItinerarySheet.
            dangerouslySetInnerHTML={{ __html: stageHtml(render('image')) }}
          />,
          document.body,
        )}
    </>
  );
}

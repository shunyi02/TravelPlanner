import { useEffect, useState } from 'react';
import {
  COMMON_CURRENCIES,
  COUNTRIES,
  MIN_SIGNUP_AGE,
  PASSPORT_MIN_VALID_MONTHS,
  isOldEnoughToSignUp,
  maskPassportNumber,
  passportExpiryStatus,
} from '@travel-planner/shared';
import { api, type CurrentUser, type ProfileUpdate } from '../api';
import { useAuth } from '../authContext';
import { initials } from '../format';

/** The plain text fields, as the inputs hold them ("" for not set). */
type TextFields = {
  name: string;
  dateOfBirth: string;
  phone: string;
  nationality: string;
  passportExpiry: string;
  homeCurrency: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  dietaryNotes: string;
};

function fieldsFrom(user: CurrentUser): TextFields {
  return {
    name: user.name,
    dateOfBirth: user.dateOfBirth ?? '',
    phone: user.phone ?? '',
    nationality: user.nationality ?? '',
    passportExpiry: user.passportExpiry ?? '',
    homeCurrency: user.homeCurrency ?? '',
    emergencyContactName: user.emergencyContactName ?? '',
    emergencyContactPhone: user.emergencyContactPhone ?? '',
    dietaryNotes: user.dietaryNotes ?? '',
  };
}

const sameFields = (a: TextFields, b: TextFields) =>
  (Object.keys(a) as Array<keyof TextFields>).every((key) => a[key] === b[key]);

/** An empty input clears the field on the server. */
const orNull = (value: string) => value.trim() || null;

/** The latest birth date signup accepts, as "YYYY-MM-DD" in local time. */
function latestBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_SIGNUP_AGE);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One settings group: title and a line of context on the left, fields on a card on the right. */
function ProfileSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h2 className="profile-section-title">
          {title}
          {badge}
        </h2>
        <p className="profile-section-description">{description}</p>
      </div>
      <div className="profile-section-body">{children}</div>
    </section>
  );
}

export function ProfilePage() {
  const { currentUser, setCurrentUser } = useAuth();
  const [fields, setFields] = useState<TextFields | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Passport number: only its last four characters are loaded. `passportDraft`
  // is null while showing the masked value, a string while typing a new one.
  const [passportDraft, setPassportDraft] = useState<string | null>(null);
  const [passportRevealed, setPassportRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // currentUser loads asynchronously (see AuthedApp's api.getMe() call), so
  // this page can mount before it's ready — sync the form once it arrives
  // rather than seeding state at first render, which would stay blank.
  useEffect(() => {
    if (currentUser && !fields) {
      setFields(fieldsFrom(currentUser));
      setAvatarUrl(currentUser.avatarUrl);
    }
  }, [currentUser, fields]);

  const hasPassport = currentUser?.passportNumberLast4 != null;
  const dirty =
    !!currentUser &&
    !!fields &&
    (!sameFields(fields, fieldsFrom(currentUser)) ||
      avatarUrl !== currentUser.avatarUrl ||
      (hasPassport ? passportDraft !== null : !!passportDraft?.trim()));

  // Closing the tab or reloading with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // "Saved" shows in the save bar briefly, then the bar goes away.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!currentUser || !fields) return null;

  const editingPassport = !hasPassport || passportDraft !== null;
  const expiryStatus = fields.passportExpiry ? passportExpiryStatus(fields.passportExpiry) : null;
  // Keep a saved currency selectable even if it isn't in the common list
  // (mobile accepts any 3-letter code).
  const currencies =
    fields.homeCurrency && !(COMMON_CURRENCIES as readonly string[]).includes(fields.homeCurrency)
      ? [fields.homeCurrency, ...COMMON_CURRENCIES]
      : COMMON_CURRENCIES;

  const edited = () => {
    setSaved(false);
    setError(null);
  };

  const set = (key: keyof TextFields) => (e: { target: { value: string } }) => {
    setFields({ ...fields, [key]: e.target.value });
    edited();
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
      edited();
    };
    reader.readAsDataURL(file);
  };

  const togglePassport = async () => {
    if (passportRevealed) {
      setPassportRevealed(null);
      return;
    }
    setRevealing(true);
    try {
      const { passportNumber } = await api.getPassportNumber();
      setPassportRevealed(passportNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load passport number');
    } finally {
      setRevealing(false);
    }
  };

  const discard = () => {
    setFields(fieldsFrom(currentUser));
    setAvatarUrl(currentUser.avatarUrl);
    setPassportDraft(null);
    setPassportRevealed(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    if (!fields.name.trim()) {
      setError("Your name can't be empty.");
      return;
    }
    if (fields.dateOfBirth && !isOldEnoughToSignUp(fields.dateOfBirth)) {
      setError(`Date of birth must make you at least ${MIN_SIGNUP_AGE}.`);
      return;
    }

    const update: ProfileUpdate = {
      name: fields.name.trim(),
      dateOfBirth: orNull(fields.dateOfBirth),
      phone: orNull(fields.phone),
      nationality: orNull(fields.nationality),
      passportExpiry: orNull(fields.passportExpiry),
      homeCurrency: orNull(fields.homeCurrency),
      emergencyContactName: orNull(fields.emergencyContactName),
      emergencyContactPhone: orNull(fields.emergencyContactPhone),
      dietaryNotes: orNull(fields.dietaryNotes),
    };
    if (avatarUrl !== currentUser.avatarUrl) update.avatarUrl = avatarUrl;
    // Send the passport only when it's being changed: a new value replaces
    // it, an emptied field removes a saved one.
    if (passportDraft !== null) {
      const draft = orNull(passportDraft);
      if (draft || hasPassport) update.passportNumber = draft;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile(update);
      setCurrentUser(updated);
      setFields(fieldsFrom(updated));
      setAvatarUrl(updated.avatarUrl);
      setPassportDraft(null);
      setPassportRevealed(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const showSaveBar = dirty || saving || saved || !!error;

  return (
    <div className="main main-centered profile-page">
      <h1 className="page-title">Profile</h1>

      <form onSubmit={handleSave} className="profile-form">
        <header className="profile-identity">
          <span className="profile-avatar-preview profile-avatar-lg">
            {avatarUrl ? <img src={avatarUrl} alt="Your profile photo" /> : initials(fields.name || currentUser.name)}
          </span>
          <div className="profile-identity-text">
            <p className="profile-identity-name">{fields.name.trim() || currentUser.name}</p>
            <p className="profile-identity-email">
              {currentUser.email}
              <span className="profile-identity-note"> · Used to sign in</span>
            </p>
            <div className="profile-identity-actions">
              <label className="text-btn">
                {avatarUrl ? 'Change photo' : 'Add photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                  hidden
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  className="text-btn text-btn-danger"
                  onClick={() => {
                    setAvatarUrl(null);
                    edited();
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </header>

        <ProfileSection title="Personal" description="Trip mates see your name, photo and email. Everything else here is private.">
          <label className="field">
            Name
            <input value={fields.name} onChange={set('name')} autoComplete="name" required />
          </label>

          <div className="profile-field-grid">
            <label className="field">
              Date of birth
              <input
                type="date"
                value={fields.dateOfBirth}
                max={latestBirthDate()}
                onChange={set('dateOfBirth')}
                autoComplete="bday"
              />
            </label>

            <label className="field">
              Nationality
              <select value={fields.nationality} onChange={set('nationality')}>
                <option value="">Not set</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            Phone
            <input
              type="tel"
              value={fields.phone}
              onChange={set('phone')}
              autoComplete="tel"
              placeholder="+65 9123 4567"
            />
          </label>
        </ProfileSection>

        <ProfileSection
          title="Travel documents"
          description="For bookings and check-in. The passport number is encrypted and only you can see it."
          badge={
            expiryStatus === 'expired' ? (
              <span className="profile-badge is-expired">Expired</span>
            ) : expiryStatus === 'expiring' ? (
              <span className="profile-badge is-expiring">Under {PASSPORT_MIN_VALID_MONTHS} months left</span>
            ) : null
          }
        >
          <div className="profile-field-grid">
            {editingPassport ? (
              <div className="field">
                <label className="field">
                  Passport number
                  <input
                    value={passportDraft ?? ''}
                    onChange={(e) => {
                      setPassportDraft(e.target.value);
                      edited();
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={24}
                  />
                </label>
                {hasPassport && (
                  <span className="field-hint">
                    Leave empty and save to remove it.{' '}
                    <button type="button" className="text-btn" onClick={() => setPassportDraft(null)}>
                      Keep current
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <div className="field">
                Passport number
                <div className="passport-masked">
                  <span className="passport-masked-value">
                    {passportRevealed ?? maskPassportNumber(currentUser.passportNumberLast4!)}
                  </span>
                  <button type="button" className="text-btn" onClick={togglePassport} disabled={revealing}>
                    {passportRevealed ? 'Hide' : revealing ? 'Loading…' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      setPassportRevealed(null);
                      setPassportDraft('');
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            <label className="field">
              Passport expiry
              <input type="date" value={fields.passportExpiry} onChange={set('passportExpiry')} />
              {expiryStatus === 'expired' && <span className="field-hint">Renew it before your next trip.</span>}
              {expiryStatus === 'expiring' && (
                <span className="field-hint">
                  Many countries refuse entry with under {PASSPORT_MIN_VALID_MONTHS} months left.
                </span>
              )}
            </label>
          </div>
        </ProfileSection>

        <ProfileSection title="Emergency contact" description="Someone to call if something happens on a trip.">
          <div className="profile-field-grid">
            <label className="field">
              Name
              <input value={fields.emergencyContactName} onChange={set('emergencyContactName')} maxLength={100} />
            </label>

            <label className="field">
              Phone
              <input type="tel" value={fields.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
            </label>
          </div>
        </ProfileSection>

        <ProfileSection title="Travel preferences" description="Defaults for new trips and notes for group plans.">
          <label className="field">
            Home currency
            <select value={fields.homeCurrency} onChange={set('homeCurrency')}>
              <option value="">Not set</option>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="field-hint">New trips start in this currency.</span>
          </label>

          <label className="field">
            Dietary or medical notes
            <textarea
              value={fields.dietaryNotes}
              onChange={set('dietaryNotes')}
              rows={3}
              maxLength={500}
              placeholder="e.g. vegetarian, nut allergy"
            />
          </label>
        </ProfileSection>

        {showSaveBar && (
          <div className="profile-save-bar" role="region" aria-label="Save changes">
            <p className={`profile-save-status${error ? ' is-error' : ''}`} aria-live="polite">
              {error ?? (saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved')}
            </p>
            {dirty && (
              <>
                <button type="button" className="text-btn" onClick={discard} disabled={saving}>
                  Discard
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

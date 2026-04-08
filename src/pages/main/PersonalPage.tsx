import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

// Placeholder types for personal ledger contacts
interface PersonalContact {
  contactId: string;
  displayName: string;
  avatarUrl: string | null;
  netAmount: number; // positive = owed to you, negative = you owe
  lastInteraction: Date | null;
}

export function PersonalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showSettled, setShowSettled] = useState(false);

  // TODO: fetch from personalLedger Firestore collection
  const contacts: PersonalContact[] = [];

  const filtered = contacts.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const unsettled = filtered.filter((c) => c.netAmount !== 0);
  const settled = filtered.filter((c) => c.netAmount === 0);

  const totalOwed = unsettled
    .filter((c) => c.netAmount > 0)
    .reduce((sum, c) => sum + c.netAmount, 0);
  const totalOwe = unsettled
    .filter((c) => c.netAmount < 0)
    .reduce((sum, c) => sum + Math.abs(c.netAmount), 0);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('personal.title')}</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            // TODO: open personal lending flow
          }}
        >
          <PlusIcon className="h-4 w-4" />
          {t('common.button.add')}
        </button>
      </div>

      {/* Search */}
      <div className="mt-4">
        <label className="input w-full flex items-center gap-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-base-content/40" />
          <input
            type="text"
            className="grow"
            placeholder={t('personal.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {/* Net Summary */}
      {contacts.length > 0 && (
        <div className="mt-4 flex gap-3">
          <div className="flex-1 rounded-xl bg-success/10 p-3 text-center">
            <p className="text-xs text-success">{t('personal.owedToYouTotal')}</p>
            <p className="text-lg font-bold text-success">NT${totalOwed.toLocaleString()}</p>
          </div>
          <div className="flex-1 rounded-xl bg-warning/10 p-3 text-center">
            <p className="text-xs text-warning">{t('personal.youOweTotal')}</p>
            <p className="text-lg font-bold text-warning">NT${totalOwe.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <div className="mt-12 text-center text-base-content/40">
          <BanknotesIcon className="mx-auto mb-3 h-10 w-10 text-base-content/40" />
          <p>{t('personal.noContacts')}</p>
          <p className="text-sm mt-1">{t('personal.noContactsHint')}</p>
        </div>
      ) : (
        <>
          {/* Unsettled */}
          {unsettled.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t('personal.unsettled')}
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {unsettled
                  .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount))
                  .map((c) => (
                    <ContactCard
                      key={c.contactId}
                      contact={c}
                      onClick={() => navigate(`/personal/${c.contactId}`)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Settled (collapsible) */}
          {settled.length > 0 && (
            <div className="mt-6">
              <button
                className="flex w-full items-center gap-1 text-xs font-semibold text-base-content/50 uppercase tracking-wider"
                onClick={() => setShowSettled(!showSettled)}
              >
                {t('personal.settledSection')}（{settled.length}）
                <ChevronDownIcon
                  className={`h-3 w-3 transition-transform ${showSettled ? 'rotate-180' : ''}`}
                />
              </button>
              {showSettled && (
                <div className="mt-2 flex flex-col gap-2">
                  {settled.map((c) => (
                    <ContactCard
                      key={c.contactId}
                      contact={c}
                      onClick={() => navigate(`/personal/${c.contactId}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ContactCard({
  contact,
  onClick,
}: {
  contact: PersonalContact;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isOwed = contact.netAmount > 0;
  const isSettled = contact.netAmount === 0;

  return (
    <div
      className="card bg-base-200 cursor-pointer transition-colors active:bg-base-300"
      onClick={onClick}
    >
      <div className="card-body p-3 flex-row items-center gap-3">
        <div className="avatar placeholder">
          <div className="w-10 rounded-full bg-neutral text-neutral-content">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt="" />
            ) : (
              <span className="text-sm">{contact.displayName.charAt(0)}</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{contact.displayName}</p>
          {contact.lastInteraction && (
            <p className="text-xs text-base-content/40">
              {t('common.lastInteraction', { time: formatRelativeTime(contact.lastInteraction) })}
            </p>
          )}
        </div>
        <div className="text-right">
          {isSettled ? (
            <span className="inline-flex items-center gap-1 text-sm text-base-content/40">
              <CheckCircleIcon className="h-4 w-4" />
              {t('personal.settled')}
            </span>
          ) : isOwed ? (
            <div>
              <p className="text-xs text-success">{t('personal.owedToYouTotal')}</p>
              <p className="font-bold text-success">NT${contact.netAmount.toLocaleString()}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-warning">{t('personal.youOweTotal')}</p>
              <p className="font-bold text-warning">NT${Math.abs(contact.netAmount).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

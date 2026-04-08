import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export function PersonalContactDetailPage() {
  const { t } = useTranslation();
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [optimalSplit, setOptimalSplit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // TODO: fetch contact data from personalLedger
  const contact = {
    contactId: contactId ?? '',
    displayName: 'Contact',
    avatarUrl: null as string | null,
    netAmount: 0,
  };

  const handleSettleAll = () => {
    if (!window.confirm(t('personal.settleAllConfirm', { name: contact.displayName }))) return;
    // TODO: implement settle all
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => navigate('/personal')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="avatar placeholder">
              <div className="w-8 rounded-full bg-neutral text-neutral-content">
                {contact.avatarUrl ? (
                  <img src={contact.avatarUrl} alt="" />
                ) : (
                  <span className="text-sm">{contact.displayName.charAt(0)}</span>
                )}
              </div>
            </div>
            <h1 className="text-xl font-bold truncate">{contact.displayName}</h1>
          </div>
        </div>

        <div className="dropdown dropdown-end">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => setShowMenu(!showMenu)}
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
          {showMenu && (
            <ul className="dropdown-content menu bg-base-200 rounded-box z-50 w-48 p-2 shadow-lg">
              <li>
                <button onClick={handleSettleAll}>
                  {t('personal.settleAll')}
                </button>
              </li>
              <li>
                <button>{t('personal.editContactName')}</button>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* Net Amount Card */}
      <div className="px-4 mt-2">
        <div className="card bg-base-200">
          <div className="card-body p-4 text-center">
            {contact.netAmount === 0 ? (
              <p className="inline-flex items-center justify-center gap-1 text-base-content/50">
                <CheckCircleIcon className="h-4 w-4" />
                {t('personal.settled')}
              </p>
            ) : contact.netAmount > 0 ? (
              <>
                <p className="text-sm text-success">{t('personal.owedToYouTotal')}</p>
                <p className="text-3xl font-bold text-success">
                  NT${contact.netAmount.toLocaleString()}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-warning">{t('personal.youOweTotal')}</p>
                <p className="text-3xl font-bold text-warning">
                  NT${Math.abs(contact.netAmount).toLocaleString()}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Optimal Split Toggle */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between rounded-xl bg-base-200 p-4">
          <div>
            <p className="font-semibold text-sm">{t('personal.optimalSplit')}</p>
            <p className="text-xs text-base-content/50">{t('personal.optimalSplitDesc')}</p>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={optimalSplit}
            onChange={(e) => setOptimalSplit(e.target.checked)}
          />
        </div>

        {optimalSplit && (
          <div className="mt-2 rounded-xl bg-warning/10 p-3">
            <p className="text-xs text-warning">
              {t('personal.optimalSplitNotFound')}
            </p>
          </div>
        )}
      </div>

      {/* Lending History */}
      <div className="px-4 mt-6 flex-1">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
          {t('personal.lendingHistory')}
        </h2>

        <div className="mt-3 text-center text-base-content/40 py-8">
          <p>{t('personal.noContacts')}</p>
        </div>
      </div>

      {/* Backdrop */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

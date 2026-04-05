import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { Account } from '../types';

interface AccountSearchSelectProps {
  accounts: Account[];
  value?: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
}

const getAccountLabel = (account?: Account) => (
  account ? `${account.code} - ${account.name}` : ''
);

export const AccountSearchSelect: React.FC<AccountSearchSelectProps> = ({
  accounts,
  value = '',
  onChange,
  placeholder = 'Ketik kode atau nama akun...',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const availableAccounts = useMemo(
    () => accounts.filter(account => !account.code.endsWith('.00')),
    [accounts],
  );

  const selectedAccount = useMemo(
    () => availableAccounts.find(account => account.id === value),
    [availableAccounts, value],
  );

  const [query, setQuery] = useState(getAccountLabel(selectedAccount));
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    setQuery(getAccountLabel(selectedAccount));
  }, [selectedAccount]);

  const filteredAccounts = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return availableAccounts.slice(0, 25);
    }

    return availableAccounts.filter(account =>
      `${account.code} ${account.name} ${account.type} ${account.normalBalance}`
        .toLowerCase()
        .includes(keyword),
    ).slice(0, 25);
  }, [availableAccounts, query]);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }

    const selectedIndex = filteredAccounts.findIndex(account => account.id === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : (filteredAccounts.length > 0 ? 0 : -1));
  }, [filteredAccounts, isOpen, value]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;

    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlightedIndex, isOpen]);

  const handleSelect = (account: Account) => {
    onChange(account.id);
    setQuery(getAccountLabel(account));
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={() => {
        window.setTimeout(() => {
          if (!containerRef.current?.contains(document.activeElement)) {
            setIsOpen(false);
            setQuery(getAccountLabel(selectedAccount));
          }
        }, 120);
      }}
    >
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            setIsOpen(true);

            if (!nextValue.trim()) {
              onChange('');
            }
          }}
          onKeyDown={(event) => {
            if (!isOpen && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
              setIsOpen(true);
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (filteredAccounts.length > 0) {
                setHighlightedIndex(prev => (prev < filteredAccounts.length - 1 ? prev + 1 : 0));
              }
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (filteredAccounts.length > 0) {
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredAccounts.length - 1));
              }
            }

            if (event.key === 'Enter' && isOpen && highlightedIndex >= 0 && filteredAccounts[highlightedIndex]) {
              event.preventDefault();
              handleSelect(filteredAccounts[highlightedIndex]);
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setIsOpen(false);
              setQuery(getAccountLabel(selectedAccount));
            }
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          placeholder={placeholder}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-200/80">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account, index) => {
              const isSelected = account.id === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={account.id}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(account);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    isSelected || isHighlighted ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-900">{account.code} - {account.name}</div>
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {account.type} • {account.normalBalance}
                    </div>
                  </div>
                  {isSelected && <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />}
                </button>
              );
            })
          ) : (
            <div className="rounded-xl px-3 py-4 text-sm text-slate-500">
              Tidak ada akun yang cocok dengan kata kunci Anda.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

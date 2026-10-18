'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useTransition } from 'react';
import { ROLE_LABEL, type MemberRole } from '@/lib/auth/roles';
import { signOut } from '@/lib/auth/actions';
import { usePreference, writePreference } from '@/lib/client/stored-preference';
import { initialsFor } from '@/lib/view/logo';

type Theme = 'dark' | 'light' | 'system';
const THEME_KEY = 'emr-theme';
const THEMES: { value: Theme; label: string; Icon: typeof Moon }[] = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
];

function applyTheme(theme: Theme) {
  const light =
    theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
}

/** Avatar initials → name, role, theme and sign out (DESIGN.md §5.1 topbar). */
export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string | null;
  role: MemberRole;
}) {
  const saved = usePreference(THEME_KEY);
  const theme: Theme = saved === 'light' || saved === 'system' ? saved : 'dark';
  const [signingOut, startSignOut] = useTransition();
  const display = name ?? email ?? 'Member';

  const choose = (value: string) => {
    const next = THEMES.find((option) => option.value === value)?.value ?? 'dark';
    applyTheme(next);
    writePreference(THEME_KEY, next);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex size-9 items-center justify-center rounded-full bg-surface-3 type-small font-semibold text-fg motion-colors hover:bg-surface-2">
        <span aria-hidden="true">{initialsFor(display)}</span>
        <span className="sr-only">Account menu for {display}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="pop-panel z-[600] min-w-[240px] rounded-md border border-border-strong bg-surface-3 p-1 shadow-[var(--elevation-pop)]"
        >
          <div className="px-3 py-2">
            <p className="truncate type-body text-fg">{display}</p>
            {email && email !== display ? <p className="truncate type-small text-fg-muted">{email}</p> : null}
            <p className="mt-1 type-small text-fg-muted">{ROLE_LABEL[role]}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-3 py-1 type-micro text-fg-muted">Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={choose}>
            {THEMES.map(({ value, label, Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex h-9 cursor-default items-center gap-2 rounded-sm px-3 type-body text-fg-secondary outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg"
              >
                <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
                {label}
                <DropdownMenu.ItemIndicator className="ml-auto">
                  <Check aria-hidden="true" strokeWidth={1.5} className="size-4 text-accent" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            disabled={signingOut}
            onSelect={() => startSignOut(() => signOut())}
            className="flex h-9 cursor-default items-center gap-2 rounded-sm px-3 type-body text-fg-secondary outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg"
          >
            <LogOut aria-hidden="true" strokeWidth={1.5} className="size-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

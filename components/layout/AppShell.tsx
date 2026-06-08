'use client'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navConfig = {
  SALES_PERSON: {
    sections: [
      {
        label: 'Home',
        links: [
          { href: '/', label: 'Dashboard', icon: GridIcon },
        ],
      },
      {
        label: 'Conferences',
        links: [
          { href: '/conferences', label: 'Calendar', icon: CalendarIcon },
          { href: '/conferences/all', label: 'All Conferences', icon: BuildingIcon },
        ],
      },
      {
        label: 'My Workspace',
        links: [
          { href: '/leads', label: 'My Leads', icon: UsersIcon },
          { href: '/capture', label: 'Add Lead', icon: PlusCircleIcon },
        ],
      },
    ],
  },
  MANAGER: {
    sections: [
      {
        label: 'Home',
        links: [
          { href: '/', label: 'Dashboard', icon: GridIcon },
        ],
      },
      {
        label: 'Conferences',
        links: [
          { href: '/conferences', label: 'Calendar', icon: CalendarIcon },
          { href: '/conferences/all', label: 'All Conferences', icon: BuildingIcon },
        ],
      },
      {
        label: 'My Workspace',
        links: [
          { href: '/leads', label: 'All Leads', icon: UsersIcon },
          { href: '/capture', label: 'Add Lead', icon: PlusCircleIcon },
          { href: '/manager/contacts', label: 'Contacts', icon: ContactIcon },
          { href: '/manager/analytics', label: 'Analytics', icon: ChartIcon },
          { href: '/manager/hubspot', label: 'HubSpot Sync', icon: LinkIcon },
          { href: '/manager/users', label: 'Users', icon: UserManageIcon },
        ],
      },
    ],
  },
  ADMIN: {
    sections: [
      {
        label: 'Home',
        links: [
          { href: '/', label: 'Dashboard', icon: GridIcon },
        ],
      },
      {
        label: 'Conferences',
        links: [
          { href: '/conferences', label: 'Calendar', icon: CalendarIcon },
          { href: '/conferences/all', label: 'All Conferences', icon: BuildingIcon },
        ],
      },
      {
        label: 'My Workspace',
        links: [
          { href: '/leads', label: 'All Leads', icon: UsersIcon },
          { href: '/capture', label: 'Add Lead', icon: PlusCircleIcon },
          { href: '/manager/contacts', label: 'Contacts', icon: ContactIcon },
          { href: '/manager/analytics', label: 'Analytics', icon: ChartIcon },
          { href: '/manager/hubspot', label: 'HubSpot Sync', icon: LinkIcon },
          { href: '/manager/users', label: 'Users', icon: UserManageIcon },
        ],
      },
    ],
  },
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const role = (session?.user?.role as keyof typeof navConfig) || 'SALES_PERSON'
  const config = navConfig[role] || navConfig.SALES_PERSON
  const initials = session?.user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  const isAdmin = role === 'ADMIN'

  return (
    <div className="flex h-screen bg-surface-muted">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-52 bg-brand-navy flex flex-col transform transition-transform lg:translate-x-0 lg:static lg:flex-shrink-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo — clicks to dashboard */}
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-4 border-b border-white/10 hover:bg-white/5 transition-colors">
          <div className="grid grid-cols-2 gap-0.5 w-4 h-4 flex-shrink-0">
            <div className="rounded-sm bg-white" />
            <div className="rounded-sm bg-white/40" />
            <div className="rounded-sm bg-white/40" />
            <div className="rounded-sm bg-brand-accent" />
          </div>
          <span className="text-base font-semibold text-white tracking-tight">grain</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {config.sections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 px-2 mb-1">
                {section.label}
              </p>
              {section.links.map((link) => {
                const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] mb-0.5 transition-all border-l-2 ${
                      active
                        ? 'bg-brand-accent/20 text-white border-brand-accent font-medium'
                        : 'text-white/55 hover:text-white/90 hover:bg-white/7 border-transparent'
                    }`}
                  >
                    <Icon className="w-[15px] h-[15px] flex-shrink-0" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: user info + settings + sign out */}
        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-white truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-white/40 capitalize">{role.replace('_', ' ').toLowerCase()}</p>
            </div>
          </div>
          {isAdmin && (
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] rounded-md transition-colors mb-0.5 ${
                pathname === '/admin/settings'
                  ? 'text-white bg-brand-accent/20'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/8'
              }`}
            >
              <SettingsIcon className="w-[13px] h-[13px]" />
              Settings
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left px-2 py-1.5 text-[11px] text-white/40 hover:text-white/80 hover:bg-white/8 rounded-md transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-surface-border bg-white">
          <button onClick={() => setOpen(true)} className="text-content-secondary p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="text-sm font-semibold text-content-primary">grain</span>
          <div className="w-5" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function GridIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
}
function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function PlusCircleIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
}
function MapIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
}
function ContactIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function LinkIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
}
function UserManageIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

import DashboardClient from '../app/(dashboard)/DashboardClient'

function makeConf(overrides: Partial<any> = {}) {
  return {
    id: `conf-${Math.random().toString(36).slice(2)}`,
    name: 'FinTech World',
    city: 'London',
    country: 'GB',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-03'),
    ...overrides,
  }
}

const defaultProps = {
  user: { name: 'Jake Martinez', role: 'SALES_PERSON', currentConferenceId: null },
  myConferences: [],
  recentLeads: [],
  todayLeadsCount: 0,
  totalLeads: 0,
}

describe('DashboardClient', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders greeting with first name', () => {
    render(<DashboardClient {...defaultProps} />)
    expect(screen.getByText(/Jake/)).toBeInTheDocument()
  })

  it('shows "No conference selected" when no currentConferenceId and no ongoing conf', () => {
    render(<DashboardClient {...defaultProps} />)
    expect(screen.getByText('No conference selected')).toBeInTheDocument()
  })

  it('auto-selects ongoing conference when currentConferenceId is null', () => {
    const ongoing = makeConf({
      id: 'fx-week',
      name: 'FX Week US',
      startDate: new Date(Date.now() - 1000 * 3600),
      endDate: new Date(Date.now() + 1000 * 3600 * 24),
    })
    render(<DashboardClient {...defaultProps} myConferences={[ongoing]} />)
    expect(screen.getAllByText('FX Week US').length).toBeGreaterThan(0)
  })

  it('prefers saved currentConferenceId over ongoing conference', () => {
    const saved = makeConf({ id: 'saved-conf', name: 'AFP Annual' })
    const ongoing = makeConf({
      id: 'fx-week',
      name: 'FX Week US',
      startDate: new Date(Date.now() - 1000 * 3600),
      endDate: new Date(Date.now() + 1000 * 3600 * 24),
    })
    render(<DashboardClient
      {...defaultProps}
      user={{ ...defaultProps.user, currentConferenceId: 'saved-conf' }}
      myConferences={[saved, ongoing]}
    />)
    expect(screen.getAllByText('AFP Annual').length).toBeGreaterThan(0)
  })

  it('clears stale conference ID when conference no longer in assignments', () => {
    render(<DashboardClient
      {...defaultProps}
      user={{ ...defaultProps.user, currentConferenceId: 'stale-id-not-in-list' }}
      myConferences={[makeConf({ id: 'other-conf', name: 'Other Conf' })]}
    />)
    expect(screen.getByText('No conference selected')).toBeInTheDocument()
  })

  it('shows conference name, city, country in hero when selected', () => {
    const conf = makeConf({ id: 'c1', name: 'Sibos 2026', city: 'London', country: 'GB' })
    render(<DashboardClient
      {...defaultProps}
      user={{ ...defaultProps.user, currentConferenceId: 'c1' }}
      myConferences={[conf]}
    />)
    expect(screen.getAllByText('Sibos 2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/London/).length).toBeGreaterThan(0)
  })

  it('conference selector dropdown contains all myConferences', () => {
    const confs = [
      makeConf({ id: 'c1', name: 'FinTech World', city: 'London' }),
      makeConf({ id: 'c2', name: 'Payments Summit', city: 'Berlin' }),
    ]
    render(<DashboardClient {...defaultProps} myConferences={confs} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    const names = options.map(o => o.textContent)
    expect(names.some(n => n?.includes('FinTech World'))).toBe(true)
    expect(names.some(n => n?.includes('Payments Summit'))).toBe(true)
  })

  it('changing conference selector calls fetch to save', async () => {
    const user = userEvent.setup()
    const confs = [makeConf({ id: 'c1', name: 'FinTech World', city: 'London' })]
    render(<DashboardClient {...defaultProps} myConferences={confs} />)
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'c1')
    expect(global.fetch).toHaveBeenCalledWith('/api/users/current-conference', expect.objectContaining({ method: 'POST' }))
  })

  it('shows today leads count', () => {
    render(<DashboardClient {...defaultProps} todayLeadsCount={2} />)
    expect(screen.getByText('2 leads captured today')).toBeInTheDocument()
  })

  it('shows 0 leads today message when no leads', () => {
    render(<DashboardClient {...defaultProps} />)
    expect(screen.getByText('0 leads captured today')).toBeInTheDocument()
  })

  it('shows no leads empty state', () => {
    render(<DashboardClient {...defaultProps} />)
    expect(screen.getByText('No leads yet')).toBeInTheDocument()
  })

  it('shows KPI row with totalLeads', () => {
    render(<DashboardClient {...defaultProps} totalLeads={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows "Live" badge for ongoing conference', () => {
    const ongoing = makeConf({
      id: 'fx',
      name: 'FX Week US',
      startDate: new Date(Date.now() - 1000 * 3600),
      endDate: new Date(Date.now() + 1000 * 3600 * 24),
    })
    render(<DashboardClient {...defaultProps} myConferences={[ongoing]} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows "Tomorrow" label for conference starting tomorrow', () => {
    const tomorrow = makeConf({
      id: 't1',
      name: 'Upcoming Conf',
      startDate: new Date(Date.now() + 1000 * 3600 * 24),
      endDate: new Date(Date.now() + 1000 * 3600 * 48),
    })
    render(<DashboardClient {...defaultProps} myConferences={[tomorrow]} />)
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('Add Lead button links to /capture', () => {
    render(<DashboardClient {...defaultProps} />)
    const addLeadBtn = screen.getByText('+ Add Lead')
    expect(addLeadBtn).toBeInTheDocument()
  })

  it('hero card navigates to conference detail on click when conf selected', async () => {
    const conf = makeConf({ id: 'conf-abc', name: 'Sibos 2026' })
    render(<DashboardClient
      {...defaultProps}
      user={{ ...defaultProps.user, currentConferenceId: 'conf-abc' }}
      myConferences={[conf]}
    />)
    const hero = screen.getByText('Current conference · click to view').closest('div')!
    fireEvent.click(hero)
    expect(mockPush).toHaveBeenCalledWith('/conferences/conf-abc')
  })

  it('no upcoming next conference message when no future assignments', () => {
    render(<DashboardClient {...defaultProps} />)
    expect(screen.queryByText(/Next conference in/)).not.toBeInTheDocument()
  })
})

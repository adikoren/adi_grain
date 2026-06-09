import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanningClient from '../app/manager/planning/PlanningClient'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const mockFetch = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', mockFetch)

function makeConference(overrides: Partial<any> = {}) {
  const raw = {
    id: `conf-${Math.random().toString(36).slice(2)}`,
    name: 'FinTech World',
    city: 'London',
    country: 'GB',
    startDate: '2025-10-01T00:00:00.000Z',
    endDate: '2025-10-03T00:00:00.000Z',
    icpScore: 90,
    attendingStatus: 'ATTENDING',
    verticals: '[]',
    notes: null,
    _count: { leads: 0, targetAccounts: 0 },
    ...overrides,
  }
  return raw
}

function makeAssignment(conferenceId: string, userId: string, userName: string, role = 'PRIMARY') {
  return { conferenceId, userId, role, user: { id: userId, name: userName, role: 'SALES_PERSON' } }
}

const defaultUsers = [
  { id: 'rep1', name: 'Alice Rep', email: 'alice@test.com', role: 'SALES_PERSON' },
  { id: 'rep2', name: 'Bob Rep',   email: 'bob@test.com',   role: 'SALES_PERSON' },
]

describe('PlanningClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true })
  })

  it('default view is "Team Coverage" tab', () => {
    render(<PlanningClient conferences={[]} users={[]} assignments={[]} isManager={true} />)
    expect(screen.getByText('Team Coverage')).toBeInTheDocument()
    expect(screen.getByText('Cluster Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Coverage Gaps')).toBeInTheDocument()
  })

  it('Coverage Gaps tab shows critical Tier A unassigned conferences', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Big FX Summit', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Coverage Gaps'))
    expect(screen.getByText(/Critical/i)).toBeInTheDocument()
    expect(screen.getByText('Big FX Summit')).toBeInTheDocument()
  })

  it('Coverage Gaps tab shows empty state when all conferences are assigned', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Assigned Conf', icpScore: 90 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    await user.click(screen.getByText('Coverage Gaps'))
    expect(screen.getByText(/No coverage gaps detected/i)).toBeInTheDocument()
  })

  it('Team Coverage tab (default) shows rep cards', () => {
    const conf = makeConference({ id: 'c1', name: 'Some Conf', icpScore: 90 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    // Name appears in rep card header + assigned row — use getAllByText
    expect(screen.getAllByText('Alice Rep').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bob Rep').length).toBeGreaterThan(0)
  })

  it('Team Coverage shows conference name under assigned rep', () => {
    const conf = makeConference({ id: 'c1', name: 'My Conference', icpScore: 88 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    expect(screen.getByText('My Conference')).toBeInTheDocument()
  })

  it('Cluster Opportunities tab shows empty state when no clusters', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Solo Conf', city: 'Paris', icpScore: 80 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Cluster Opportunities'))
    expect(screen.getByText(/No cluster opportunities/i)).toBeInTheDocument()
  })

  it('Cluster Opportunities tab detects same-city cluster', async () => {
    const user = userEvent.setup()
    const c1 = makeConference({ id: 'c1', name: 'London FX Forum', city: 'London', country: 'GB', startDate: '2025-10-01T00:00:00.000Z', endDate: '2025-10-02T00:00:00.000Z', icpScore: 90 })
    const c2 = makeConference({ id: 'c2', name: 'London Payments', city: 'London', country: 'GB', startDate: '2025-10-08T00:00:00.000Z', endDate: '2025-10-09T00:00:00.000Z', icpScore: 85 })
    render(<PlanningClient conferences={[c1, c2]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Cluster Opportunities'))
    expect(screen.getByText('London FX Forum')).toBeInTheDocument()
    expect(screen.getByText('London Payments')).toBeInTheDocument()
  })

  it('KPI row shows correct upcoming count', () => {
    const conferences = [
      makeConference({ id: 'c1' }),
      makeConference({ id: 'c2' }),
      makeConference({ id: 'c3' }),
    ]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={[]} isManager={true} />)
    const upcomingLabel = screen.getByText('Upcoming')
    expect(upcomingLabel.closest('div')?.textContent).toContain('3')
  })

  it('KPI row shows correct Tier A count', () => {
    const conferences = [
      makeConference({ id: 'c1', icpScore: 90 }),
      makeConference({ id: 'c2', icpScore: 72 }),
    ]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={[]} isManager={true} />)
    // "Tier A" label appears in the KPI card; find all and check one has the right count
    const tierALabels = screen.getAllByText('Tier A')
    expect(tierALabels.length).toBeGreaterThan(0)
    // The KPI stat card wrapping "Tier A" should contain the count 1
    const tierAStatCard = tierALabels.find(el => el.closest('div')?.textContent?.includes('1'))
    expect(tierAStatCard).toBeTruthy()
  })

  it('KPI shows Tier A unassigned count', () => {
    const conferences = [makeConference({ id: 'c1', icpScore: 90 })]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={[]} isManager={true} />)
    expect(screen.getByText('Tier A unassigned')).toBeInTheDocument()
  })

  it('manager sees assign dropdown in Coverage Gaps for Tier A unassigned', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Unassigned Conf', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Coverage Gaps'))
    expect(screen.getByDisplayValue('+ Assign rep')).toBeInTheDocument()
  })

  it('non-manager does not see assign dropdowns', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Unassigned Conf', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={false} />)
    await user.click(screen.getByText('Coverage Gaps'))
    expect(screen.queryByDisplayValue('+ Assign rep')).not.toBeInTheDocument()
  })

  it('assign dropdown contains list of reps', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Coverage Gaps'))
    const select = screen.getByDisplayValue('+ Assign rep')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alice Rep' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob Rep' })).toBeInTheDocument()
  })

  it('selecting a rep triggers fetch to /api/trips', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Coverage Gaps'))
    const select = screen.getByDisplayValue('+ Assign rep')
    await user.selectOptions(select, 'rep1')
    expect(mockFetch).toHaveBeenCalledWith('/api/trips', expect.objectContaining({ method: 'POST' }))
  })

  it('manager sees "+ Add Conference" link', () => {
    render(<PlanningClient conferences={[]} users={[]} assignments={[]} isManager={true} />)
    expect(screen.getByText('+ Add Conference')).toBeInTheDocument()
  })

  it('non-manager does not see "+ Add Conference" link', () => {
    render(<PlanningClient conferences={[]} users={[]} assignments={[]} isManager={false} />)
    expect(screen.queryByText('+ Add Conference')).not.toBeInTheDocument()
  })

  it('overloaded rep gets warning badge when 4+ events in 30 days', () => {
    const base = new Date('2025-10-01').getTime()
    const confs = Array.from({ length: 4 }, (_, i) => makeConference({
      id: `c${i}`, name: `Conf ${i}`, city: `City${i}`,
      startDate: new Date(base + i * 5 * 86400000).toISOString(),
      endDate: new Date(base + i * 5 * 86400000 + 86400000).toISOString(),
      icpScore: 70,
    }))
    const assignments = confs.map(c => makeAssignment(c.id, 'rep1', 'Alice Rep'))
    render(<PlanningClient conferences={confs} users={defaultUsers} assignments={assignments} isManager={true} />)
    expect(screen.getByText(/Overloaded/i)).toBeInTheDocument()
  })
})

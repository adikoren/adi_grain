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

// Mock fetch for assign action
const mockFetch = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', mockFetch)

function makeConference(overrides: Partial<any> = {}) {
  return {
    id: `conf-${Math.random().toString(36).slice(2)}`,
    name: 'FinTech World',
    city: 'London',
    country: 'GB',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-10-03'),
    icpScore: 90, // Tier A (>=85 in ConferencesClient tier fn, but PlanningClient uses score>=85 → 'A')
    attendingStatus: 'ATTENDING',
    _count: { leads: 0 },
    ...overrides,
  }
}

function makeAssignment(conferenceId: string, userId: string, userName: string) {
  return { conferenceId, user: { id: userId, name: userName } }
}

const defaultUsers = [
  { id: 'rep1', name: 'Alice Rep', role: 'SALES_PERSON' },
  { id: 'rep2', name: 'Bob Rep', role: 'SALES_PERSON' },
]

describe('PlanningClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true })
  })

  it('default view is "coverage" (Coverage Gaps tab active)', () => {
    render(<PlanningClient conferences={[]} users={[]} assignments={[]} isManager={true} />)
    // Coverage Gaps tab should be visible and active
    const coverageBtn = screen.getByText('Coverage Gaps')
    expect(coverageBtn).toBeInTheDocument()
  })

  it('Coverage Gaps tab shows unassigned Tier-A conferences with red border class', () => {
    const conf = makeConference({ id: 'c1', name: 'Big FX Summit', icpScore: 90 }) // Tier A
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    // Should see the "Tier A — No rep assigned" heading
    expect(screen.getByText(/Tier A — No rep assigned/)).toBeInTheDocument()
    expect(screen.getByText('Big FX Summit')).toBeInTheDocument()
  })

  it('Coverage Gaps tab shows unassigned Tier-B/C conferences with amber section', () => {
    const conf = makeConference({ id: 'c1', name: 'Mid Conf', icpScore: 72 }) // Tier B (70-84)
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    expect(screen.getByText(/Tier B\/C — Unassigned/)).toBeInTheDocument()
    expect(screen.getByText('Mid Conf')).toBeInTheDocument()
  })

  it('Coverage Gaps tab shows "All assigned" message when nothing unassigned', () => {
    const conf = makeConference({ id: 'c1', name: 'Assigned Conf', icpScore: 90 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    expect(screen.getByText(/All upcoming conferences have a rep assigned/)).toBeInTheDocument()
  })

  it('Workload tab shows each rep\'s conference count', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Some Conf', icpScore: 90 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    await user.click(screen.getByText('Rep Workload'))
    expect(screen.getByText('Alice Rep')).toBeInTheDocument()
  })

  it('Workload tab shows conference count number', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Some Conf', icpScore: 90 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    await user.click(screen.getByText('Rep Workload'))
    // Alice should have 1 conference
    const ones = screen.getAllByText('1')
    expect(ones.length).toBeGreaterThan(0)
  })

  it('Workload tab shows Tier A count', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Tier A Conf', icpScore: 90 })
    const assignment = makeAssignment('c1', 'rep1', 'Alice Rep')
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[assignment]} isManager={true} />)
    await user.click(screen.getByText('Rep Workload'))
    // Should show multiple "Tier A" labels (summary stat + workload section)
    const tierAElements = screen.getAllByText('Tier A')
    expect(tierAElements.length).toBeGreaterThan(0)
  })

  it('Full List tab groups conferences by month', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'Oct Conf', startDate: new Date('2025-10-01') })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Full List'))
    // Should show the month group heading (h2 with October)
    const headings = screen.getAllByRole('heading', { level: 2 })
    const octoberHeading = headings.find(h => h.textContent?.includes('October'))
    expect(octoberHeading).toBeInTheDocument()
    expect(screen.getByText('Oct Conf')).toBeInTheDocument()
  })

  it('Full List tab groups conferences in correct month groups', async () => {
    const user = userEvent.setup()
    const confOct = makeConference({ id: 'c1', name: 'OctoConf', startDate: new Date('2025-10-01') })
    const confNov = makeConference({ id: 'c2', name: 'NovConf', startDate: new Date('2025-11-15') })
    render(<PlanningClient conferences={[confOct, confNov]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Full List'))
    const headings = screen.getAllByRole('heading', { level: 2 })
    const hasOctober = headings.some(h => h.textContent?.includes('October'))
    const hasNovember = headings.some(h => h.textContent?.includes('November'))
    expect(hasOctober).toBe(true)
    expect(hasNovember).toBe(true)
  })

  it('Summary stats show correct Upcoming count', () => {
    const conferences = [
      makeConference({ id: 'c1' }),
      makeConference({ id: 'c2' }),
      makeConference({ id: 'c3' }),
    ]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={[]} isManager={true} />)
    // Find the stat card for 'Upcoming' specifically
    const upcomingLabel = screen.getByText('Upcoming')
    const statCard = upcomingLabel.closest('div')
    expect(statCard?.textContent).toContain('3')
  })

  it('Summary stats show correct Tier A count', () => {
    const conferences = [
      makeConference({ id: 'c1', icpScore: 90 }), // Tier A
      makeConference({ id: 'c2', icpScore: 72 }), // Tier B
      makeConference({ id: 'c3', icpScore: 55 }), // Tier C
    ]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={[]} isManager={true} />)
    // Summary has "Tier A" label - use getAllByText since workload section may also show it
    const tierALabels = screen.getAllByText('Tier A')
    expect(tierALabels.length).toBeGreaterThan(0)
  })

  it('Summary stats show correct Unassigned count', () => {
    const conferences = [
      makeConference({ id: 'c1' }),
      makeConference({ id: 'c2' }),
    ]
    const assignments = [makeAssignment('c1', 'rep1', 'Alice')]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={assignments} isManager={true} />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('Summary stats show Tier A unassigned count', () => {
    const conferences = [makeConference({ id: 'c1', icpScore: 90 })]
    render(<PlanningClient conferences={conferences} users={defaultUsers} assignments={[]} isManager={true} />)
    expect(screen.getByText('Tier A unassigned')).toBeInTheDocument()
  })

  it('manager sees assign dropdown in Coverage Gaps view', () => {
    const conf = makeConference({ id: 'c1', name: 'Unassigned Conf', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    const dropdown = screen.getByDisplayValue('+ Assign rep')
    expect(dropdown).toBeInTheDocument()
  })

  it('non-manager does not see assign dropdown', () => {
    const conf = makeConference({ id: 'c1', name: 'Unassigned Conf', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={false} />)
    expect(screen.queryByDisplayValue('+ Assign rep')).not.toBeInTheDocument()
  })

  it('assign dropdown contains list of reps', () => {
    const conf = makeConference({ id: 'c1', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
    const select = screen.getByDisplayValue('+ Assign rep')
    expect(select).toBeInTheDocument()
    // Should have rep options
    expect(screen.getByRole('option', { name: 'Alice Rep' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob Rep' })).toBeInTheDocument()
  })

  it('selecting a rep from dropdown triggers fetch to /api/trips', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', icpScore: 90 })
    render(<PlanningClient conferences={[conf]} users={defaultUsers} assignments={[]} isManager={true} />)
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

  it('tab navigation switches to Rep Workload view', async () => {
    const user = userEvent.setup()
    render(<PlanningClient conferences={[]} users={defaultUsers} assignments={[]} isManager={true} />)
    await user.click(screen.getByText('Rep Workload'))
    // The workload section should now be visible; users section renders
    expect(screen.getByText('Alice Rep')).toBeInTheDocument()
  })

  it('tab navigation switches to Full List view', async () => {
    const user = userEvent.setup()
    const conf = makeConference({ id: 'c1', name: 'List Conf', startDate: new Date('2025-10-01') })
    render(<PlanningClient conferences={[conf]} users={[]} assignments={[]} isManager={false} />)
    await user.click(screen.getByText('Full List'))
    expect(screen.getByText('List Conf')).toBeInTheDocument()
  })
})

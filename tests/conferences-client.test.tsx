import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConferencesClient from '../app/(dashboard)/conferences/ConferencesClient'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}))

function makeConference(overrides: Partial<any> = {}) {
  return {
    id: `conf-${Math.random()}`,
    name: 'FinTech World',
    city: 'London',
    country: 'GB', // Europe
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-10-03'),
    verticals: '["PAYMENTS"]',
    buyerPersonas: '["CFO"]',
    estimatedAudience: 3000,
    icpScore: 90, // Tier A (>=85)
    status: 'UPCOMING',
    attendingStatus: 'ATTENDING',
    website: 'https://example.com',
    assignments: [],
    _count: { leads: 5 },
    ...overrides,
  }
}

const defaultProps = {
  conferences: [],
  isManager: false,
  myConferenceIds: [],
  reps: [],
}

describe('ConferencesClient', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders all conferences by default', () => {
    const conferences = [
      makeConference({ id: 'c1', name: 'FinTech World' }),
      makeConference({ id: 'c2', name: 'Payments Summit' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    expect(screen.getByText('FinTech World')).toBeInTheDocument()
    expect(screen.getByText('Payments Summit')).toBeInTheDocument()
  })

  it('search filter narrows results by name', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'FinTech World' }),
      makeConference({ id: 'c2', name: 'Payments Summit' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const searchInput = screen.getByPlaceholderText('Name or city…')
    await user.type(searchInput, 'FinTech')
    expect(screen.getByText('FinTech World')).toBeInTheDocument()
    expect(screen.queryByText('Payments Summit')).not.toBeInTheDocument()
  })

  it('search filter narrows results by city', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'FinTech World', city: 'London' }),
      makeConference({ id: 'c2', name: 'Payments Summit', city: 'Amsterdam' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const searchInput = screen.getByPlaceholderText('Name or city…')
    await user.type(searchInput, 'Amsterdam')
    expect(screen.getByText('Payments Summit')).toBeInTheDocument()
    expect(screen.queryByText('FinTech World')).not.toBeInTheDocument()
  })

  it('tier filter A shows only Tier A conferences (icpScore >= 85)', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'Tier A Conference', icpScore: 90 }),
      makeConference({ id: 'c2', name: 'Tier B Conference', icpScore: 72 }),
      makeConference({ id: 'c3', name: 'Tier C Conference', icpScore: 55 }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const tierSelect = screen.getByDisplayValue('All tiers')
    await user.selectOptions(tierSelect, 'A')
    expect(screen.getByText('Tier A Conference')).toBeInTheDocument()
    expect(screen.queryByText('Tier B Conference')).not.toBeInTheDocument()
    expect(screen.queryByText('Tier C Conference')).not.toBeInTheDocument()
  })

  it('region filter "Europe" shows only European conferences', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'London Conf', country: 'GB' }),
      makeConference({ id: 'c2', name: 'NYC Conf', country: 'US' }),
      makeConference({ id: 'c3', name: 'Singapore Conf', country: 'SG' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const regionSelect = screen.getByDisplayValue('All regions')
    await user.selectOptions(regionSelect, 'Europe')
    expect(screen.getByText('London Conf')).toBeInTheDocument()
    expect(screen.queryByText('NYC Conf')).not.toBeInTheDocument()
    expect(screen.queryByText('Singapore Conf')).not.toBeInTheDocument()
  })

  it('status filter ATTENDING shows only attending conferences', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'We Are Going', attendingStatus: 'ATTENDING' }),
      makeConference({ id: 'c2', name: 'Just Evaluating', attendingStatus: 'EVALUATING' }),
      makeConference({ id: 'c3', name: 'Not Going', attendingStatus: 'NOT_ATTENDING' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const statusSelect = screen.getByDisplayValue('All statuses')
    await user.selectOptions(statusSelect, 'ATTENDING')
    expect(screen.getByText('We Are Going')).toBeInTheDocument()
    expect(screen.queryByText('Just Evaluating')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Going')).not.toBeInTheDocument()
  })

  it('multiple filters combined work correctly', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'Euro FX Conf', country: 'GB', attendingStatus: 'ATTENDING', icpScore: 90 }),
      makeConference({ id: 'c2', name: 'US Payments Conf', country: 'US', attendingStatus: 'ATTENDING', icpScore: 90 }),
      makeConference({ id: 'c3', name: 'Euro Conf Not Going', country: 'GB', attendingStatus: 'NOT_ATTENDING', icpScore: 90 }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    // Filter by Europe AND Attending
    await user.selectOptions(screen.getByDisplayValue('All regions'), 'Europe')
    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'ATTENDING')
    expect(screen.getByText('Euro FX Conf')).toBeInTheDocument()
    expect(screen.queryByText('US Payments Conf')).not.toBeInTheDocument()
    expect(screen.queryByText('Euro Conf Not Going')).not.toBeInTheDocument()
  })

  it('Clear button resets all filters', async () => {
    const user = userEvent.setup()
    const conferences = [
      makeConference({ id: 'c1', name: 'FinTech World', country: 'GB' }),
      makeConference({ id: 'c2', name: 'US Summit', country: 'US' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const searchInput = screen.getByPlaceholderText('Name or city…')
    await user.type(searchInput, 'FinTech')
    // Clear button should now appear
    const clearBtn = screen.getByText(/Clear/)
    await user.click(clearBtn)
    expect(screen.getByText('FinTech World')).toBeInTheDocument()
    expect(screen.getByText('US Summit')).toBeInTheDocument()
  })

  it('empty state shown when no results match filters', async () => {
    const user = userEvent.setup()
    const conferences = [makeConference({ id: 'c1', name: 'FinTech World' })]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    const searchInput = screen.getByPlaceholderText('Name or city…')
    await user.type(searchInput, 'zzznomatch')
    expect(screen.getByText('No upcoming conferences match your filters.')).toBeInTheDocument()
  })

  it('"No rep" warning shown for unassigned conferences', () => {
    const conferences = [makeConference({ id: 'c1', name: 'Unassigned Conf', assignments: [] })]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    expect(screen.getByText('No rep')).toBeInTheDocument()
  })

  it('no "No rep" warning when conference has assignment', () => {
    const conferences = [makeConference({
      id: 'c1', name: 'Assigned Conf',
      assignments: [{ user: { id: 'rep1', name: 'Alice' } }],
    })]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    expect(screen.queryByText('No rep')).not.toBeInTheDocument()
  })

  it('manager sees Edit link on cards', () => {
    const conferences = [makeConference({ id: 'conf1', name: 'My Conference' })]
    render(<ConferencesClient {...defaultProps} conferences={conferences} isManager={true} />)
    const editLinks = screen.getAllByText('Edit')
    expect(editLinks.length).toBeGreaterThan(0)
    expect(editLinks[0].closest('a')).toHaveAttribute('href', '/manager/conferences/conf1/edit')
  })

  it('non-manager does not see Edit link', () => {
    const conferences = [makeConference({ id: 'conf1', name: 'My Conference' })]
    render(<ConferencesClient {...defaultProps} conferences={conferences} isManager={false} />)
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('"Archive" button renders in header', () => {
    render(<ConferencesClient {...defaultProps} />)
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('"Calendar" button renders in header', () => {
    render(<ConferencesClient {...defaultProps} />)
    expect(screen.getByText('Calendar')).toBeInTheDocument()
  })

  it('manager sees "+ Add Conference" button', () => {
    render(<ConferencesClient {...defaultProps} isManager={true} />)
    expect(screen.getByText('+ Add Conference')).toBeInTheDocument()
  })

  it('non-manager does not see "+ Add Conference" button', () => {
    render(<ConferencesClient {...defaultProps} isManager={false} />)
    expect(screen.queryByText('+ Add Conference')).not.toBeInTheDocument()
  })

  it('shows count of filtered vs total conferences', () => {
    const conferences = [
      makeConference({ id: 'c1', name: 'FinTech World' }),
      makeConference({ id: 'c2', name: 'Payments Summit' }),
    ]
    render(<ConferencesClient {...defaultProps} conferences={conferences} />)
    expect(screen.getByText(/2 of 2 upcoming/)).toBeInTheDocument()
  })
})

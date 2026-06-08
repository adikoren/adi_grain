import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsClient from '../app/(dashboard)/leads/LeadsClient'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

function makeLead(overrides: Partial<any> = {}) {
  return {
    id: `lead-${Math.random()}`,
    firstName: 'Alice',
    lastName: 'Smith',
    company: 'Acme Corp',
    jobTitle: 'CFO',
    email: 'alice@acme.com',
    icpScore: 75,
    tags: '[]',
    capturedAt: new Date('2024-06-01').toISOString(),
    hubspotContactId: null,
    capturedBy: null,
    conferences: [],
    ...overrides,
  }
}

describe('LeadsClient', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders all leads by default', () => {
    const leads = [
      makeLead({ id: 'l1', firstName: 'Alice', lastName: 'Smith' }),
      makeLead({ id: 'l2', firstName: 'Bob', lastName: 'Jones' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('search filters by first name', async () => {
    const leads = [
      makeLead({ id: 'l1', firstName: 'Zaralice', lastName: 'Smith', email: 'zaralice@acme.com' }),
      makeLead({ id: 'l2', firstName: 'Bob', lastName: 'Jones', email: 'bob@jones.com' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    const searchInput = screen.getByPlaceholderText('Name, company, email…')
    fireEvent.change(searchInput, { target: { value: 'Zaralice' } })
    // Zaralice Smith link should exist, Bob Jones should not
    expect(screen.getByRole('link', { name: /Zaralice Smith/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Bob Jones/ })).not.toBeInTheDocument()
  })

  it('search filters by last name', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'Alice', lastName: 'Smith' }),
      makeLead({ id: 'l2', firstName: 'Bob', lastName: 'Jones' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    const searchInput = screen.getByPlaceholderText('Name, company, email…')
    await user.type(searchInput, 'Jones')
    expect(screen.getByRole('link', { name: /Bob Jones/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Alice Smith/ })).not.toBeInTheDocument()
  })

  it('search filters by company', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'Alice', lastName: 'Smith', company: 'Acme Corp' }),
      makeLead({ id: 'l2', firstName: 'Bob', lastName: 'Jones', company: 'Stripe' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    const searchInput = screen.getByPlaceholderText('Name, company, email…')
    await user.type(searchInput, 'Stripe')
    expect(screen.getByRole('link', { name: /Bob Jones/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Alice Smith/ })).not.toBeInTheDocument()
  })

  it('warmth filter "Qualified" shows only qualified leads (tags contain demo_requested)', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'AliceQ', lastName: 'Qualified', tags: '["demo_requested"]' }),
      makeLead({ id: 'l2', firstName: 'BobW', lastName: 'Warm', tags: '["fx_pain"]' }),
      makeLead({ id: 'l3', firstName: 'CharlieC', lastName: 'Cold', tags: '[]' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    const warmthSelect = screen.getByDisplayValue('All warmth')
    await user.selectOptions(warmthSelect, 'Qualified')
    expect(screen.getByRole('link', { name: /AliceQ Qualified/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /BobW Warm/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /CharlieC Cold/ })).not.toBeInTheDocument()
  })

  it('warmth filter "Warm" shows only warm leads', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'AliceQ', lastName: 'Qualified', tags: '["demo_requested"]' }),
      makeLead({ id: 'l2', firstName: 'BobW', lastName: 'Warm', tags: '["fx_pain"]' }),
      makeLead({ id: 'l3', firstName: 'CharlieC', lastName: 'Cold', tags: '[]' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    await user.selectOptions(screen.getByDisplayValue('All warmth'), 'Warm')
    expect(screen.getByRole('link', { name: /BobW Warm/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /AliceQ Qualified/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /CharlieC Cold/ })).not.toBeInTheDocument()
  })

  it('warmth filter "Cold" shows only cold leads', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'AliceQ', lastName: 'Qualified', tags: '["demo_requested"]' }),
      makeLead({ id: 'l2', firstName: 'BobC', lastName: 'Cold', tags: '[]' }), // no tags → Cold
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    await user.selectOptions(screen.getByDisplayValue('All warmth'), 'Cold')
    expect(screen.getByRole('link', { name: /BobC Cold/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /AliceQ Qualified/ })).not.toBeInTheDocument()
  })

  it('HubSpot filter "synced" shows only synced leads', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'AliceS', lastName: 'Synced', hubspotContactId: 'hs123' }),
      makeLead({ id: 'l2', firstName: 'BobU', lastName: 'Unsynced', hubspotContactId: null }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    await user.selectOptions(screen.getByDisplayValue('All'), 'synced')
    expect(screen.getByRole('link', { name: /AliceS Synced/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /BobU Unsynced/ })).not.toBeInTheDocument()
  })

  it('HubSpot filter "unsynced" shows only unsynced leads', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'AliceS', lastName: 'Synced', hubspotContactId: 'hs123' }),
      makeLead({ id: 'l2', firstName: 'BobU', lastName: 'Unsynced', hubspotContactId: null }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    await user.selectOptions(screen.getByDisplayValue('All'), 'unsynced')
    expect(screen.getByRole('link', { name: /BobU Unsynced/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /AliceS Synced/ })).not.toBeInTheDocument()
  })

  it('Clear filters resets all filters', async () => {
    const user = userEvent.setup()
    const leads = [
      makeLead({ id: 'l1', firstName: 'AliceX', lastName: 'Unique' }),
      makeLead({ id: 'l2', firstName: 'BobX', lastName: 'Other' }),
    ]
    render(<LeadsClient leads={leads} isManager={false} />)
    await user.type(screen.getByPlaceholderText('Name, company, email…'), 'AliceX')
    // Clear should appear
    const clearBtn = screen.getByText(/Clear/)
    await user.click(clearBtn)
    expect(screen.getByRole('link', { name: /AliceX Unique/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /BobX Other/ })).toBeInTheDocument()
  })

  it('manager sees Rep column header', () => {
    render(<LeadsClient leads={[]} isManager={true} />)
    expect(screen.getByText('Rep')).toBeInTheDocument()
  })

  it('non-manager does not see Rep column header', () => {
    render(<LeadsClient leads={[]} isManager={false} />)
    expect(screen.queryByText('Rep')).not.toBeInTheDocument()
  })

  it('manager sees rep name as clickable link', () => {
    const leads = [makeLead({ id: 'l1', capturedBy: { id: 'rep1', name: 'John Rep' } })]
    render(<LeadsClient leads={leads} isManager={true} />)
    expect(screen.getByText('John Rep')).toBeInTheDocument()
    expect(screen.getByText('John Rep').closest('a')).toHaveAttribute('href', '/users/rep1')
  })

  it('"↩ Met N×" shown for leads at multiple conferences', () => {
    const leads = [makeLead({
      id: 'l1',
      conferences: [
        { conference: { name: 'Conf A', startDate: '2024-01-01' } },
        { conference: { name: 'Conf B', startDate: '2024-06-01' } },
      ],
    })]
    render(<LeadsClient leads={leads} isManager={false} />)
    expect(screen.getByText('↩ Met 2×')).toBeInTheDocument()
  })

  it('no "↩ Met" shown for single conference leads', () => {
    const leads = [makeLead({
      id: 'l1',
      conferences: [{ conference: { name: 'Conf A', startDate: '2024-01-01' } }],
    })]
    render(<LeadsClient leads={leads} isManager={false} />)
    expect(screen.queryByText(/Met \d×/)).not.toBeInTheDocument()
  })

  it('"+N" shown in conference cell for repeat appearances', () => {
    const leads = [makeLead({
      id: 'l1',
      conferences: [
        { conference: { name: 'Conf A', startDate: '2024-01-01' } },
        { conference: { name: 'Conf B', startDate: '2024-06-01' } },
      ],
    })]
    render(<LeadsClient leads={leads} isManager={false} />)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('first conference name shown in conference cell', () => {
    const leads = [makeLead({
      id: 'l1',
      conferences: [
        { conference: { name: 'Primary Conf', startDate: '2024-01-01' } },
      ],
    })]
    render(<LeadsClient leads={leads} isManager={false} />)
    expect(screen.getByText('Primary Conf')).toBeInTheDocument()
  })

  it('shows "—" for conference cell when no conferences', () => {
    const leads = [makeLead({ id: 'l1', conferences: [] })]
    render(<LeadsClient leads={leads} isManager={false} />)
    // Lead data row should have a dash for conference
    const cells = screen.getAllByText('—')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('shows "No leads yet." when leads array is empty', () => {
    render(<LeadsClient leads={[]} isManager={false} />)
    expect(screen.getByText('No leads yet.')).toBeInTheDocument()
  })

  it('shows "No leads match your filters." when filter returns empty', async () => {
    const user = userEvent.setup()
    const leads = [makeLead({ id: 'l1', firstName: 'Alice' })]
    render(<LeadsClient leads={leads} isManager={false} />)
    await user.type(screen.getByPlaceholderText('Name, company, email…'), 'zzznomatch')
    expect(screen.getByText('No leads match your filters.')).toBeInTheDocument()
  })

  it('renders "+ Add Lead" button', () => {
    render(<LeadsClient leads={[]} isManager={false} />)
    expect(screen.getByText('+ Add Lead')).toBeInTheDocument()
  })

  it('HubSpot synced badge shown for synced leads', () => {
    const leads = [makeLead({ id: 'l1', hubspotContactId: 'hs123' })]
    render(<LeadsClient leads={leads} isManager={false} />)
    expect(screen.getByText('✓ Synced')).toBeInTheDocument()
  })
})

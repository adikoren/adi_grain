import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className, onClick }: any) => (
    <a href={href} className={className} onClick={onClick}>{children}</a>
  ),
}))
vi.mock('@/lib/icp-score', () => ({
  scoreIcpBadge: () => ({ label: 'A · 88', tier: 'A', className: 'tier-a' }),
  scoreBreakdown: () => [],
}))

global.fetch = mockFetch

import ConferenceDetailClient from '../app/(dashboard)/conferences/[id]/ConferenceDetailClient'

function makeConference(overrides: Partial<any> = {}) {
  return {
    id: 'conf1', name: 'FX Week US', website: 'https://example.com',
    startDate: new Date('2026-06-08'), endDate: new Date('2026-06-09'),
    city: 'New York', country: 'US',
    verticals: '["FX"]', buyerPersonas: '["CFO"]',
    estimatedAudience: 1200, icpScore: 88,
    status: 'UPCOMING', source: 'MANUAL', notes: null,
    attendingStatus: 'ATTENDING', campaignStatus: 'IN_PROGRESS',
    outboundStatus: 'NOT_STARTED', meetingsScheduled: 3, backupOwner: null,
    assignments: [], leads: [], targetAccounts: [],
    ...overrides,
  }
}

function makeTarget(overrides: Partial<any> = {}) {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    company: 'Stripe', contactName: null, contactRole: null,
    notes: 'Global payments company', priority: 'HIGH', status: 'TO_MEET',
    createdAt: new Date(),
    ...overrides,
  }
}

const defaultProps = {
  conference: makeConference(),
  isManager: false,
  isAssigned: true,
  currentUserId: 'rep1',
  hubspotLogs: [],
}

describe('ConferenceDetailClient — overview tab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders conference name and attending badge', () => {
    render(<ConferenceDetailClient {...defaultProps} />)
    expect(screen.getByText('FX Week US')).toBeInTheDocument()
    expect(screen.getByText('ATTENDING')).toBeInTheDocument()
  })

  it('shows "Live now" badge for ongoing conference', () => {
    const conf = makeConference({
      startDate: new Date(Date.now() - 1000 * 3600),
      endDate: new Date(Date.now() + 1000 * 3600),
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    expect(screen.getByText('Live now')).toBeInTheDocument()
  })

  it('shows "Past event" badge for ended conference', () => {
    const conf = makeConference({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-03'),
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    expect(screen.getByText('Past event')).toBeInTheDocument()
  })

  it('shows "My conference" badge for assigned rep', () => {
    render(<ConferenceDetailClient {...defaultProps} />)
    expect(screen.getByText('My conference')).toBeInTheDocument()
  })

  it('shows website link', () => {
    render(<ConferenceDetailClient {...defaultProps} />)
    const link = screen.getByText('Website').closest('a')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('shows no "No rep assigned" alert when rep is assigned', () => {
    const conf = makeConference({
      assignments: [{ id: 'a1', userId: 'rep1', myFocus: null, user: { id: 'rep1', name: 'Alice', role: 'SALES_PERSON' } }]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    expect(screen.queryByText('No rep assigned')).not.toBeInTheDocument()
  })

  it('shows "No rep assigned" alert when no assignments', () => {
    render(<ConferenceDetailClient {...defaultProps} conference={makeConference({ assignments: [] })} />)
    expect(screen.getByText('No rep assigned')).toBeInTheDocument()
  })

  it('manager sees "No target accounts set" alert', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={true} conference={makeConference({ targetAccounts: [] })} />)
    expect(screen.getByText('No target accounts set')).toBeInTheDocument()
  })

  it('non-manager does not see "No target accounts set" alert', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={false} />)
    expect(screen.queryByText('No target accounts set')).not.toBeInTheDocument()
  })

  it('manager sees Edit Conference button', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={true} />)
    expect(screen.getByText('Edit Conference')).toBeInTheDocument()
  })

  it('non-manager does not see Edit Conference button', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={false} />)
    expect(screen.queryByText('Edit Conference')).not.toBeInTheDocument()
  })
})

describe('ConferenceDetailClient — My Focus tab (rep view)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  function switchToMyFocus() {
    const focusTab = screen.getByText('My Focus')
    fireEvent.click(focusTab)
  }

  it('shows My Focus tab label for reps', () => {
    render(<ConferenceDetailClient {...defaultProps} />)
    expect(screen.getByText('My Focus')).toBeInTheDocument()
  })

  it('shows "No target companies set yet" when no target accounts', () => {
    render(<ConferenceDetailClient {...defaultProps} />)
    switchToMyFocus()
    expect(screen.getByText(/No target companies set yet/)).toBeInTheDocument()
  })

  it('shows target company card with company name', () => {
    const conf = makeConference({ targetAccounts: [makeTarget({ company: 'Stripe', priority: 'HIGH' })] })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    expect(screen.getAllByText('Stripe').length).toBeGreaterThan(0)
  })

  it('shows company notes as description', () => {
    const conf = makeConference({
      targetAccounts: [makeTarget({ company: 'Stripe', notes: 'Global payments infrastructure company' })]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    // Notes appear in both TargetAccountsPanel and MyFocusPanel
    expect(screen.getAllByText('Global payments infrastructure company').length).toBeGreaterThan(0)
  })

  it('shows expected attendee row when contactName is set', () => {
    const conf = makeConference({
      targetAccounts: [makeTarget({ contactName: 'Emily Chen', contactRole: 'Head of Payments' })]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    // "Expected attendee" label is unique to MyFocusPanel
    expect(screen.getByText('Expected attendee')).toBeInTheDocument()
    // contactName appears in multiple panels — verify at least one
    expect(screen.getAllByText('Emily Chen').length).toBeGreaterThan(0)
  })

  it('does not show expected attendee row when contactName is null', () => {
    const conf = makeConference({ targetAccounts: [makeTarget({ contactName: null })] })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    expect(screen.queryByText('Expected attendee')).not.toBeInTheDocument()
  })

  it('shows HIGH priority badge in red', () => {
    const conf = makeConference({ targetAccounts: [makeTarget({ priority: 'HIGH' })] })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    // Multiple HIGH badges appear (TargetAccountsPanel + MyFocusPanel + SuggestedLeadsPanel)
    const badges = screen.getAllByText('HIGH')
    expect(badges.length).toBeGreaterThan(0)
    expect(badges[0].className).toMatch(/red/)
  })

  it('shows MEDIUM priority badge in amber', () => {
    const conf = makeConference({ targetAccounts: [makeTarget({ priority: 'MEDIUM' })] })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    const badges = screen.getAllByText('MEDIUM')
    expect(badges.length).toBeGreaterThan(0)
    expect(badges[0].className).toMatch(/amber/)
  })

  it('sorts HIGH priority targets before MEDIUM', () => {
    const conf = makeConference({
      targetAccounts: [
        makeTarget({ id: 'tm', company: 'AlphaMed', priority: 'MEDIUM' }),
        makeTarget({ id: 'th', company: 'AlphaHigh', priority: 'HIGH' }),
      ]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    // Focus Companies section heading + company names
    const heading = screen.getByText(/Focus Companies/)
    const section = heading.parentElement!
    const text = section.textContent || ''
    const highIdx = text.indexOf('AlphaHigh')
    const medIdx  = text.indexOf('AlphaMed')
    expect(highIdx).toBeGreaterThanOrEqual(0)
    expect(medIdx).toBeGreaterThan(highIdx)
  })

  it('focus textarea auto-saves on blur via fetch', async () => {
    const user = userEvent.setup()
    const conf = makeConference({
      assignments: [{ id: 'a1', userId: 'rep1', myFocus: '', user: { id: 'rep1', name: 'Alice', role: 'SALES_PERSON' } }]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    const textarea = screen.getByPlaceholderText(/What's your goal/)
    await user.click(textarea)
    await user.type(textarea, 'Meet Stripe CFO')
    fireEvent.blur(textarea)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conferences/conf1/focus',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })

  it('shows attending status badge', () => {
    const conf = makeConference({ attendingStatus: 'ATTENDING' })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    expect(screen.getByText('✓ Going')).toBeInTheDocument()
  })
})

describe('ConferenceDetailClient — Suggested Leads panel (rep view)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  function switchToMyFocus() {
    fireEvent.click(screen.getByText('My Focus'))
  }

  it('shows Suggested Leads panel when targets exist', () => {
    const conf = makeConference({ targetAccounts: [makeTarget()] })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    expect(screen.getByText('Suggested Leads')).toBeInTheDocument()
  })

  it('does not show Suggested Leads panel when no targets', () => {
    render(<ConferenceDetailClient {...defaultProps} />)
    switchToMyFocus()
    expect(screen.queryByText('Suggested Leads')).not.toBeInTheDocument()
  })

  it('shows company name in suggested leads', () => {
    const conf = makeConference({ targetAccounts: [makeTarget({ company: 'Adyen' })] })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    expect(screen.getAllByText('Adyen').length).toBeGreaterThan(0)
  })

  it('shows known contact as primary fill button when contactName+contactRole set', () => {
    const conf = makeConference({
      targetAccounts: [makeTarget({ contactName: 'Emily Chen', contactRole: 'Head of Payments' })]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    expect(screen.getAllByText('Emily Chen').length).toBeGreaterThan(0)
    expect(screen.getByText('Fill Form →')).toBeInTheDocument()
  })

  it('known contact primary chip links with their role and name params', () => {
    const conf = makeConference({
      name: 'FX Week US',
      targetAccounts: [makeTarget({ company: 'Stripe', contactName: 'Emily Chen', contactRole: 'Head of Payments' })]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    const fillBtn = screen.getByText('Fill Form →').closest('a')!
    const href = fillBtn.getAttribute('href')!
    const params = new URLSearchParams(href.split('?')[1] || '')
    expect(href).toContain('/capture')
    expect(params.get('company')).toBe('Stripe')
    expect(params.get('jobTitle')).toBe('Head of Payments')
    expect(params.get('firstName')).toBe('Emily')
    expect(params.get('lastName')).toBe('Chen')
  })

  it('does not show known contact row when contactName is null', () => {
    const conf = makeConference({
      targetAccounts: [makeTarget({ contactName: null, contactRole: null })]
    })
    render(<ConferenceDetailClient {...defaultProps} conference={conf} />)
    switchToMyFocus()
    // Generic "Fill Form →" header button is shown, but no contact chip with firstName/lastName
    const fillLink = screen.getByText('Fill Form →').closest('a')!
    const href = fillLink.getAttribute('href')!
    const params = new URLSearchParams(href.split('?')[1] || '')
    expect(params.get('firstName')).toBeFalsy()
    expect(params.get('lastName')).toBeFalsy()
  })
})

describe('ConferenceDetailClient — Planning tab (manager view)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it('shows Planning tab label for manager', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={true} />)
    expect(screen.getByText('Planning')).toBeInTheDocument()
  })

  it('manager sees Target Accounts & Key People panel', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={true} />)
    fireEvent.click(screen.getByText('Planning'))
    expect(screen.getByText('Target Accounts & Key People')).toBeInTheDocument()
  })

  it('manager sees + Add Target button', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={true} />)
    fireEvent.click(screen.getByText('Planning'))
    expect(screen.getByText('+ Add Target')).toBeInTheDocument()
  })

  it('rep does not see + Add Target button', () => {
    render(<ConferenceDetailClient {...defaultProps} isManager={false} />)
    fireEvent.click(screen.getByText('My Focus'))
    expect(screen.queryByText('+ Add Target')).not.toBeInTheDocument()
  })

  it('shows add form when + Add Target clicked', async () => {
    const user = userEvent.setup()
    render(<ConferenceDetailClient {...defaultProps} isManager={true} />)
    fireEvent.click(screen.getByText('Planning'))
    await user.click(screen.getByText('+ Add Target'))
    expect(screen.getByPlaceholderText('Acme Corp')).toBeInTheDocument()
  })
})

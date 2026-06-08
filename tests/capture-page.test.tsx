import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockPush = vi.fn()
const mockBack = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useSearchParams: () => mockSearchParams,
}))

// Mock fetch: different responses per URL
const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('@/lib/icp-score', () => ({
  leadTemperature: (tags: string[]) => {
    if (tags.includes('QUALIFIED')) return 'Qualified'
    if (tags.includes('WARM'))      return 'Warm'
    return 'Cold'
  },
}))

// Mock Fuse.js so fuzzy tests are deterministic
// Must use a regular function (not arrow) because the component calls `new Fuse(...)`.
// Arrow functions cannot be used as constructors.
vi.mock('fuse.js', () => ({
  default: vi.fn().mockImplementation(function(items: any[]) {
    return {
      search: (_query: string) => items.map(item => ({ item, score: 0.1 })),
    }
  }),
}))

// Mock tesseract.js (dynamically imported by the card-scan handler)
const mockCreateWorker = vi.hoisted(() => vi.fn())
vi.mock('tesseract.js', () => ({ createWorker: mockCreateWorker }))

import CapturePage from '../app/(dashboard)/capture/page'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeLead(overrides: Partial<any> = {}) {
  return {
    id: `lead-${Math.random().toString(36).slice(2)}`,
    firstName: 'Alice', lastName: 'Smith',
    company: 'Acme Corp', jobTitle: 'CFO',
    email: 'alice@acme.com', icpScore: 70,
    tags: '[]', hubspotContactId: null,
    conferences: [],
    ...overrides,
  }
}

function makeConf(name = 'FinTech World') {
  return { id: 'conf1', name }
}

function setupFetch(leads: any[], conference = makeConf()) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads }) }
    if (url.includes('/api/users/current-conference')) return { ok: true, json: async () => ({ conference }) }
    return { ok: true, json: async () => ({}) }
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('CapturePage — form rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    setupFetch([])
  })

  it('renders all required form fields', async () => {
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('Add Lead')).toBeInTheDocument())
    expect(screen.getByLabelText(/First name */i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Last name */i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Company */i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Job title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/LinkedIn URL/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument()
  })

  it('shows "Save Lead" submit button', async () => {
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('Save Lead')).toBeInTheDocument())
  })

  it('shows current conference name in subtitle', async () => {
    setupFetch([], makeConf('Money20/20'))
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText(/@ Money20\/20/)).toBeInTheDocument())
  })

  it('shows "Scan Business Card" scan option', async () => {
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('Scan Business Card')).toBeInTheDocument())
  })
})

describe('CapturePage — URL param pre-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupFetch([])
  })

  it('pre-fills company from URL param', async () => {
    mockSearchParams = new URLSearchParams('company=Stripe')
    render(<CapturePage />)
    await waitFor(() => {
      const companyInput = screen.getByLabelText(/Company */i) as HTMLInputElement
      expect(companyInput.value).toBe('Stripe')
    })
  })

  it('pre-fills jobTitle from URL param', async () => {
    mockSearchParams = new URLSearchParams('jobTitle=Head+of+Payments')
    render(<CapturePage />)
    await waitFor(() => {
      const jobInput = screen.getByLabelText(/Job title/i) as HTMLInputElement
      expect(jobInput.value).toBe('Head of Payments')
    })
  })

  it('pre-fills both company and jobTitle from URL params', async () => {
    mockSearchParams = new URLSearchParams('company=Adyen&jobTitle=CFO')
    render(<CapturePage />)
    await waitFor(() => {
      const companyInput = screen.getByLabelText(/Company */i) as HTMLInputElement
      const jobInput = screen.getByLabelText(/Job title/i) as HTMLInputElement
      expect(companyInput.value).toBe('Adyen')
      expect(jobInput.value).toBe('CFO')
    })
  })

  it('uses conferenceId from URL param (skips current-conference API)', async () => {
    mockSearchParams = new URLSearchParams('conferenceId=conf-xyz&conferenceName=FX+Week+US')
    render(<CapturePage />)
    await waitFor(() => {
      expect(screen.getByText(/@ FX Week US/)).toBeInTheDocument()
    })
    // Should NOT have called current-conference when conferenceId is in URL
    const currentConfCalls = mockFetch.mock.calls.filter((c: any) => c[0].includes('current-conference'))
    expect(currentConfCalls.length).toBe(0)
  })

  it('shows conference name from URL param in subtitle', async () => {
    mockSearchParams = new URLSearchParams('conferenceId=c1&conferenceName=Sibos+2026')
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText(/@ Sibos 2026/)).toBeInTheDocument())
  })

  it('empty fields when no URL params', async () => {
    mockSearchParams = new URLSearchParams()
    render(<CapturePage />)
    await waitFor(() => {
      const companyInput = screen.getByLabelText(/Company */i) as HTMLInputElement
      expect(companyInput.value).toBe('')
    })
  })
})

describe('CapturePage — email exact match dedup', () => {
  const existingLead = makeLead({
    id: 'known1', firstName: 'Alice', lastName: 'Smith',
    email: 'alice@acme.com', company: 'Acme Corp',
    conferences: [{ conference: { name: 'FinTech 2024', startDate: '2024-06-01' }, engagementNotes: 'Great chat', capturedAt: '2024-06-01' }],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    setupFetch([existingLead])
  })

  it('shows relationship context banner when email matches existing lead', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'alice@acme.com')
    await waitFor(() => expect(screen.getByText(/You've met Alice before!/)).toBeInTheDocument())
  })

  it('shows "Add to their history" button on match', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'alice@acme.com')
    await waitFor(() => expect(screen.getByText('✓ Add to their history')).toBeInTheDocument())
  })

  it('shows "Create new contact instead" option on email match', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'alice@acme.com')
    await waitFor(() => expect(screen.getByText('Create new contact instead')).toBeInTheDocument())
  })

  it('shows conference history in relationship context', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'alice@acme.com')
    await waitFor(() => expect(screen.getByText('FinTech 2024')).toBeInTheDocument())
  })

  it('shows engagement notes from previous meeting', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'alice@acme.com')
    await waitFor(() => expect(screen.getByText(/"Great chat"/)).toBeInTheDocument())
  })

  it('does NOT show relationship context for unknown email', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'unknown@other.com')
    await waitFor(() => {
      expect(screen.queryByText(/You've met/)).not.toBeInTheDocument()
    })
  })

  it('is case-insensitive for email matching', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'ALICE@ACME.COM')
    await waitFor(() => expect(screen.getByText(/You've met Alice before!/)).toBeInTheDocument())
  })
})

describe('CapturePage — fuzzy name similarity', () => {
  // No conferences → goes to "Similar contacts" inline panel (not RelationshipContext card)
  // RelationshipContext card only shows when the lead HAS past conference history
  const similarLead = makeLead({
    id: 'sim1', firstName: 'John', lastName: 'Smith',
    company: 'PayCo', jobTitle: 'VP Finance', email: null,
    conferences: [],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    setupFetch([similarLead])
  })

  async function renderAndWaitForLeads() {
    const user = userEvent.setup()
    render(<CapturePage />)
    // Wait for the conference subtitle to appear — proves both fetches have
    // resolved and React has re-rendered with allLeads populated.
    await screen.findByText(/@ FinTech World/)
    return user
  }

  it('shows "Similar contacts" panel when name is close to existing lead', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText('Similar contacts')).toBeInTheDocument())
  })

  it('shows similar lead name in the suggestion list', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText('John Smith')).toBeInTheDocument())
  })

  it('shows "Same person?" button for each similar contact', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText('Same person?')).toBeInTheDocument())
  })

  it('clicking "Same person?" toggles to "✓ Same person" selected state', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText('Same person?')).toBeInTheDocument())
    await user.click(screen.getByText('Same person?'))
    await waitFor(() => expect(screen.getByText('✓ Same person')).toBeInTheDocument())
  })

  it('clicking same person again deselects it', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText('Same person?')).toBeInTheDocument())
    await user.click(screen.getByText('Same person?'))
    await waitFor(() => expect(screen.getByText('✓ Same person')).toBeInTheDocument())
    await user.click(screen.getByText('✓ Same person'))
    await waitFor(() => expect(screen.getByText('Same person?')).toBeInTheDocument())
  })

  it('does NOT show similar contacts when only first name typed', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    // No last name → should not trigger fuzzy search
    expect(screen.queryByText('Similar contacts')).not.toBeInTheDocument()
  })

  it('clears similar contacts when name is cleared', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText('Similar contacts')).toBeInTheDocument())
    await user.clear(screen.getByLabelText(/Last name \*/i))
    await waitFor(() => expect(screen.queryByText('Similar contacts')).not.toBeInTheDocument())
  })

  it('shows company and job title of similar contact in suggestion', async () => {
    const user = await renderAndWaitForLeads()
    await user.type(screen.getByLabelText(/First name \*/i), 'John')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Smith')
    await waitFor(() => expect(screen.getByText(/PayCo/)).toBeInTheDocument())
  })
})

describe('CapturePage — warm relationship context card', () => {
  const warmLead = makeLead({
    id: 'warm1', firstName: 'Sarah', lastName: 'Johnson',
    company: 'Revolut', email: 'sarah@revolut.com',
    tags: '["WARM"]',
    conferences: [
      { conference: { name: 'EBAday', startDate: '2025-06-01' }, engagementNotes: 'Interested in FX hedging', capturedAt: '2025-06-01' },
    ],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    setupFetch([warmLead])
  })

  it('shows Warm temperature badge on match', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'sarah@revolut.com')
    await waitFor(() => expect(screen.getByText('Warm')).toBeInTheDocument())
  })

  it('shows how many times previously met', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'sarah@revolut.com')
    await waitFor(() => expect(screen.getByText(/met 1× at conference/)).toBeInTheDocument())
  })

  it('shows company name in context card', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Email/i), 'sarah@revolut.com')
    await waitFor(() => expect(screen.getByText(/Revolut/)).toBeInTheDocument())
  })
})

describe('CapturePage — form validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    setupFetch([])
  })

  it('shows error when required fields missing on submit', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('Save Lead')).toBeInTheDocument())
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument())
  })

  it('requires first name, last name, and company', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('Save Lead')).toBeInTheDocument())
    // Only fill email, no name or company
    await user.type(screen.getByLabelText(/Email/i), 'test@example.com')
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument())
  })
})

describe('CapturePage — form submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('POSTs to /api/leads on submit with required fields', async () => {
    const user = userEvent.setup()
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/leads') && (!opts || opts.method !== 'POST')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('/api/users/current-conference')) return { ok: true, json: async () => ({ conference: null }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/First name */i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/First name */i), 'Bob')
    await user.type(screen.getByLabelText(/Last name */i), 'Jones')
    await user.type(screen.getByLabelText(/Company */i), 'PayCo')
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter((c: any[]) => c[1]?.method === 'POST' && c[0].includes('/api/leads'))
      expect(postCalls.length).toBe(1)
    })
  })

  it('includes mergeLeadId in POST body when "Same person?" selected', async () => {
    // No conferences → shows "Similar contacts" / "Same person?" (not RelationshipContext card)
    const existingLead = makeLead({
      id: 'lead-abc', firstName: 'Bob', lastName: 'Jones', company: 'PayCo',
      conferences: [],
    })
    const user = userEvent.setup()
    let postBody: any
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST' && url.includes('/api/leads')) {
        postBody = JSON.parse(opts.body)
        return { ok: true, json: async () => ({}) }
      }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [existingLead] }) }
      if (url.includes('current-conference')) return { ok: true, json: async () => ({ conference: null }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    // Wait for leads fetch to complete before typing
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/First name \*/i), 'Bob')
    await user.type(screen.getByLabelText(/Last name \*/i), 'Jones')
    await user.type(screen.getByLabelText(/Company \*/i), 'PayCo')
    await waitFor(() => expect(screen.getByText('Same person?')).toBeInTheDocument())
    await user.click(screen.getByText('Same person?'))
    await waitFor(() => expect(screen.getByText('✓ Same person')).toBeInTheDocument())
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => {
      expect(postBody?.mergeLeadId).toBe('lead-abc')
    })
  })

  it('does NOT include mergeLeadId when "Create new contact instead" clicked', async () => {
    const existingLead = makeLead({
      id: 'lead-xyz', firstName: 'Alice', lastName: 'Smith',
      email: 'alice@acme.com', company: 'Acme',
      conferences: [{ conference: { name: 'FinTech', startDate: '2024-01-01' }, engagementNotes: 'Met', capturedAt: '2024-01-01' }],
    })
    const user = userEvent.setup()
    let postBody: any
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST' && url.includes('/api/leads')) {
        postBody = JSON.parse(opts.body)
        return { ok: true, json: async () => ({}) }
      }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [existingLead] }) }
      if (url.includes('current-conference')) return { ok: true, json: async () => ({ conference: null }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/First name */i), 'Alice')
    await user.type(screen.getByLabelText(/Last name */i), 'Smith')
    await user.type(screen.getByLabelText(/Company */i), 'Acme')
    await user.type(screen.getByLabelText(/Email/i), 'alice@acme.com')
    await waitFor(() => expect(screen.getByText('Create new contact instead')).toBeInTheDocument())
    await user.click(screen.getByText('Create new contact instead'))
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => {
      expect(postBody?.mergeLeadId).toBeFalsy()
    })
  })

  it('redirects to / after successful save', async () => {
    const user = userEvent.setup()
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST') return { ok: true, json: async () => ({}) }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('current-conference')) return { ok: true, json: async () => ({ conference: null }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/First name */i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/First name */i), 'Bob')
    await user.type(screen.getByLabelText(/Last name */i), 'Jones')
    await user.type(screen.getByLabelText(/Company */i), 'PayCo')
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })

  it('shows error message on failed save', async () => {
    const user = userEvent.setup()
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST') return { ok: false, json: async () => ({ error: 'Server error' }) }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('current-conference')) return { ok: true, json: async () => ({ conference: null }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/First name */i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/First name */i), 'Bob')
    await user.type(screen.getByLabelText(/Last name */i), 'Jones')
    await user.type(screen.getByLabelText(/Company */i), 'PayCo')
    await user.click(screen.getByText('Save Lead'))
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
  })
})

describe('CapturePage — business card scan (OCR)', () => {
  const mockWorker = {
    recognize: vi.fn(),
    terminate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    setupFetch([])
    mockCreateWorker.mockResolvedValue(mockWorker)
    mockWorker.recognize.mockResolvedValue({ data: { text: '' } })
    mockWorker.terminate.mockResolvedValue(undefined)
  })

  function triggerScan(ocrText: string) {
    mockWorker.recognize.mockResolvedValue({ data: { text: ocrText } })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['img'], 'card.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })
  }

  it('does not show spinner before scan starts', () => {
    render(<CapturePage />)
    expect(screen.queryByText('Scanning card…')).not.toBeInTheDocument()
    expect(screen.getByText('Scan Business Card')).toBeInTheDocument()
  })

  it('shows "Scanning card…" spinner during OCR processing', async () => {
    let resolveRecognize!: (v: any) => void
    mockWorker.recognize.mockReturnValue(new Promise(r => { resolveRecognize = r }))
    render(<CapturePage />)
    triggerScan('irrelevant')
    await waitFor(() => expect(screen.getByText('Scanning card…')).toBeInTheDocument())
    resolveRecognize({ data: { text: '' } })
  })

  it('hides spinner after OCR completes', async () => {
    render(<CapturePage />)
    triggerScan('John Smith\nCFO')
    await waitFor(() => expect(screen.queryByText('Scanning card…')).not.toBeInTheDocument())
    expect(screen.getByText('Scan Business Card')).toBeInTheDocument()
  })

  it('fills firstName and lastName from first line', async () => {
    render(<CapturePage />)
    triggerScan('John Smith\nCFO\nAcme Corp')
    await waitFor(() => {
      expect((screen.getByLabelText(/First name \*/i) as HTMLInputElement).value).toBe('John')
      expect((screen.getByLabelText(/Last name \*/i) as HTMLInputElement).value).toBe('Smith')
    })
  })

  it('fills email extracted from card text', async () => {
    render(<CapturePage />)
    triggerScan('John Smith\njohn@acme.com\nHead of Payments')
    await waitFor(() => {
      expect((screen.getByLabelText(/Email/i) as HTMLInputElement).value).toBe('john@acme.com')
    })
  })

  it('fills phone number extracted from card text', async () => {
    render(<CapturePage />)
    triggerScan('John Smith\n+44 7700 900123\nCFO')
    await waitFor(() => {
      expect((screen.getByLabelText(/Phone/i) as HTMLInputElement).value).toBeTruthy()
    })
  })

  it('handles single-word name (firstName only, lastName empty)', async () => {
    render(<CapturePage />)
    triggerScan('Madonna\nCEO')
    await waitFor(() => {
      expect((screen.getByLabelText(/First name \*/i) as HTMLInputElement).value).toBe('Madonna')
      expect((screen.getByLabelText(/Last name \*/i) as HTMLInputElement).value).toBe('')
    })
  })

  it('handles multi-word last name (everything after first word becomes lastName)', async () => {
    render(<CapturePage />)
    triggerScan('Jean-Paul van der Berg\nCTO')
    await waitFor(() => {
      expect((screen.getByLabelText(/First name \*/i) as HTMLInputElement).value).toBe('Jean-Paul')
      expect((screen.getByLabelText(/Last name \*/i) as HTMLInputElement).value).toBe('van der Berg')
    })
  })

  it('triggers relationship context banner when scanned email matches existing lead', async () => {
    const knownLead = makeLead({
      id: 'ocr-match', firstName: 'Jane', lastName: 'Doe',
      email: 'jane@corp.com',
      conferences: [{ conference: { name: 'EBAday', startDate: '2025-06-01' }, engagementNotes: null, capturedAt: '2025-06-01' }],
    })
    setupFetch([knownLead])
    render(<CapturePage />)
    await screen.findByText(/@ FinTech World/)
    triggerScan('Jane Doe\njane@corp.com\nFlutterwave')
    await waitFor(() => expect(screen.getByText(/You've met Jane before!/)).toBeInTheDocument())
  })

  it('handles OCR failure gracefully — spinner clears, form stays blank', async () => {
    // Set up reject BEFORE rendering, and fire the event directly (not via
    // triggerScan which would overwrite recognize's mock implementation)
    mockWorker.recognize.mockRejectedValue(new Error('OCR engine failed'))
    render(<CapturePage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['img'], 'card.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.queryByText('Scanning card…')).not.toBeInTheDocument())
    expect((screen.getByLabelText(/First name \*/i) as HTMLInputElement).value).toBe('')
  })

  it('calls tesseract createWorker with "eng" language', async () => {
    render(<CapturePage />)
    triggerScan('Alice Lee\nCFO')
    await waitFor(() => expect(mockCreateWorker).toHaveBeenCalledWith('eng'))
  })

  it('terminates the worker after recognition completes', async () => {
    render(<CapturePage />)
    triggerScan('Alice Lee\nCFO')
    await waitFor(() => expect(mockWorker.terminate).toHaveBeenCalled())
  })
})

// ── New tests: company autocomplete + job title chips + AI suggestions ─────────

describe('CapturePage — company autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/leads/companies')) {
        return { ok: true, json: async () => ({ companies: ['Stripe', 'Adyen', 'Revolut'] }) }
      }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('/api/users/current-conference')) return { ok: true, json: async () => ({ conference: { id: 'conf1', name: 'FinTech World' } }) }
      return { ok: true, json: async () => ({}) }
    })
  })

  it('company suggestions appear when typing', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Company */i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Company */i), 'Str')
    await waitFor(() => expect(screen.getByText('Stripe')).toBeInTheDocument())
  })

  it('clicking a suggestion fills the company field', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByLabelText(/Company */i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/Company */i), 'Str')
    await waitFor(() => expect(screen.getByText('Stripe')).toBeInTheDocument())
    await user.click(screen.getByText('Stripe'))
    await waitFor(() => {
      const input = screen.getByLabelText(/Company */i) as HTMLInputElement
      expect(input.value).toBe('Stripe')
    })
  })

  it('job title chip buttons are shown', async () => {
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('CFO')).toBeInTheDocument())
    expect(screen.getByText('VP Finance')).toBeInTheDocument()
    expect(screen.getByText('Head of Payments')).toBeInTheDocument()
  })

  it('clicking a chip sets the job title', async () => {
    const user = userEvent.setup()
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByText('CFO')).toBeInTheDocument())
    // There are multiple "CFO" elements (chip + potentially input), click the chip button
    const cfoChip = screen.getAllByText('CFO').find(el => el.closest('button'))
    await user.click(cfoChip!)
    await waitFor(() => {
      const jobInput = screen.getByLabelText(/Job title/i) as HTMLInputElement
      expect(jobInput.value).toBe('CFO')
    })
  })

  it('person suggestion card appears when URL has both company and jobTitle', async () => {
    mockSearchParams = new URLSearchParams('company=Stripe&jobTitle=CFO')
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/leads/suggest')) return { ok: true, json: async () => ({
        suggestions: { suggestedPerson: { firstName: 'Jane', lastName: 'Doe', confidence: 'high', reasoning: 'Known CFO at Stripe', linkedinHint: null } }
      })}
      if (url.includes('/api/leads/companies')) return { ok: true, json: async () => ({ companies: ['Stripe'] }) }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('/api/users/current-conference')) return { ok: true, json: async () => ({ conference: { id: 'conf1', name: 'FinTech World' } }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByTestId('person-suggestion-card')).toBeInTheDocument())
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument()
  })

  it('accepting person suggestion fills firstName and lastName', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('company=Adyen&jobTitle=CFO')
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/leads/suggest')) return { ok: true, json: async () => ({
        suggestions: { suggestedPerson: { firstName: 'Tom', lastName: 'Wilson', confidence: 'medium', reasoning: 'Likely CFO at Adyen', linkedinHint: null } }
      })}
      if (url.includes('/api/leads/companies')) return { ok: true, json: async () => ({ companies: [] }) }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('/api/users/current-conference')) return { ok: true, json: async () => ({ conference: { id: 'c1', name: 'Sibos' } }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByTestId('person-suggestion-accept')).toBeInTheDocument())
    await user.click(screen.getByTestId('person-suggestion-accept'))
    await waitFor(() => {
      expect((screen.getByLabelText(/First name \*/i) as HTMLInputElement).value).toBe('Tom')
      expect((screen.getByLabelText(/Last name \*/i) as HTMLInputElement).value).toBe('Wilson')
    })
  })

  it('dismissing person suggestion removes the card', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('company=Revolut&jobTitle=COO')
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/leads/suggest')) return { ok: true, json: async () => ({
        suggestions: { suggestedPerson: { firstName: 'Anna', lastName: 'Keller', confidence: 'low', reasoning: 'Possible COO', linkedinHint: null } }
      })}
      if (url.includes('/api/leads/companies')) return { ok: true, json: async () => ({ companies: [] }) }
      if (url.includes('/api/leads')) return { ok: true, json: async () => ({ leads: [] }) }
      if (url.includes('/api/users/current-conference')) return { ok: true, json: async () => ({ conference: null }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<CapturePage />)
    await waitFor(() => expect(screen.getByTestId('person-suggestion-dismiss')).toBeInTheDocument())
    await user.click(screen.getByTestId('person-suggestion-dismiss'))
    await waitFor(() => expect(screen.queryByTestId('person-suggestion-card')).not.toBeInTheDocument())
  })
})

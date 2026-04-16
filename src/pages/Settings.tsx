import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Profile, UserRole } from '../types'

type SettingsTab = 'profile' | 'team' | 'zoho'

const TAB_CONFIG: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'profile',
    label: 'Profile',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10.561 8.073a6.005 6.005 0 013.432 5.142.75.75 0 11-1.498.07 4.5 4.5 0 00-8.99 0 .75.75 0 11-1.498-.07 6.004 6.004 0 013.431-5.142 3.999 3.999 0 115.123 0zM10.5 5a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0z" />
      </svg>
    ),
  },
  {
    key: 'team',
    label: 'Team',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 5.5a3.5 3.5 0 115.898 2.549 5.508 5.508 0 013.034 4.084.75.75 0 11-1.482.235 4.001 4.001 0 00-6.9 0 .75.75 0 01-1.482-.236A5.507 5.507 0 013.102 8.05 3.49 3.49 0 012 5.5zM11 4a.75.75 0 100 1.5 1.5 1.5 0 01.666 2.844.75.75 0 00-.416.672v.352a.75.75 0 00.574.73c1.2.289 2.162 1.2 2.522 2.372a.75.75 0 101.434-.44 5.01 5.01 0 00-2.56-3.012A3 3 0 0011 4zM5.5 4a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    ),
  },
  {
    key: 'zoho',
    label: 'Zoho Connection',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zM1.75 12h12.5a.75.75 0 010 1.5H1.75a.75.75 0 010-1.5z" />
      </svg>
    ),
  },
]

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  rep: 'Rep',
  driver: 'Driver',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-d text-purple border border-purple/30',
  manager: 'bg-blue-d text-blue border border-blue/30',
  rep: 'bg-green-d text-green border border-green/30',
  driver: 'bg-amber-d text-amber border border-amber/30',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, profile, signOut } = useAuth()
  const { showToast } = useToast()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setPhone(profile.phone ?? '')
    }
  }, [profile])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Profile updated', 'success')
    }
    setSaving(false)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      showToast('Signed out', 'info')
    } catch {
      showToast('Failed to sign out', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Name header */}
      <div className="bg-s1 border border-border rounded-lg p-5">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-purple-d text-purple flex items-center justify-center text-xl font-bold shrink-0 border border-purple/30">
            {getInitials(profile?.full_name ?? 'U')}
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">{profile?.full_name}</h2>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Email"
            value={user?.email ?? ''}
            readOnly
            className="opacity-60"
          />
          <div>
            <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">
              Role
            </label>
            <div className="py-2">
              {profile && <RoleBadge role={profile.role} />}
            </div>
          </div>
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+353 ..."
          />
        </div>

        <div className="mt-6">
          <Button variant="green" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-s1 border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-text mb-2">Session</h3>
        <p className="text-xs text-muted mb-4">Sign out of your current session on this device.</p>
        <Button variant="danger" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab() {
  const { profile: currentProfile } = useAuth()
  const { showToast } = useToast()
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('rep')

  const isAdmin = currentProfile?.role === 'admin'

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      showToast('Failed to load team members', 'error')
    } else {
      setMembers((data ?? []) as Profile[])
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', memberId)

    if (error) {
      showToast('Failed to update role', 'error')
    } else {
      showToast('Role updated', 'success')
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
    }
  }

  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', memberId)

    if (error) {
      showToast('Failed to update status', 'error')
    } else {
      showToast(`User ${!currentActive ? 'activated' : 'deactivated'}`, 'success')
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, is_active: !currentActive } : m))
      )
    }
  }

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      showToast('Please enter an email address', 'error')
      return
    }
    showToast('Invite functionality requires Supabase admin setup', 'info')
    setInviteEmail('')
  }

  return (
    <div className="space-y-6">
      {/* Members list */}
      <div className="bg-s1 border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Team Members</h3>

        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-4">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Loading team...
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted">No team members found.</p>
        ) : (
          <div className="space-y-0 divide-y divide-border">
            {members.map((member) => {
              const isSelf = member.id === currentProfile?.id
              return (
                <div key={member.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-s3 text-text flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(member.full_name)}
                  </div>

                  {/* Name + Email */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">
                      {member.full_name}
                      {isSelf && <span className="text-muted font-normal ml-1">(you)</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{member.email}</div>
                  </div>

                  {/* Role */}
                  <div className="shrink-0">
                    {isAdmin && !isSelf ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                        className="bg-s2 border border-border rounded-md py-1 px-2 text-[12px] text-text outline-none focus:border-green/50 transition cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="rep">Rep</option>
                        <option value="driver">Driver</option>
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </div>

                  {/* Active toggle */}
                  <div className="shrink-0 w-20 text-right">
                    {isAdmin && !isSelf ? (
                      <button
                        onClick={() => handleToggleActive(member.id, member.is_active)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                          member.is_active
                            ? 'bg-green-d text-green border border-green/30'
                            : 'bg-red-d text-red border border-red/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-green' : 'bg-red'}`} />
                        {member.is_active ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          member.is_active
                            ? 'bg-green-d text-green border border-green/30'
                            : 'bg-red-d text-red border border-red/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-green' : 'bg-red'}`} />
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invite user */}
      {isAdmin && (
        <div className="bg-s1 border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text mb-1">Invite User</h3>
          <p className="text-xs text-muted mb-4">
            Send an invite to add a new team member.
          </p>
          <div className="flex items-end gap-3">
            <Input
              label="Email Address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1"
            />
            <div>
              <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="bg-s2 border border-border rounded-md py-2 px-3 text-[13px] text-text outline-none focus:border-green/50 transition cursor-pointer"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="rep">Rep</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <Button variant="green" onClick={handleInvite}>
              Send invite
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Zoho Tab ─────────────────────────────────────────────────────────────────

interface ZohoSyncLogEntry {
  id: string
  operation: string
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
  records_processed: number | null
}

interface ZohoCredentials {
  organization_id: string
  client_id: string
  client_secret: string
  refresh_token: string
}

function ZohoTab() {
  const { showToast } = useToast()
  const [connected, setConnected] = useState(false)
  const [creds, setCreds] = useState<ZohoCredentials>({
    organization_id: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
  })
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncLog, setSyncLog] = useState<ZohoSyncLogEntry[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingLog, setLoadingLog] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true)
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'zoho_organization_id',
        'zoho_client_id',
        'zoho_client_secret',
        'zoho_refresh_token',
        'zoho_last_sync',
        'zoho_connected',
      ])

    if (error) {
      showToast('Failed to load Zoho settings', 'error')
    } else if (data) {
      const settings = Object.fromEntries(data.map((d: { key: string; value: string }) => [d.key, d.value]))
      setCreds({
        organization_id: settings['zoho_organization_id'] ?? '',
        client_id: settings['zoho_client_id'] ?? '',
        client_secret: settings['zoho_client_secret'] ?? '',
        refresh_token: settings['zoho_refresh_token'] ?? '',
      })
      setLastSync(settings['zoho_last_sync'] ?? null)
      setConnected(settings['zoho_connected'] === 'true')
    }
    setLoadingSettings(false)
  }, [showToast])

  const fetchSyncLog = useCallback(async () => {
    setLoadingLog(true)
    const { data, error } = await supabase
      .from('zoho_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10)

    if (error) {
      // Table may not exist yet, silently ignore
      setSyncLog([])
    } else {
      setSyncLog((data ?? []) as ZohoSyncLogEntry[])
    }
    setLoadingLog(false)
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchSyncLog()
  }, [fetchSettings, fetchSyncLog])

  const handleSaveCredentials = async () => {
    setSaving(true)

    const entries = [
      { key: 'zoho_organization_id', value: creds.organization_id },
      { key: 'zoho_client_id', value: creds.client_id },
      { key: 'zoho_client_secret', value: creds.client_secret },
      { key: 'zoho_refresh_token', value: creds.refresh_token },
    ]

    let hasError = false
    for (const entry of entries) {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: entry.key, value: entry.value }, { onConflict: 'key' })

      if (error) {
        hasError = true
        showToast(`Failed to save ${entry.key}: ${error.message}`, 'error')
        break
      }
    }

    if (!hasError) {
      showToast('Zoho credentials saved', 'success')
    }
    setSaving(false)
  }

  const handleTestConnection = () => {
    showToast('Connection test is a placeholder -- backend integration required', 'info')
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="bg-s1 border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-text">Connection Status</h3>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              connected
                ? 'bg-green-d text-green border border-green/30'
                : 'bg-red-d text-red border border-red/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green' : 'bg-red'}`} />
            {connected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {lastSync && (
          <p className="text-xs text-muted">
            Last sync: <span className="text-text">{formatTime(lastSync)}</span>
          </p>
        )}
      </div>

      {/* Credentials */}
      <div className="bg-s1 border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Zoho Credentials</h3>

        {loadingSettings ? (
          <div className="flex items-center gap-2 text-muted text-sm py-4">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Loading settings...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Organization ID"
              value={creds.organization_id}
              onChange={(e) => setCreds((prev) => ({ ...prev, organization_id: e.target.value }))}
              placeholder="123456789"
            />
            <Input
              label="Client ID"
              type="password"
              value={creds.client_id}
              onChange={(e) => setCreds((prev) => ({ ...prev, client_id: e.target.value }))}
              placeholder="1000.XXXXXXXXXX"
            />
            <Input
              label="Client Secret"
              type="password"
              value={creds.client_secret}
              onChange={(e) => setCreds((prev) => ({ ...prev, client_secret: e.target.value }))}
              placeholder="xxxxxxxxxxxxxxxx"
            />
            <Input
              label="Refresh Token"
              type="password"
              value={creds.refresh_token}
              onChange={(e) => setCreds((prev) => ({ ...prev, refresh_token: e.target.value }))}
              placeholder="1000.xxxxxxxx.xxxxxxxx"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mt-5">
          <Button variant="green" onClick={handleSaveCredentials} disabled={saving}>
            {saving ? 'Saving...' : 'Save Credentials'}
          </Button>
          <Button variant="default" onClick={handleTestConnection}>
            Test Connection
          </Button>
        </div>
      </div>

      {/* Sync log */}
      <div className="bg-s1 border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Sync Log</h3>

        {loadingLog ? (
          <div className="flex items-center gap-2 text-muted text-sm py-4">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Loading sync log...
          </div>
        ) : syncLog.length === 0 ? (
          <p className="text-sm text-muted">No sync history available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="pb-2 pr-4 font-medium">Operation</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Records</th>
                  <th className="pb-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {syncLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 pr-4 text-text">{entry.operation}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                          entry.status === 'success'
                            ? 'bg-green-d text-green'
                            : entry.status === 'error'
                            ? 'bg-red-d text-red'
                            : 'bg-amber-d text-amber'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted whitespace-nowrap">{formatTime(entry.started_at)}</td>
                    <td className="py-2 pr-4 text-text">{entry.records_processed ?? '-'}</td>
                    <td className="py-2 text-red max-w-[200px] truncate" title={entry.error_message ?? undefined}>
                      {entry.error_message ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const tabContent: Record<SettingsTab, React.ReactNode> = {
    profile: <ProfileTab />,
    team: <TeamTab />,
    zoho: <ZohoTab />,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="h-[54px] shrink-0 bg-s1 border-b border-border flex items-center px-5">
        <h1 className="text-base font-semibold text-text">Settings</h1>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <nav className="w-[200px] shrink-0 bg-bg border-r border-border p-3 flex flex-col gap-1">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-md text-sm transition cursor-pointer ${
                  isActive
                    ? 'bg-s2 text-text border-l-2 border-green font-medium'
                    : 'text-muted hover:text-text hover:bg-s1 border-l-2 border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">{tabContent[activeTab]}</div>
        </div>
      </div>
    </div>
  )
}

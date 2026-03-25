import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { Link } from 'react-router-dom'

export default function Settings() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('user')

  useEffect(() => {
    if (user?.role !== 'admin') return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersData, settingsData, statsData] = await Promise.all([
        api.getUsers(),
        api.getSettings(),
        api.getAdminStats()
      ])
      setUsers(usersData)
      setGeminiApiKey(settingsData.geminiApiKey || '')
      setStats(statsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveApiKey = async () => {
    setError('')
    setSuccess('')
    try {
      await api.updateSettings({ geminiApiKey })
      setSuccess('API key saved successfully!')
    } catch (err) {
      setError(err.message)
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.createUser({ email: newUserEmail, password: newUserPassword, role: newUserRole })
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('user')
      loadData()
      setSuccess('User created successfully!')
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteUser = async (id) => {
    if (!confirm('Are you sure? This will delete all user data.')) return
    setError('')
    try {
      await api.deleteUser(id)
      loadData()
      setSuccess('User deleted successfully!')
    } catch (err) {
      setError(err.message)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl">Admin access required</p>
          <Link to="/" className="text-yellow-400 hover:underline mt-2 inline-block">Go Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      <nav className="bg-[#1a1a2e] border-b border-[#2a2a4e] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <span className="text-3xl">🍌</span>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Nano Banana
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors">Upscaler</Link>
            <Link to="/history" className="text-gray-300 hover:text-white transition-colors">History</Link>
            <span className="text-yellow-400">Settings</span>
            <span className="text-gray-500 pl-4 border-l border-[#3a3a5e] text-sm">{user?.email}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
            {success}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {['users', 'apikey', 'stats'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                tab === t
                  ? 'bg-yellow-400 text-black'
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#2a2a4e]'
              }`}
            >
              {t === 'users' ? '👥 Users' : t === 'apikey' ? '🔑 API Key' : '📊 Stats'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span className="text-4xl animate-spin">🍌</span>
          </div>
        ) : (
          <>
            {tab === 'users' && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-[#2a2a4e]">
                  <h3 className="text-lg font-semibold mb-4">Add New User</h3>
                  <form onSubmit={createUser} className="space-y-4">
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="User email"
                      className="w-full bg-[#0f0f23] border border-[#3a3a5e] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                      required
                    />
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-[#0f0f23] border border-[#3a3a5e] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                      required
                    />
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full bg-[#0f0f23] border border-[#3a3a5e] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-400"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold rounded-xl hover:scale-[1.02] transition-transform"
                    >
                      Create User
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-[#1a1a2e] rounded-2xl border border-[#2a2a4e] overflow-hidden">
                  <div className="p-4 bg-[#0f0f23] border-b border-[#2a2a4e]">
                    <h3 className="font-semibold">All Users ({users.length})</h3>
                  </div>
                  <div className="divide-y divide-[#2a2a4e]">
                    {users.map((u) => (
                      <div key={u.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{u.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {u.role}
                            </span>
                            <span className="text-xs text-gray-500">
                              Joined {new Date(u.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'apikey' && (
              <div className="max-w-2xl bg-[#1a1a2e] rounded-2xl p-6 border border-[#2a2a4e]">
                <h3 className="text-lg font-semibold mb-4">Gemini API Configuration</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Enter your Gemini API key. This key will be used for all image enhancements.
                  Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">Google AI Studio</a>
                </p>
                <div className="space-y-4">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full bg-[#0f0f23] border border-[#3a3a5e] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                  />
                  <button
                    onClick={saveApiKey}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold rounded-xl hover:scale-[1.02] transition-transform"
                  >
                    Save API Key
                  </button>
                </div>
              </div>
            )}

            {tab === 'stats' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a4e]">
                    <p className="text-gray-400 text-sm">Total Images</p>
                    <p className="text-2xl font-bold text-white">{stats.overall?.total_images || 0}</p>
                  </div>
                  <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a4e]">
                    <p className="text-gray-400 text-sm">Total Cost</p>
                    <p className="text-2xl font-bold text-green-400">${stats.overall?.total_cost?.toFixed(4) || '0.00'}</p>
                  </div>
                </div>

                <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4e] overflow-hidden">
                  <div className="p-4 bg-[#0f0f23] border-b border-[#2a2a4e]">
                    <h3 className="font-semibold">Usage by User</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-gray-400 text-sm">
                        <th className="text-left px-4 py-3">User</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-right px-4 py-3">Images</th>
                        <th className="text-right px-4 py-3">Input Tokens</th>
                        <th className="text-right px-4 py-3">Output Tokens</th>
                        <th className="text-right px-4 py-3">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2a4e]">
                      {stats.byUser?.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-3">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">{u.total_images}</td>
                          <td className="px-4 py-3 text-right text-yellow-400">{u.total_input_tokens?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-orange-400">{u.total_output_tokens?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-green-400">${u.total_cost?.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4e] overflow-hidden">
                  <div className="p-4 bg-[#0f0f23] border-b border-[#2a2a4e]">
                    <h3 className="font-semibold">Monthly Usage</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-gray-400 text-sm">
                        <th className="text-left px-4 py-3">Month</th>
                        <th className="text-right px-4 py-3">Images</th>
                        <th className="text-right px-4 py-3">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2a4e]">
                      {stats.monthlyStats?.map((m) => (
                        <tr key={m.month}>
                          <td className="px-4 py-3">{m.month}</td>
                          <td className="px-4 py-3 text-right">{m.total_images}</td>
                          <td className="px-4 py-3 text-right text-green-400">${m.total_cost?.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

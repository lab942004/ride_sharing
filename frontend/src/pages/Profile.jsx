import { useState, useEffect } from 'react'
import { profileAPI, ridesAPI, requestsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router'
import { format } from 'date-fns'

function MyRideCard({ ride, onDelete }) {
  const isFull = ride.availableSeats === 0
  const formattedDate = ride.date ? format(new Date(ride.date), 'dd/MM/yyyy') : 'N/A'
  return (
    <div className="ride-card flex flex-col gap-3">
      <div className="flex justify-between items-center">
        {isFull && (
          <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">FULL</span>
        )}
        <span className="text-xs text-muted font-mono ml-auto">ID: {ride.createdBy?.rollNo || '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="info-pair">
          <span className="label-text">Journey Date</span>
          <span className="value-text">{formattedDate}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">Journey Time</span>
          <span className="value-text">{ride.time || 'N/A'}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">To</span>
          <span className="value-text">{ride.to}</span>
        </div>
        <div className="info-pair">
          <span className="label-text">From</span>
          <span className="value-text">{ride.from}</span>
        </div>
        {ride.vehicleType && (
          <div className="info-pair">
            <span className="label-text">Vehicle</span>
            <span className="value-text capitalize">{ride.vehicleType}</span>
          </div>
        )}
        <div className="info-pair">
          <span className="label-text">Seats Left</span>
          <span className={`value-text ${isFull ? 'text-red-500' : 'text-green-600'}`}>
            {ride.availableSeats}
          </span>
        </div>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-gray-50">
        <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">Your Ride</span>
        <button
          onClick={() => onDelete(ride.id)}
          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [myRides, setMyRides] = useState([])
  const [loadingRides, setLoadingRides] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [profilePicPreview, setProfilePicPreview] = useState('')

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '' })
      setProfilePicPreview(user.profilePic || '')
      setProfilePicFile(null)
    }
    fetchMyRides()
  }, [user])

  useEffect(() => {
    return () => {
      if (profilePicFile && profilePicPreview.startsWith('blob:')) {
        URL.revokeObjectURL(profilePicPreview)
      }
    }
  }, [profilePicFile, profilePicPreview])

  const fetchMyRides = async () => {
    try {
      setLoadingRides(true)
      const res = await ridesAPI.getMyRides()
      const d = res.data.data || res.data
      setMyRides(d.rides || [])
    } catch {
      setMyRides([])
    } finally {
      setLoadingRides(false)
    }
  }

  const handleProfilePicChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setProfilePicFile(file)
    setProfilePicPreview(preview)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('phone', form.phone)
      if (profilePicFile) formData.append('profilePic', profilePicFile)

      const res = await profileAPI.update(formData)
      const d = res.data.data || res.data
      updateUser(d.user || d)
      setProfilePicPreview(d.user?.profilePic || d.profilePic || profilePicPreview)
      setProfilePicFile(null)
      toast.success('Profile updated!')
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error('Passwords do not match'); return
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters'); return
    }
    try {
      setChangingPwd(true)
      await profileAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      toast.success('Password changed successfully!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setShowPasswordSection(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setChangingPwd(false)
    }
  }

  const handleDeleteRide = async (id) => {
    if (!confirm('Delete this ride?')) return
    try {
      await ridesAPI.delete(id)
      toast.success('Ride deleted')
      fetchMyRides()
    } catch {
      toast.error('Failed to delete ride')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const initial = user?.name?.[0]?.toUpperCase() || '?'

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      {/* ── Profile Card ── */}
      <div className="card p-8 mb-10">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary flex items-center justify-center flex-shrink-0 shadow-btn">
            {profilePicPreview ? (
              <img src={profilePicPreview} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-3xl font-bold text-white">{initial}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                {editing ? (
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="input-field text-xl font-semibold mb-2"
                  />
                ) : (
                  <h2 className="font-display text-2xl font-bold text-charcoal">{user?.name}</h2>
                )}
                <p className="text-muted text-sm mt-1">{user?.email}</p>
                <p className="text-muted text-sm">
                  Roll No: <span className="font-semibold text-charcoal">{user?.rollNo}</span>
                </p>
              </div>

              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn-outline text-sm py-2 px-4 self-start"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {/* Phone */}
            <div className="mt-4">
              <label className="label-text">Phone</label>
              {editing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="input-field mt-1"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="value-text mt-1">{user?.phone || 'Not set'}</p>
              )}
            </div>

            {editing && (
              <>
                <div className="mt-4">
                  <label className="label-text">Profile Photo</label>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="btn-outline text-sm py-2 px-4 cursor-pointer">
                      Choose photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePicChange}
                        className="hidden"
                      />
                    </label>
                    {profilePicPreview ? (
                      <span className="text-sm text-muted">Photo ready to upload</span>
                    ) : (
                      <span className="text-sm text-muted">No file selected</span>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row gap-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 px-4 w-full sm:w-auto">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-outline text-sm py-2 px-4 w-full sm:w-auto">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-gray-100">
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-primary">{myRides.length}</p>
            <p className="text-xs text-muted mt-1">Rides Created</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-primary">
              {user?.isVerified ? '✓' : '✗'}
            </p>
            <p className="text-xs text-muted mt-1">Verified</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-bold text-primary break-all">
              {user?.domain || 'NITKKR'}
            </p>
            <p className="text-xs text-muted mt-1">Domain</p>
          </div>
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className="card p-6 mb-10">
        <button
          onClick={() => setShowPasswordSection(v => !v)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="font-display text-lg font-bold text-charcoal">Change Password</h3>
          <span className="text-primary text-sm font-semibold">{showPasswordSection ? 'Hide ▲' : 'Show ▼'}</span>
        </button>
        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <input
              type="password"
              placeholder="Current Password"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
              className="input-field"
              required
            />
            <input
              type="password"
              placeholder="New Password"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
              className="input-field"
              required
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={passwordForm.confirmNewPassword}
              onChange={e => setPasswordForm(p => ({ ...p, confirmNewPassword: e.target.value }))}
              className="input-field"
              required
            />
            <button type="submit" disabled={changingPwd} className="btn-primary py-2.5 px-6 disabled:opacity-60">
              {changingPwd ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>

      {/* ── My Rides ── */}
      <div>
        <h2 className="font-display text-2xl font-bold text-charcoal mb-6">My Rides</h2>
        {loadingRides ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : myRides.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <div className="text-4xl mb-3">🚗</div>
            <p>You haven't created any rides yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myRides.map(ride => (
              <MyRideCard key={ride.id} ride={ride} onDelete={handleDeleteRide} />
            ))}
          </div>
        )}
      </div>

      {/* ── Logout ── */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
        >
          Log out of account →
        </button>
      </div>
    </div>
  )
}

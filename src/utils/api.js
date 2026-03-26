export const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token')
    const headers = {
      ...options.headers
    }
    
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(endpoint, {
      ...options,
      headers
    })

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  },

  login: (email, password) => api.request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),

  getUsers: () => api.request('/api/users'),
  
  createUser: (data) => api.request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  deleteUser: (id) => api.request(`/api/users/${id}`, { method: 'DELETE' }),

  getSettings: () => api.request('/api/settings'),

  updateSettings: (data) => api.request('/api/settings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  enhance: async (file, scaleFactor, options = {}, onProgress) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('image', file)
    formData.append('scaleFactor', scaleFactor)
    if (options.sharpness) formData.append('sharpness', options.sharpness)
    if (options.removeObjects) formData.append('removeObjects', options.removeObjects)
    if (options.aspectRatio) formData.append('aspectRatio', options.aspectRatio)

    const res = await fetch('/api/enhance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  },

  getImages: () => api.request('/api/images'),

  downloadImage: (id) => {
    const token = localStorage.getItem('token')
    window.open(`/api/images/${id}/download?token=${token}`, '_blank')
  },

  getUserStats: () => api.request('/api/stats/user'),

  getAdminStats: () => api.request('/api/stats/admin')
}

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { Link } from 'react-router-dom'

export default function History() {
  const { user } = useAuth()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    try {
      const data = await api.getImages()
      setImages(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (id) => {
    api.downloadImage(id)
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
            <Link to="/" className="text-gray-300 hover:text-white transition-colors">
              Upscaler
            </Link>
            <span className="text-yellow-400">History</span>
            {user?.role === 'admin' && (
              <Link to="/settings" className="text-gray-300 hover:text-white transition-colors">
                Settings
              </Link>
            )}
            <span className="text-gray-500 pl-4 border-l border-[#3a3a5e] text-sm">{user?.email}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Image History</h2>

        {loading ? (
          <div className="text-center py-12">
            <span className="text-4xl animate-spin">🍌</span>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12 bg-[#1a1a2e] rounded-2xl border border-[#2a2a4e]">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-400">No images yet</p>
            <Link to="/" className="text-yellow-400 hover:underline mt-2 inline-block">
              Enhance your first image
            </Link>
          </div>
        ) : (
          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4e] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0f0f23]">
                <tr>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Preview</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Original</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Scale</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Tokens In</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Tokens Out</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Cost</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Date</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {images.map((img) => (
                  <tr key={img.id} className="border-t border-[#2a2a4e] hover:bg-[#2a2a4e]/30">
                    <td className="px-6 py-4">
                      {img.status === 'completed' && img.enhanced_name ? (
                        <button
                          onClick={() => setSelectedImage(img)}
                          className="w-12 h-12 rounded-lg overflow-hidden hover:ring-2 hover:ring-yellow-400 transition-all"
                        >
                          <img src={`/uploads/${img.enhanced_name}`} alt="Preview" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{img.original_name || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-sm ${
                        img.scale_factor === '4K' ? 'bg-purple-500/20 text-purple-400' :
                        img.scale_factor === '2K' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {img.scale_factor}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-yellow-400">{img.input_tokens?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-orange-400">{img.output_tokens?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-green-400">${img.cost?.toFixed(4) || '0.00'}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(img.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {img.status === 'completed' ? (
                        <button
                          onClick={() => handleDownload(img.id)}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <span>💾</span> Download
                        </button>
                      ) : img.status === 'failed' ? (
                        <span className="text-red-400">Failed</span>
                      ) : (
                        <span className="text-yellow-400">Processing...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
          <div className="bg-[#1a1a2e] rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{selectedImage.original_name}</h3>
              <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <img src={`/uploads/${selectedImage.enhanced_name}`} alt="Enhanced" className="w-full rounded-xl" />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-[#0f0f23] p-3 rounded-lg">
                <p className="text-gray-400 text-sm">Scale</p>
                <p className="text-white font-medium">{selectedImage.scale_factor}</p>
              </div>
              <div className="bg-[#0f0f23] p-3 rounded-lg">
                <p className="text-gray-400 text-sm">Input Tokens</p>
                <p className="text-yellow-400 font-medium">{selectedImage.input_tokens?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-[#0f0f23] p-3 rounded-lg">
                <p className="text-gray-400 text-sm">Output Tokens</p>
                <p className="text-orange-400 font-medium">{selectedImage.output_tokens?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-[#0f0f23] p-3 rounded-lg">
                <p className="text-gray-400 text-sm">Cost</p>
                <p className="text-green-400 font-medium">${selectedImage.cost?.toFixed(4) || '0.00'}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedImage(null)}
                className="px-4 py-2 bg-[#2a2a4e] text-white rounded-lg hover:bg-[#3a3a5e]"
              >
                Close
              </button>
              <button
                onClick={() => handleDownload(selectedImage.id)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                💾 Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

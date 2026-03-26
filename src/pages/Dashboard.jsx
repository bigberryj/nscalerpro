import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [scaleFactor, setScaleFactor] = useState('1K')
  const [sharpness, setSharpness] = useState('normal')
  const [removeObjects, setRemoveObjects] = useState('')
  const [aspectRatio, setAspectRatio] = useState('original')
  const [images, setImages] = useState([])
  const [processingIndex, setProcessingIndex] = useState(-1)
  const [lastResult, setLastResult] = useState(null)
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)

  const fetchStats = async () => {
    try {
      const data = await api.getUserStats()
      setStats(data)
    } catch (err) {
      console.error(err)
    }
  }

  useState(() => {
    fetchStats()
  }, [])

  const handleFileSelect = (files) => {
    const fileList = files ? Array.from(files) : []
    if (fileList.length === 0) return
    
    const validFiles = fileList.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError('Please select image files only')
        return false
      }
      if (file.size > 20 * 1024 * 1024) {
        setError('File size must be less than 20MB')
        return false
      }
      return true
    })
    
    if (validFiles.length === 0) return
    
    setError(null)
    setResult(null)
    setImages(validFiles)
    
    if (validFiles.length === 1) {
      setImage(validFiles[0])
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(validFiles[0])
    } else {
      setImage(null)
      setPreview(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    dropZoneRef.current?.classList.remove('dragover')
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    dropZoneRef.current?.classList.add('dragover')
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    dropZoneRef.current?.classList.remove('dragover')
  }

  const handleUpscale = async () => {
    const filesToProcess = images.length > 0 ? images : (image ? [image] : [])
    if (filesToProcess.length === 0) return
    
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      if (filesToProcess.length === 1) {
        const data = await api.enhance(filesToProcess[0], scaleFactor, { sharpness, removeObjects, aspectRatio })
        setResult(data)
        setLastResult(data)
      } else {
        const results = []
        for (let i = 0; i < filesToProcess.length; i++) {
          setProcessingIndex(i)
          try {
            const data = await api.enhance(filesToProcess[i], scaleFactor, { sharpness, removeObjects, aspectRatio })
            results.push(data)
          } catch (err) {
            console.error(`Failed to process image ${i + 1}:`, err)
          }
        }
        setResult({ multiple: true, results })
        setProcessingIndex(-1)
      }
      fetchStats()
      setImages([])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setProcessingIndex(-1)
    }
  }

  const clearImage = () => {
    setImage(null)
    setPreview(null)
    setResult(null)
    setLastResult(null)
    setImages([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getImageCount = () => images.length > 0 ? images.length : (image ? 1 : 0)

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      <nav className="bg-[#1a1a2e] border-b border-[#2a2a4e] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍌</span>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Nano Banana
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/history" className="text-gray-300 hover:text-white transition-colors">
              History
            </Link>
            {user?.role === 'admin' && (
              <Link to="/settings" className="text-gray-300 hover:text-white transition-colors">
                Settings
              </Link>
            )}
            <div className="flex items-center gap-3 pl-4 border-l border-[#3a3a5e]">
              <span className="text-gray-400 text-sm">{user?.email}</span>
              <button
                onClick={logout}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a4e]">
              <p className="text-gray-400 text-sm">Total Images</p>
              <p className="text-2xl font-bold text-white">{stats.total_images}</p>
            </div>
            <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a4e]">
              <p className="text-gray-400 text-sm">Input Tokens</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.total_input_tokens?.toLocaleString()}</p>
            </div>
            <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a4e]">
              <p className="text-gray-400 text-sm">Output Tokens</p>
              <p className="text-2xl font-bold text-orange-400">{stats.total_output_tokens?.toLocaleString()}</p>
            </div>
            <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a4e]">
              <p className="text-gray-400 text-sm">Total Cost</p>
              <p className="text-2xl font-bold text-green-400">${stats.total_cost?.toFixed(4)}</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-[#2a2a4e]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📤</span> Original Image
            </h2>
            
            {!preview && images.length === 0 ? (
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="upload-zone rounded-xl p-12 text-center cursor-pointer min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-[#3a3a5e] hover:border-yellow-400 transition-colors"
              >
                <div className="text-5xl mb-4">🖼️</div>
                <p className="text-lg font-medium text-gray-300">Drop image here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse (multiple allowed)</p>
              </div>
            ) : images.length > 1 ? (
              <div className="relative">
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0, 6).map((file, idx) => (
                    <div key={idx} className="relative aspect-square bg-[#0f0f23] rounded-lg overflow-hidden">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={`Upload ${idx + 1}`} 
                        className="w-full h-full object-cover"
                      />
                      {idx === 5 && images.length > 6 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold">
                          +{images.length - 6}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={clearImage}
                  className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
                <p className="text-center text-gray-400 mt-2">{images.length} images selected</p>
              </div>
            ) : (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full rounded-xl" />
                <button
                  onClick={clearImage}
                  className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-[#2a2a4e]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>✨</span> Enhanced Result
            </h2>
            
            {!result ? (
              <div className="rounded-xl p-12 text-center min-h-[300px] flex flex-col items-center justify-center bg-[#0f0f23] border-2 border-dashed border-[#3a3a5e]">
                <div className="text-5xl mb-4">🔮</div>
                <p className="text-gray-400">Result will appear here</p>
              </div>
            ) : (
              <div className="relative">
                <img src={result.enhancedUrl} alt="Enhanced" className="w-full rounded-xl" />
                <div className="mt-4 p-3 bg-[#0f0f23] rounded-lg">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="text-gray-400">Input</p>
                      <p className="text-yellow-400">{result.inputTokens?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Output</p>
                      <p className="text-orange-400">{result.outputTokens?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Cost</p>
                      <p className="text-green-400">${result.cost}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-[#1a1a2e] rounded-2xl p-6 border border-[#2a2a4e]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {['1K', '2K', '4K'].map((res) => (
                <button
                  key={res}
                  onClick={() => setScaleFactor(res)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    scaleFactor === res
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-black'
                      : 'bg-[#0f0f23] text-gray-300 hover:bg-[#2a2a4e]'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-gray-400 text-sm">Sharpness:</span>
              {['normal', 'extra-sharp'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSharpness(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    sharpness === s
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-black'
                      : 'bg-[#0f0f23] text-gray-300 hover:bg-[#2a2a4e]'
                  }`}
                >
                  {s === 'normal' ? 'Normal' : 'Extra Sharp'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Remove:</span>
              <input
                type="text"
                value={removeObjects}
                onChange={(e) => setRemoveObjects(e.target.value)}
                placeholder="e.g. person, car, watermark"
                className="bg-[#0f0f23] border border-[#3a3a5e] rounded-lg px-3 py-2 text-white text-sm w-48 focus:border-yellow-400 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-gray-400 text-sm">Aspect:</span>
              {['original', 'landscape', 'portrait'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    aspectRatio === ratio
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-black'
                      : 'bg-[#0f0f23] text-gray-300 hover:bg-[#2a2a4e]'
                  }`}
                >
                  {ratio === 'original' ? 'Original' : ratio === 'landscape' ? 'Landscape' : 'Portrait'}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              {result && (
                <a
                  href={result.enhancedUrl}
                  download={`nano-banana-${scaleFactor.toLowerCase()}.png`}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl flex items-center gap-2"
                >
                  💾 Download
                </a>
              )}
              <button
                onClick={handleUpscale}
                disabled={loading || !image}
                className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02] transition-transform"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">🍌</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Enhance Image
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

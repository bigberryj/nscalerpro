import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'nano-banana-secret-key-2025'
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
  : process.env.BASE_URL || ''

const db = new Database(path.join(__dirname, 'database.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_name TEXT,
    enhanced_name TEXT,
    original_path TEXT,
    enhanced_path TEXT,
    scale_factor TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

const ensureSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
ensureSetting.run('admin_email', 'admin@nano-banana.com')
ensureSetting.run('gemini_api_key', '')

const uploadDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images allowed'))
  }
})

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(uploadDir))

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) return res.status(401).json({ error: 'Access token required' })
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' })
    req.user = user
    next()
  })
}

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' })
  
  res.json({ 
    token, 
    user: { id: user.id, email: user.email, role: user.role }
  })
})

app.post('/api/auth/register', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, role = 'user' } = req.body
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(400).json({ error: 'Email already exists' })
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10)
  const id = uuidv4()
  
  db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(id, email, hashedPassword, role)
  
  res.json({ message: 'User created successfully', user: { id, email, role } })
})

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params
  
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' })
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot delete admin users' })
  }
  
  db.prepare('DELETE FROM images WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  
  res.json({ message: 'User deleted successfully' })
})

app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC').all()
  res.json(users)
})

app.get('/api/settings', authenticateToken, requireAdmin, (req, res) => {
  const apiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key')
  const adminEmail = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_email')
  
  res.json({
    geminiApiKey: apiKey?.value || '',
    adminEmail: adminEmail?.value || ''
  })
})

app.post('/api/settings', authenticateToken, requireAdmin, (req, res) => {
  const { geminiApiKey, adminEmail } = req.body
  
  if (geminiApiKey !== undefined) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(geminiApiKey, 'gemini_api_key')
  }
  if (adminEmail !== undefined) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(adminEmail, 'admin_email')
  }
  
  res.json({ message: 'Settings updated successfully' })
})

app.post('/api/enhance', authenticateToken, upload.single('image'), async (req, res) => {
  const { scaleFactor, sharpness, removeObjects } = req.body
  const apiKeySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key')
  const apiKey = apiKeySetting?.value
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured. Contact admin.' })
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' })
  }
  
  const imageId = uuidv4()
  const imagePath = req.file.path
  const imageBuffer = fs.readFileSync(imagePath)
  const imageBase64 = imageBuffer.toString('base64')
  const mimeType = req.file.mimetype
  
  db.prepare('INSERT INTO images (id, user_id, original_name, original_path, scale_factor, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    imageId, req.user.id, req.file.originalname, imagePath, scaleFactor, 'processing'
  )
  
  try {
    let prompt = ''
    
    const resolution = scaleFactor === '1K' ? '1024x1024' : scaleFactor === '2K' ? '2048x2048' : '4096x4096'
    
    if (removeObjects && removeObjects.trim()) {
      const objectsToRemove = removeObjects.trim()
      prompt = `Remove ${objectsToRemove} from this image.`
    } else if (sharpness === 'extra-sharp') {
      prompt = `You are an expert AI image enhancement model. Analyze this image and recreate it at higher resolution (${resolution}) with:
- Extra sharp/ crisp details
- Enhanced clarity and definition
- Improved texture and edge sharpness
- Maximum detail preservation
- Professional quality enhancement
Preserve the original content, colors, and composition exactly. Do not add any text, watermarks, or new elements.`
    } else {
      prompt = `You are an expert AI image enhancement model. Analyze this image and recreate it at higher resolution (${resolution}) with improved quality, sharper details, and enhanced clarity. Preserve the original content, colors, and composition exactly. Make it look like a high-quality professional photograph. Do not add any text, watermarks, or new elements.`
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are an image editing assistant. Edit images as requested and return the edited image." }]
          },
          contents: [{
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      }
    )
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed')
    }
    
    const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'))
    
    if (!imagePart) {
      throw new Error('No image in response')
    }
    
    const inputTokens = data.usageMetadata?.promptTokenCount || 0
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0
    
    const inputCost = (inputTokens / 1000000) * 0.075
    const outputCost = (outputTokens / 1000000) * 0.30
    const cost = inputCost + outputCost
    
    const enhancedBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const enhancedFilename = `enhanced-${imageId}.png`
    const enhancedPath = path.join(uploadDir, enhancedFilename)
    fs.writeFileSync(enhancedPath, enhancedBuffer)
    
    db.prepare('UPDATE images SET enhanced_name = ?, enhanced_path = ?, status = ?, input_tokens = ?, output_tokens = ?, cost = ? WHERE id = ?').run(
      enhancedFilename, enhancedPath, 'completed', inputTokens, outputTokens, cost, imageId
    )
    
    res.json({
      id: imageId,
      enhancedUrl: `/uploads/${enhancedFilename}`,
      inputTokens,
      outputTokens,
      cost: cost.toFixed(4),
      status: 'completed'
    })
    
  } catch (error) {
    db.prepare('UPDATE images SET status = ? WHERE id = ?').run('failed', imageId)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/images', authenticateToken, (req, res) => {
  const images = db.prepare(`
    SELECT id, original_name, enhanced_name, scale_factor, input_tokens, output_tokens, cost, status, created_at 
    FROM images 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(req.user.id)
  
  res.json(images)
})

app.get('/api/images/:id/download', authenticateToken, (req, res) => {
  const image = db.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  
  if (!image || !image.enhanced_path) {
    return res.status(404).json({ error: 'Image not found' })
  }
  
  res.download(image.enhanced_path, image.enhanced_name)
})

app.get('/api/stats/user', authenticateToken, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_images,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(cost), 0) as total_cost
    FROM images 
    WHERE user_id = ? AND status = 'completed'
  `).get(req.user.id)
  
  res.json(stats)
})

app.get('/api/stats/admin', authenticateToken, requireAdmin, (req, res) => {
  const byUser = db.prepare(`
    SELECT 
      u.id, u.email, u.role,
      COUNT(i.id) as total_images,
      COALESCE(SUM(i.input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(i.output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(i.cost), 0) as total_cost
    FROM users u
    LEFT JOIN images i ON u.id = i.user_id AND i.status = 'completed'
    GROUP BY u.id
    ORDER BY total_cost DESC
  `).all()
  
  const monthlyStats = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as total_images,
      COALESCE(SUM(cost), 0) as total_cost
    FROM images 
    WHERE status = 'completed'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all()
  
  const overall = db.prepare(`
    SELECT 
      COUNT(*) as total_images,
      COALESCE(SUM(cost), 0) as total_cost
    FROM images 
    WHERE status = 'completed'
  `).get()
  
  res.json({ byUser, monthlyStats, overall })
})

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(express.static(path.join(__dirname, 'dist')))
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const initAdmin = () => {
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get()
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('Bigb2347!@2025', 10)
    db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(
      uuidv4(), 'admin@nano-banana.com', hashedPassword, 'admin'
    )
    console.log('Admin user created: admin@nano-banana.com / Bigb2347!@2025')
  }
}

initAdmin()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log('Admin credentials: admin@nano-banana.com / Bigb2347!@2025')
})

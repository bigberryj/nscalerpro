import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { Pool } from 'pg'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

console.log('[START] Server starting...')
console.log('[CONFIG] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
console.log('[CONFIG] RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH || 'NOT SET')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'nano-banana-secret-key-2025'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set!')
  process.exit(1)
}

console.log('=== SERVER STARTING ===')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
console.log('RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH || 'NOT SET')
console.log('PORT:', process.env.PORT || '3001')
console.log('=== END SERVER CONFIG ===')

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err)
})

const storageDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname

const uploadDir = path.join(storageDir, 'uploads')
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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  const user = result.rows[0]
  
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
  
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Email already exists' })
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10)
  const id = uuidv4()
  
  await pool.query(
    'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)',
    [id, email, hashedPassword, role]
  )
  
  res.json({ message: 'User created successfully', user: { id, email, role } })
})

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params
  
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' })
  }
  
  const user = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  if (user.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  if (user.rows[0].role === 'admin') {
    return res.status(400).json({ error: 'Cannot delete admin users' })
  }
  
  await pool.query('DELETE FROM images WHERE user_id = $1', [id])
  await pool.query('DELETE FROM users WHERE id = $1', [id])
  
  res.json({ message: 'User deleted successfully' })
})

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const users = await pool.query('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC')
  res.json(users.rows)
})

app.get('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  const apiKey = await pool.query("SELECT value FROM settings WHERE key = 'gemini_api_key'")
  const adminEmail = await pool.query("SELECT value FROM settings WHERE key = 'admin_email'")
  
  res.json({
    geminiApiKey: apiKey.rows[0]?.value || '',
    adminEmail: adminEmail.rows[0]?.value || ''
  })
})

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { geminiApiKey, adminEmail } = req.body
  
  if (geminiApiKey !== undefined) {
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'gemini_api_key'", [geminiApiKey])
  }
  if (adminEmail !== undefined) {
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'admin_email'", [adminEmail])
  }
  
  res.json({ message: 'Settings updated successfully' })
})

app.post('/api/enhance', authenticateToken, upload.single('image'), async (req, res) => {
  const { scaleFactor, sharpness, removeObjects } = req.body
  
  const apiKeyResult = await pool.query("SELECT value FROM settings WHERE key = 'gemini_api_key'")
  const apiKey = apiKeyResult.rows[0]?.value
  
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
  
  await pool.query(
    'INSERT INTO images (id, user_id, original_name, original_path, scale_factor, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [imageId, req.user.id, req.file.originalname, imagePath, scaleFactor, 'processing']
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
    
    await pool.query(
      'UPDATE images SET enhanced_name = $1, enhanced_path = $2, status = $3, input_tokens = $4, output_tokens = $5, cost = $6 WHERE id = $7',
      [enhancedFilename, enhancedPath, 'completed', inputTokens, outputTokens, cost, imageId]
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
    await pool.query('UPDATE images SET status = $1 WHERE id = $2', ['failed', imageId])
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/images', authenticateToken, async (req, res) => {
  const images = await pool.query(
    'SELECT id, original_name, enhanced_name, scale_factor, input_tokens, output_tokens, cost, status, created_at FROM images WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  )
  res.json(images.rows)
})

app.get('/api/images/:id/download', authenticateToken, async (req, res) => {
  const image = await pool.query('SELECT * FROM images WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  
  if (image.rows.length === 0 || !image.rows[0].enhanced_path) {
    return res.status(404).json({ error: 'Image not found' })
  }
  
  res.download(image.rows[0].enhanced_path, image.rows[0].enhanced_name)
})

app.get('/api/stats/user', authenticateToken, async (req, res) => {
  const stats = await pool.query(
    `SELECT 
      COUNT(*) as total_images,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(cost), 0) as total_cost
    FROM images 
    WHERE user_id = $1 AND status = 'completed'`,
    [req.user.id]
  )
  res.json(stats.rows[0])
})

app.get('/api/stats/admin', authenticateToken, requireAdmin, async (req, res) => {
  const byUser = await pool.query(`
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
  `)
  
  const monthlyStats = await pool.query(`
    SELECT 
      to_char(created_at, 'YYYY-MM') as month,
      COUNT(*) as total_images,
      COALESCE(SUM(cost), 0) as total_cost
    FROM images 
    WHERE status = 'completed'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `)
  
  const overall = await pool.query(`
    SELECT 
      COUNT(*) as total_images,
      COALESCE(SUM(cost), 0) as total_cost
    FROM images 
    WHERE status = 'completed'
  `)
  
  res.json({ byUser: byUser.rows, monthlyStats: monthlyStats.rows, overall: overall.rows[0] })
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

async function initDb() {
  console.log('Initializing database...')
  
  try {
    const client = await pool.connect()
    console.log('Connected to PostgreSQL successfully')
    client.release()
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `)
    console.log('Settings table created')
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('Users table created')
    
    await pool.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `)
    console.log('Images table created')
    
    await pool.query("INSERT INTO settings (key, value) VALUES ('admin_email', 'byron@geekshop.ca') ON CONFLICT (key) DO NOTHING")
    await pool.query("INSERT INTO settings (key, value) VALUES ('gemini_api_key', '') ON CONFLICT (key) DO NOTHING")
    console.log('Settings upserted')
    
    const adminExists = await pool.query("SELECT id FROM users WHERE role = 'admin'")
    if (adminExists.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('Bigb2347!@2025', 10)
      await pool.query(
        'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)',
        [uuidv4(), 'byron@geekshop.ca', hashedPassword, 'admin']
      )
      console.log('Admin user created: byron@geekshop.ca / Bigb2347!@2025')
    } else {
      console.log('Admin user already exists')
    }
  } catch (err) {
    console.error('Database init error:', err.message)
    throw err
  }
}
}

async function startServer() {
  await initDb()
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
    console.log('Admin credentials: byron@geekshop.ca / Bigb2347!@2025')
  })
}

startServer()
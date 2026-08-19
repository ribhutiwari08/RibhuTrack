import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 5000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

app.use(cors({ origin: process.env.FRONTEND_URL?.split(',').map(s => s.trim()) || true }));
app.use(express.json());

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS batches (id SERIAL PRIMARY KEY, name TEXT NOT NULL, course TEXT, level TEXT, schedule TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE, name TEXT NOT NULL, join_date DATE NOT NULL, status TEXT DEFAULT 'Active', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS classes (id SERIAL PRIMARY KEY, batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE, class_date DATE NOT NULL, start_time TIME, end_time TIME, topic TEXT NOT NULL, taught TEXT, homework TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS attendance (id SERIAL PRIMARY KEY, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, student_id INTEGER REFERENCES students(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late')), remarks TEXT, UNIQUE(class_id, student_id));
  `);
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { req.teacher = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: 'Invalid or expired session' }); }
}

app.get('/api/health', (_, res) => res.json({ ok: true, app: 'RibhuTrack' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: 'Name, email and 6+ character password are required' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query('INSERT INTO teachers(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email', [name, email.toLowerCase(), hash]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ message: e.code === '23505' ? 'Email already registered' : e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM teachers WHERE email=$1', [email?.toLowerCase()]);
  const teacher = rows[0];
  if (!teacher || !(await bcrypt.compare(password || '', teacher.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
  const token = jwt.sign({ id: teacher.id, name: teacher.name, email: teacher.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
});

app.get('/api/dashboard', auth, async (_, res) => {
  const [b, s, c, a] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM batches'),
    pool.query("SELECT COUNT(*)::int AS count FROM students WHERE status='Active'"),
    pool.query("SELECT COUNT(*)::int AS count FROM classes WHERE class_date=CURRENT_DATE"),
    pool.query("SELECT COUNT(*) FILTER (WHERE status='Present')::int AS present, COUNT(*)::int AS total FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.class_date=CURRENT_DATE")
  ]);
  const attendance = a.rows[0].total ? Math.round((a.rows[0].present / a.rows[0].total) * 100) : 0;
  res.json({ batches: b.rows[0].count, students: s.rows[0].count, todayClasses: c.rows[0].count, attendance });
});

app.get('/api/batches', auth, async (_, res) => res.json((await pool.query('SELECT b.*, COUNT(s.id)::int AS student_count FROM batches b LEFT JOIN students s ON s.batch_id=b.id AND s.status=\'Active\' GROUP BY b.id ORDER BY b.created_at DESC')).rows));
app.post('/api/batches', auth, async (req,res)=>{ const {name,course,level,schedule}=req.body; const {rows}=await pool.query('INSERT INTO batches(name,course,level,schedule) VALUES($1,$2,$3,$4) RETURNING *',[name,course,level,schedule]); res.status(201).json(rows[0]); });
app.put('/api/batches/:id', auth, async (req,res)=>{ const {name,course,level,schedule}=req.body; const {rows}=await pool.query('UPDATE batches SET name=$1,course=$2,level=$3,schedule=$4 WHERE id=$5 RETURNING *',[name,course,level,schedule,req.params.id]); res.json(rows[0]); });
app.delete('/api/batches/:id', auth, async (req,res)=>{ await pool.query('DELETE FROM batches WHERE id=$1',[req.params.id]); res.status(204).end(); });

app.get('/api/batches/:id/students', auth, async (req,res)=>res.json((await pool.query('SELECT * FROM students WHERE batch_id=$1 ORDER BY status DESC,name',[req.params.id])).rows));
app.post('/api/students', auth, async (req,res)=>{ const {batch_id,name,join_date,status='Active',notes}=req.body; const {rows}=await pool.query('INSERT INTO students(batch_id,name,join_date,status,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',[batch_id,name,join_date,status,notes]); res.status(201).json(rows[0]); });
app.put('/api/students/:id', auth, async (req,res)=>{ const {name,join_date,status,notes}=req.body; const {rows}=await pool.query('UPDATE students SET name=$1,join_date=$2,status=$3,notes=$4 WHERE id=$5 RETURNING *',[name,join_date,status,notes,req.params.id]); res.json(rows[0]); });
app.delete('/api/students/:id', auth, async (req,res)=>{ await pool.query('DELETE FROM students WHERE id=$1',[req.params.id]); res.status(204).end(); });

app.get('/api/classes', auth, async (_,res)=>res.json((await pool.query('SELECT c.*,b.name AS batch_name FROM classes c JOIN batches b ON b.id=c.batch_id ORDER BY c.class_date DESC,c.start_time DESC')).rows));
app.post('/api/classes', auth, async (req,res)=>{ const {batch_id,class_date,start_time,end_time,topic,taught,homework,notes}=req.body; const {rows}=await pool.query('INSERT INTO classes(batch_id,class_date,start_time,end_time,topic,taught,homework,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[batch_id,class_date,start_time,end_time,topic,taught,homework,notes]); res.status(201).json(rows[0]); });
app.put('/api/classes/:id', auth, async (req,res)=>{ const {batch_id,class_date,start_time,end_time,topic,taught,homework,notes}=req.body; const {rows}=await pool.query('UPDATE classes SET batch_id=$1,class_date=$2,start_time=$3,end_time=$4,topic=$5,taught=$6,homework=$7,notes=$8 WHERE id=$9 RETURNING *',[batch_id,class_date,start_time,end_time,topic,taught,homework,notes,req.params.id]); res.json(rows[0]); });
app.delete('/api/classes/:id', auth, async (req,res)=>{ await pool.query('DELETE FROM classes WHERE id=$1',[req.params.id]); res.status(204).end(); });

app.get('/api/classes/:id/attendance', auth, async (req,res)=>res.json((await pool.query(`SELECT s.id,s.name,s.batch_id,COALESCE(a.status,'Absent') AS status,COALESCE(a.remarks,'') AS remarks FROM students s JOIN classes c ON c.batch_id=s.batch_id LEFT JOIN attendance a ON a.student_id=s.id AND a.class_id=$1 WHERE c.id=$1 ORDER BY s.name`,[req.params.id])).rows));
app.post('/api/classes/:id/attendance', auth, async (req,res)=>{ const client=await pool.connect(); try { await client.query('BEGIN'); for(const item of req.body){ await client.query(`INSERT INTO attendance(class_id,student_id,status,remarks) VALUES($1,$2,$3,$4) ON CONFLICT(class_id,student_id) DO UPDATE SET status=EXCLUDED.status,remarks=EXCLUDED.remarks`,[req.params.id,item.student_id,item.status,item.remarks||'']); } await client.query('COMMIT'); res.json({saved:true}); } catch(e){await client.query('ROLLBACK');res.status(400).json({message:e.message});} finally{client.release();} });

app.get('/api/students/:id/history', auth, async (req,res)=>res.json((await pool.query(`SELECT c.class_date,c.topic,a.status,a.remarks,b.name AS batch_name FROM attendance a JOIN classes c ON c.id=a.class_id JOIN batches b ON b.id=c.batch_id WHERE a.student_id=$1 ORDER BY c.class_date DESC`,[req.params.id])).rows));

initDb().then(()=>app.listen(port,()=>console.log(`RibhuTrack API running on ${port}`))).catch(err=>{console.error(err);process.exit(1)});

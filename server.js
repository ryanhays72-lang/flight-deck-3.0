import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const supabase = createClient(
  'https://mbudctajjjjhmnxjqccq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1idWRjdGFqampqaG1ueGpxY2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTUyNDAsImV4cCI6MjA5NDM5MTI0MH0.B7n-WKSEt7JhrJSLwF6XfmSKp8JlAbOMEA0yBHUnNRw'
  
);

app.get('/', (req, res) => {
  res.sendFile('LOGIN.HTML', { root: '.' });
});

// =======================
// AUTH
// =======================
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;

  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, role }
    }
  });

  if (error) return res.status(400).json({ error: error.message });

  if (role === 'instructor') {
    await supabase.from('instructors').insert([{
      id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      email
    }]);
  }

  if (role === 'student') {
    await supabase.from('students').insert([{
      id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      stage: 'PPL'
    }]);
  }

  if (role === 'renter') {
    await supabase.from('renters').insert([{
      id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      email
    }]);
  }

  res.json({
    user: { id: data.user.id, email, firstName, lastName, role }
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(400).json({ error: error.message });

  const user = data.user;
  const meta = user.user_metadata;

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: meta.first_name,
      lastName: meta.last_name,
      role: meta.role || 'instructor'
    }
  });
});

// =======================
// AIRCRAFT
// =======================
app.get('/api/aircraft', async (req, res) => {
  const { data, error } = await supabase
    .from('aircraft')
    .select('*');

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

app.post('/api/aircraft', async (req, res) => {
  const { nNumber, model, hobbs } = req.body;

  const { data, error } = await supabase
    .from('aircraft')
    .insert([
      {
        id: crypto.randomUUID(),
        n_number: nNumber,
        model,
        hobbs: hobbs || 0,
        status: 'airworthy'
      }
    ])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data[0]);
});

// =======================
// STUDENTS
// =======================
app.get('/api/students', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*');

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

app.post('/api/students', async (req, res) => {
  const { firstName, lastName, email, stage } = req.body;

  const { data, error } = await supabase
    .from('students')
    .insert([
      {
        id: crypto.randomUUID(),
        first_name: firstName,
        last_name: lastName,
        email,
        stage: stage || 'PPL'
      }
    ])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data[0]);
});

// =======================
// FLIGHTS
// =======================
app.get('/api/flights', async (req, res) => {
  const { data, error } = await supabase
    .from('flights')
    .select('*');

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

app.post('/api/flights', async (req, res) => {
  const { studentId, instructorId, aircraftId, date, time, duration } = req.body;

  if (!studentId || !aircraftId || !date || !time) {
    return res.status(400).json({
      error: 'Student, aircraft, date, and time are required'
    });
  }

  try {
    const { data: existingFlights, error: checkError } = await supabase
      .from('flights')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .eq('date', date)
      .eq('time', time)
      .neq('status', 'cancelled');

    if (checkError) {
      return res.status(400).json({ error: checkError.message });
    }

    if (existingFlights.length > 0) {
      return res.status(409).json({
        error: 'Aircraft already booked for that date and time'
      });
    }

    const { data, error } = await supabase
      .from('flights')
      .insert([
        {
          id: crypto.randomUUID(),
          student_id: studentId,
          instructor_id: instructorId || null,
          aircraft_id: aircraftId,
          date,
          time,
          duration: duration || 2,
          status: 'scheduled'
        }
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// RENTERS
// =======================
app.get('/api/renters', async (req, res) => {
  const { data, error } = await supabase.from('renters').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/renters', async (req, res) => {
  const { firstName, lastName, email } = req.body;

  const { data, error } = await supabase
    .from('renters')
    .insert([{
      id: crypto.randomUUID(),
      first_name: firstName,
      last_name: lastName,
      email
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// =======================
// INSTRUCTORS
// =======================
app.get('/api/instructors', async (req, res) => {
  const { data, error } = await supabase.from('instructors').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/instructors', async (req, res) => {
  const { firstName, lastName, email } = req.body;

  const { data, error } = await supabase
    .from('instructors')
    .insert([{
      id: crypto.randomUUID(),
      first_name: firstName,
      last_name: lastName,
      email
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// =======================
// PREFLIGHT ASSESSMENTS
// =======================
app.get('/api/preflight', async (req, res) => {
  const { data, error } = await supabase
    .from('preflight_assessments')
    .select('*')
    .order('date', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/preflight', async (req, res) => {
  const {
    studentId, aircraftId, date, time,
    fuelLeft, fuelRight, oilLevel,
    documentsOk, exteriorOk, cockpitOk, engineOk,
    squawks, airworthy, studentName
  } = req.body;

  if (!studentId || !aircraftId || !date || !studentName) {
    return res.status(400).json({ error: 'Student, aircraft, date, and signature are required' });
  }

  const { data, error } = await supabase
    .from('preflight_assessments')
    .insert([{
      id: crypto.randomUUID(),
      student_id: studentId,
      aircraft_id: aircraftId,
      date,
      time: time || null,
      fuel_left: fuelLeft ? parseFloat(fuelLeft) : null,
      fuel_right: fuelRight ? parseFloat(fuelRight) : null,
      oil_level: oilLevel || null,
      documents_ok: documentsOk,
      exterior_ok: exteriorOk,
      cockpit_ok: cockpitOk,
      engine_ok: engineOk,
      squawks: squawks || null,
      airworthy,
      student_name: studentName,
      status: 'submitted'
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// =======================
// MAINTENANCE
// =======================
app.get('/api/maintenance', async (req, res) => {
  const { data, error } = await supabase
    .from('maintenance')
    .select('*')
    .order('date', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/maintenance', async (req, res) => {
  const { aircraftId, type, description, performedBy, date, nextDue, hobbsAtService, status } = req.body;

  if (!aircraftId || !type || !date) {
    return res.status(400).json({ error: 'Aircraft, type, and date are required' });
  }

  const { data, error } = await supabase
    .from('maintenance')
    .insert([{
      id: crypto.randomUUID(),
      aircraft_id: aircraftId,
      type,
      description: description || null,
      performed_by: performedBy || null,
      date,
      next_due: nextDue || null,
      hobbs_at_service: hobbsAtService ? parseFloat(hobbsAtService) : null,
      status: status || 'completed'
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`FlightDeck server running on http://localhost:${PORT}`);
});
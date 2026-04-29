import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to generate random join code
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper function to get authenticated user
async function getAuthenticatedUser(authHeader: string | null) {
  if (!authHeader) {
    return null;
  }

  const accessToken = authHeader.split(' ')[1];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return null;
  }

  return user;
}

// Health check endpoint
app.get("/make-server-a645ae66/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/make-server-a645ae66/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role, school, joinCode } = body;

    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (role !== 'teacher' && role !== 'student') {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // For students, verify join code exists
    if (role === 'student') {
      if (!joinCode) {
        return c.json({ error: 'Join code is required for students' }, 400);
      }

      const classes = await kv.getByPrefix('class:');
      const classWithCode = classes.find((cls: any) => cls.joinCode === joinCode);
      
      if (!classWithCode) {
        return c.json({ error: 'Invalid join code' }, 400);
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name, 
        role,
        school: school || '',
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log('Error creating user during signup:', error);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile
    const userId = data.user.id;
    await kv.set(`user:${userId}`, {
      id: userId,
      email,
      name,
      role,
      school: school || '',
      createdAt: new Date().toISOString(),
    });

    // For students, add them to the class
    if (role === 'student' && joinCode) {
      const classes = await kv.getByPrefix('class:');
      const targetClass = classes.find((cls: any) => cls.joinCode === joinCode);
      
      if (targetClass) {
        // Add student to class roster
        const studentKey = `class:${targetClass.id}:student:${userId}`;
        await kv.set(studentKey, {
          userId,
          name,
          email,
          joinedAt: new Date().toISOString(),
          status: 'active',
        });
      }
    }

    return c.json({ 
      success: true,
      user: {
        id: userId,
        email,
        name,
        role,
      }
    });
  } catch (error: any) {
    console.log('Error in signup endpoint:', error);
    return c.json({ error: error.message || 'Failed to sign up' }, 500);
  }
});

// Create class endpoint (teacher only)
app.post("/make-server-a645ae66/classes/create", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!user || user.user_metadata?.role !== 'teacher') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, description, sessionLength } = body;

    if (!name) {
      return c.json({ error: 'Class name is required' }, 400);
    }

    // Generate unique join code
    let joinCode = generateJoinCode();
    let isUnique = false;
    
    while (!isUnique) {
      const existingClasses = await kv.getByPrefix('class:');
      const codeExists = existingClasses.some((cls: any) => cls.joinCode === joinCode);
      
      if (!codeExists) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
      }
    }

    const classId = crypto.randomUUID();
    const classData = {
      id: classId,
      name,
      description: description || '',
      joinCode,
      teacherId: user.id,
      sessionLength: parseInt(sessionLength) || 90,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`class:${classId}`, classData);

    return c.json({ 
      success: true,
      class: classData,
    });
  } catch (error: any) {
    console.log('Error creating class:', error);
    return c.json({ error: error.message || 'Failed to create class' }, 500);
  }
});

// Get all classes for a teacher
app.get("/make-server-a645ae66/classes", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!user || user.user_metadata?.role !== 'teacher') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const allClasses = await kv.getByPrefix('class:');
    const teacherClasses = allClasses.filter((cls: any) => 
      !cls.id.includes(':student:') && cls.teacherId === user.id
    );

    // Get student counts for each class
    const classesWithCounts = await Promise.all(
      teacherClasses.map(async (cls: any) => {
        const students = await kv.getByPrefix(`class:${cls.id}:student:`);
        return {
          ...cls,
          studentCount: students.length,
        };
      })
    );

    return c.json({ classes: classesWithCounts });
  } catch (error: any) {
    console.log('Error fetching classes:', error);
    return c.json({ error: error.message || 'Failed to fetch classes' }, 500);
  }
});

// Get class details with students
app.get("/make-server-a645ae66/classes/:classId", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!user || user.user_metadata?.role !== 'teacher') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const classId = c.req.param('classId');
    const classData = await kv.get(`class:${classId}`);

    if (!classData) {
      return c.json({ error: 'Class not found' }, 404);
    }

    if (classData.teacherId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const students = await kv.getByPrefix(`class:${classId}:student:`);

    return c.json({ 
      class: classData,
      students: students.map((s: any) => ({
        id: s.userId,
        name: s.name,
        email: s.email,
        joinedAt: s.joinedAt,
        status: s.status,
      })),
    });
  } catch (error: any) {
    console.log('Error fetching class details:', error);
    return c.json({ error: error.message || 'Failed to fetch class' }, 500);
  }
});

// Remove student from class
app.delete("/make-server-a645ae66/classes/:classId/students/:studentId", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.header('Authorization'));
    if (!user || user.user_metadata?.role !== 'teacher') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const classId = c.req.param('classId');
    const studentId = c.req.param('studentId');

    const classData = await kv.get(`class:${classId}`);
    if (!classData || classData.teacherId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await kv.del(`class:${classId}:student:${studentId}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.log('Error removing student:', error);
    return c.json({ error: error.message || 'Failed to remove student' }, 500);
  }
});

Deno.serve(app.fetch);
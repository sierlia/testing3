# Gavel Authentication System

## Overview
The Gavel application now includes a complete authentication system with role-based access control for teachers and students.

## User Flows

### Teacher Flow
1. **Landing Page** (`/`) - Visit the home page
2. **Sign Up** (`/signup`) - Select "Teacher Account"
   - Enter name, email, school, and password
   - Account is created with teacher role
3. **Teacher Dashboard** (`/teacher/dashboard`) - After login
   - View all classes
   - Create new classes
4. **Create Class** (`/teacher/create-class`)
   - Enter class details
   - System generates unique 6-character join code
5. **Class Dashboard** (`/teacher/class/:classId`)
   - Overview of class with quick links to manage features
6. **Manage Class** (`/teacher/class/:classId/manage`)
   - View student roster
   - Copy join code to share with students
   - Remove students
   - Edit class settings

### Student Flow
1. **Landing Page** (`/`) - Visit the home page
2. **Sign Up** (`/signup`) - Select "Student Account"
   - Enter name, email, and password
   - Enter 6-character join code from teacher
   - System validates code and adds student to class
3. **Onboarding** (`/onboarding`) - After signup
   - Choose constituency
   - Write personal statement
   - Select party affiliation
4. **Student Dashboard** (`/dashboard`) - Main student view
   - View announcements
   - Access quick links
   - See personal status (party, constituency, committees)

## Authentication Features

### Supabase Integration
- User authentication via Supabase Auth
- Secure password storage
- Session management
- Role-based metadata (teacher/student)

### Protected Routes
All application routes (except landing, signup, and signin) require authentication. Users are automatically redirected to signin if not authenticated.

### Backend API Endpoints

#### POST `/make-server-a645ae66/signup`
Creates a new user account (teacher or student)
- For students: validates join code before creating account
- Stores user profile in key-value store
- Adds students to class roster automatically

#### POST `/make-server-a645ae66/classes/create` (Teacher only)
Creates a new class with unique join code

#### GET `/make-server-a645ae66/classes` (Teacher only)
Returns all classes for the authenticated teacher

#### GET `/make-server-a645ae66/classes/:classId` (Teacher only)
Returns class details and student roster

#### DELETE `/make-server-a645ae66/classes/:classId/students/:studentId` (Teacher only)
Removes a student from the class

## Data Storage

### Key-Value Store Schema

**User Profile:**
```
key: user:{userId}
value: {
  id: string
  email: string
  name: string
  role: 'teacher' | 'student'
  school: string (teachers only)
  createdAt: ISO date string
}
```

**Class:**
```
key: class:{classId}
value: {
  id: string
  name: string
  description: string
  joinCode: string (6 characters)
  teacherId: string
  sessionLength: number (minutes)
  createdAt: ISO date string
}
```

**Class Student Roster:**
```
key: class:{classId}:student:{userId}
value: {
  userId: string
  name: string
  email: string
  joinedAt: ISO date string
  status: 'active' | 'inactive'
}
```

## Security Notes

⚠️ **Important:** Figma Make is designed for educational prototypes and demos, not for collecting personally identifiable information (PII) or securing sensitive data in production environments.

- Service role key is kept server-side only
- Email confirmation is automatic (no email server configured)
- Access tokens are used for API authentication
- Teacher routes verify user role before allowing access

## Usage Instructions

1. **First Time Setup:**
   - Visit the landing page
   - Click "Get Started" or "Sign Up"
   - Choose teacher or student account type

2. **Creating a Class (Teachers):**
   - Sign in to teacher account
   - Click "Create New Class"
   - Fill in class details
   - Share the generated join code with students

3. **Joining a Class (Students):**
   - Get join code from teacher
   - Create student account
   - Enter join code during signup
   - Complete onboarding process

4. **Managing Classes:**
   - Teachers can view all their classes on the dashboard
   - Click "Manage" to see student roster and settings
   - Click "Open Class" to access the class workspace

## Navigation

- **Landing Page:** Public home page with features overview
- **Sign In/Up:** Authentication pages
- **Teacher Dashboard:** Lists all classes for teacher
- **Class Dashboard:** Workspace for specific class
- **Student Dashboard:** Main interface for students with announcements and status

## Sign Out

Users can sign out from any page using the user menu in the top-right corner of the navigation bar.

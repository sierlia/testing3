import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, BookOpen, Gavel, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { SchoolSelector } from "../components/SchoolSelector";
import { SchoolOption } from "../services/schools";
import { fullNameFromParts, savePendingOAuthSignup } from "../utils/oauthSignup";
import { supabase } from "../utils/supabase";

type Role = "teacher" | "student";

type SignupFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  schools: SchoolOption[];
};

const emptyForm: SignupFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  schools: [],
};

function autofillProps(name: string) {
  return {
    name,
    autoComplete: "off",
    "data-lpignore": "true",
    "data-form-type": "other",
  };
}

function validateIdentity(formData: SignupFormState) {
  if (!formData.firstName.trim()) {
    toast.error("Enter your first name.");
    return false;
  }
  if (!formData.lastName.trim()) {
    toast.error("Enter your last name.");
    return false;
  }
  if (formData.schools.length === 0) {
    toast.error("Select at least one school.");
    return false;
  }
  return true;
}

export function SignUpPage() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  if (selectedRole === "teacher") {
    return <RoleSignUp role="teacher" onBack={() => setSelectedRole(null)} />;
  }

  if (selectedRole === "student") {
    return <RoleSignUp role="student" onBack={() => setSelectedRole(null)} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Gavel className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Gavel</h1>
          </div>
          <p className="text-gray-600">Choose your account type to get started</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="cursor-pointer border-2 transition-shadow hover:border-blue-500 hover:shadow-lg" onClick={() => setSelectedRole("teacher")}>
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <GraduationCap className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-center text-2xl">Teacher Account</CardTitle>
              <CardDescription className="text-center">Create and manage legislative simulations for your classroom</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-2 text-sm text-gray-600">
                <li>Create unlimited, highly-customizable simulations</li>
                <li>Generate join codes and invite other teachers</li>
                <li>Manage parties, committees, and caucuses</li>
                <li>Track student progress with assignments</li>
              </ul>
              <Button className="w-full" size="lg">
                Sign Up as Teacher
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer border-2 transition-shadow hover:border-green-500 hover:shadow-lg" onClick={() => setSelectedRole("student")}>
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <BookOpen className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-center text-2xl">Student Account</CardTitle>
              <CardDescription className="text-center">Join your class simulation and participate in the legislative process</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-2 text-sm text-gray-600">
                <li>Join with a class code</li>
                <li>Choose your constituency and party</li>
                <li>Draft and cosponsor bills</li>
                <li>Participate in committees, caucuses, and elections</li>
                <li>Vote on legislation</li>
              </ul>
              <Button className="w-full" size="lg" variant="outline">
                Sign Up as Student
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link to="/signin" className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-600 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function RoleSignUp({ role, onBack }: { role: Role; onBack: () => void }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const isTeacher = role === "teacher";
  const title = isTeacher ? "Create Teacher Account" : "Create Student Account";
  const description = isTeacher ? "Set up your account to start creating simulations" : "Create your account first, then join a class with a code";
  const redirectPath = isTeacher ? "/classes" : "/join-class";
  const displayName = fullNameFromParts(formData.firstName, formData.lastName);

  const setField = <K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateIdentity(formData)) return;
    if (formData.password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (formData.password !== formData.confirmPassword) return toast.error("Passwords do not match.");

    setLoading(true);
    try {
      const userMetadata = {
        name: displayName,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        role,
        schools: formData.schools,
        school: formData.schools.map((school) => school.name).join(", "),
      };

      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: { data: userMetadata },
      });
      if (error) throw error;

      if (role === "student" && data.user?.id) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          user_id: data.user.id,
          role: "student",
          display_name: displayName,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          schools: formData.schools,
        } as any);
        if (profileError) throw profileError;
      }

      toast.success("Account created successfully!");
      navigate(redirectPath);
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!validateIdentity(formData)) return;
    setGoogleLoading(true);
    try {
      savePendingOAuthSignup({
        role,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        schools: formData.schools,
        redirectPath,
      });
      const redirectTo = `${window.location.origin}${window.location.pathname}#${redirectPath}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to start Google sign up");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-lg">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full ${isTeacher ? "bg-blue-100" : "bg-green-100"}`}>
              {isTeacher ? <GraduationCap className="h-6 w-6 text-blue-600" /> : <BookOpen className="h-6 w-6 text-green-600" />}
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${role}-first-name`}>First Name</Label>
                  <Input
                    id={`${role}-first-name`}
                    placeholder="Jane"
                    value={formData.firstName}
                    onChange={(event) => setField("firstName", event.target.value)}
                    required
                    {...autofillProps(`gavel_${role}_given_name`)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${role}-last-name`}>Last Name</Label>
                  <Input
                    id={`${role}-last-name`}
                    placeholder="Smith"
                    value={formData.lastName}
                    onChange={(event) => setField("lastName", event.target.value)}
                    required
                    {...autofillProps(`gavel_${role}_family_name`)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${role}-schools`}>School(s)</Label>
                <SchoolSelector
                  id={`${role}-schools`}
                  value={formData.schools}
                  onChange={(schools) => setField("schools", schools)}
                  placeholder="Search accredited schools..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${role}-email`}>Email</Label>
                <Input
                  id={`${role}-email`}
                  type="email"
                  placeholder="you@school.edu"
                  value={formData.email}
                  onChange={(event) => setField("email", event.target.value)}
                  required
                  {...autofillProps(`gavel_${role}_contact`)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${role}-password`}>Password</Label>
                <Input
                  id={`${role}-password`}
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(event) => setField("password", event.target.value)}
                  required
                  minLength={8}
                  name={`gavel_${role}_new_secret`}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${role}-confirm-password`}>Confirm Password</Label>
                <Input
                  id={`${role}-confirm-password`}
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(event) => setField("confirmPassword", event.target.value)}
                  required
                  minLength={8}
                  name={`gavel_${role}_new_secret_confirm`}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading ? "Creating Account..." : title}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium uppercase text-gray-500">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <GoogleAuthButton onClick={() => void handleGoogleSignUp()} loading={googleLoading} disabled={loading}>
              Sign up with Google
            </GoogleAuthButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

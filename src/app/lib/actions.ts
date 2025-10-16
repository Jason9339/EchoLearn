'use server';

import { signIn, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// ...

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function registerAction(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    const raw = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    };
    const parsed = RegisterSchema.safeParse(raw);
    if (!parsed.success) return 'Invalid form data.';

    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim();
    const password = parsed.data.password;

    // Check if email already exists
    const existing = await sql/*sql*/ `
      SELECT id FROM users WHERE email=${email} LIMIT 1
    `;
    if (existing.length > 0) return 'Email is already registered.';

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    await sql/*sql*/ `
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashed})
    `;

    // Auto sign-in after registration
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    });
  } catch (err) {
    // NEXT_REDIRECT is thrown by signIn on success, so we need to re-throw it
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof err.digest === 'string' &&
      err.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw err;
    }
    if (err instanceof AuthError) {
      return 'Auto sign-in failed after registration.';
    }
    console.error('[registerAction] error:', err);
    return 'Something went wrong.';
  }
}

export async function updateUserInfo(
  studentId: string,
  gender: string,
  age: number,
  consent: boolean
) {
  const session = await auth();
  if (!session?.user?.email) {
    return { message: 'Unauthorized' };
  }

  if (!studentId || !gender || !age || consent === undefined) {
    return { message: 'Missing required fields' };
  }

  try {
    await sql`
      UPDATE users
      SET student_id = ${studentId},
          gender = ${gender},
          age = ${age},
          consent = ${consent}
      WHERE email = ${session.user.email}
    `;

    return { message: 'User information saved successfully' };
  } catch (error) {
    console.error('Failed to save user information:', error);
    return { message: 'Failed to save user information' };
  }
}

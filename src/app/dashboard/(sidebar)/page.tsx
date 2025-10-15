
import UserInfoModal from '@/app/ui/dashboard/user-info-modal';
import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function getUser(mail: string) {
  try {
    const user = await sql`SELECT * FROM users WHERE email = ${mail}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export default async function DashboardPage() {
  const session = await auth();
  // console.log('Session:', session);
  if (!session?.user?.email) {
    return <p>Unauthorized</p>;
  }

  const user = await getUser(session.user.email);

  const isInfoSubmitted = user?.student_id && user?.consent;

  return (
    <div>
      <p>Dashboard Page</p>
      {!isInfoSubmitted && <UserInfoModal />}
    </div>
  );
}

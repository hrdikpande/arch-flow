import { redirect } from 'next/navigation';
import { currentAccess } from '@/lib/access';

export default async function Home() {
  const access = await currentAccess();
  if (!access) redirect('/login');
  redirect(access.isClient ? '/portal' : '/dashboard');
}

import { NextResponse } from 'next/server';
import { DEMO_PATIENTS, DEMO_DOCTORS } from '@/lib/mock-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const allUsers = [...DEMO_PATIENTS, ...DEMO_DOCTORS];
  const user = userId ? allUsers.find((u) => u.id === userId) : allUsers[0];

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user,
    availableUsers: allUsers,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    const allUsers = [...DEMO_PATIENTS, ...DEMO_DOCTORS];
    const user = allUsers.find((u) => u.id === userId);

    if (!user) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user,
      message: `Active session switched to ${user.fullName} (${user.role})`,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

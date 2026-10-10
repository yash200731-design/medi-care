import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { StorageService } from '@/lib/storage/service';
import { INITIAL_RECORDS } from '@/lib/mock-data';

export async function GET(request: Request) {
  try {
    // 1. Enforce authenticated session
    const user = await requireAuth(request);

    // 2. Verify short-lived signed URL and cross-patient boundary
    const { searchParams } = new URL(request.url);
    const verification = await StorageService.verifyAndAuthorizeDownload(searchParams, user);

    if (!verification.authorized) {
      return NextResponse.json(
        { error: verification.error, message: verification.message },
        { status: verification.statusCode }
      );
    }

    // 3. Resolve the medical document
    const storagePath = verification.path!;
    const record = INITIAL_RECORDS.find((r) => r.storagePath === storagePath);

    const content = record?.contentPreview || 'MEDIVAULT ENCRYPTED MEDICAL RECORD ARCHIVE';
    const filename = record?.fileName || 'medical_record.txt';

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Storage download error.' }, { status: 500 });
  }
}

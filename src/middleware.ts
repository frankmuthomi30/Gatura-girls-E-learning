import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Public routes
  if (pathname === '/login' || pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, must_change_pin')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (profile.must_change_pin) {
          return NextResponse.redirect(new URL('/change-pin', request.url));
        }
        return NextResponse.redirect(new URL(`/${profile.role}`, request.url));
      }
    }
    return response;
  }

  // Change PIN route — must be logged in
  if (pathname === '/change-pin') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // Protected routes — must be logged in
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Get user profile for role-based access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, must_change_pin')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Force PIN change on first login
  if (profile.must_change_pin && pathname !== '/change-pin') {
    return NextResponse.redirect(new URL('/change-pin', request.url));
  }

  // Role-based route protection
  if (pathname.startsWith('/admin') && profile.role !== 'admin') {
    return NextResponse.redirect(new URL(`/${profile.role}`, request.url));
  }
  if (pathname.startsWith('/teacher') && profile.role !== 'teacher') {
    return NextResponse.redirect(new URL(`/${profile.role}`, request.url));
  }
  if (pathname.startsWith('/student') && profile.role !== 'student') {
    return NextResponse.redirect(new URL(`/${profile.role}`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/change-pin',
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
  ],
};

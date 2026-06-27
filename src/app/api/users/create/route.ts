import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // Verify the requesting user is admin
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, email, role, password } = await request.json()

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create auth user with admin client
    const adminSupabase = await createAdminClient()
    const { data: newAuthUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // The trigger will auto-create the user profile, but update name and role
    await adminSupabase.from('users').upsert({
      id: newAuthUser.user.id,
      name,
      email,
      role,
    })

    return NextResponse.json({ success: true, userId: newAuthUser.user.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

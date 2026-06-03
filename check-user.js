import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ejxlhstosdrryzrmfsbm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTAwOSwiZXhwIjoyMDg1MjM3MDA5fQ.5QufE_HepUm3JGNbub053c5j-jgjjLrtTYQPXJDIHN0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    console.log('Checking users...');
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('Found users:', users.users.length);
    for (const user of users.users) {
        console.log(`User: ${user.email} (${user.id})`);
        // Check user profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*, company:companies(*)')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.log('  Error fetching profile:', profileError.message);
        } else {
            console.log('  Profile:', profile ? `Company ID: ${profile.company_id}` : 'No profile');
            if (profile && profile.company) {
                console.log('  Company Name:', profile.company.name);
            }
        }
    }
}

checkUsers();

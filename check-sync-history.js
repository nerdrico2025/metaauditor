
const supabaseUrl = "https://ejxlhstosdrryzrmfsbm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTAwOSwiZXhwIjoyMDg1MjM3MDA5fQ.5QufE_HepUm3JGNbub053c5j-jgjjLrtTYQPXJDIHN0";

const url = `${supabaseUrl}/rest/v1/sync_history?select=*&order=started_at.desc&limit=1`;

console.log("Fetching sync history...");

fetch(url, {
    method: "GET",
    headers: {
        "Authorization": `Bearer ${key}`,
        "apikey": key,
        "Content-Type": "application/json"
    }
})
    .then(async res => {
        if (!res.ok) {
            console.error("Error fetching history:", res.status, res.statusText);
            const text = await res.text();
            console.error(text);
            return;
        }
        const json = await res.json();
        console.log("Latest Sync History:");
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => console.error("Fetch Error:", err));

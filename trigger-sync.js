const url = "https://ejxlhstosdrryzrmfsbm.supabase.co/functions/v1/sync-meta-data";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2MTAwOSwiZXhwIjoyMDg1MjM3MDA5fQ.5QufE_HepUm3JGNbub053c5j-jgjjLrtTYQPXJDIHN0";

console.log("Starting sync...");

fetch(url, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        sync_type: "full",
        integration_id: "a64bb72f-dce0-4e59-8a95-466ec485bd37"
    })
})
    .then(async res => {
        const text = await res.text();
        console.log("Response Status:", res.status);
        try {
            const json = JSON.parse(text);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log("Response Body:", text);
        }
    })
    .catch(err => console.error("Fetch Error:", err));

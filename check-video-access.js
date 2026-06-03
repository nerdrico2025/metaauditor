import fs from 'fs';

const TOKEN = "EAASrXDclkKMBQnYcJN6V8HExACleZANZAocf4DhhqM5BE0mq18GuD5HiRMB6O557QBXowVlWlYmFop92I2EnX8FpJw3ZCdBTDnS3P6ZCXLHzOjhYVGfdY06CLK1e7ZA7yDOtVkClyDtb9QcPD8MxLx2dtRdHrI32FpgLi4w5aLu2l3ZBMh9kztnZBW8BrFE";
const VIDEO_ID = "659331509743440"; // From Step 667
const BASE_URL = "https://graph.facebook.com/v24.0"; // From current API version

async function checkVideo() {
    try {
        console.log(`Checking video: ${VIDEO_ID}`);

        const url = `${BASE_URL}/?ids=${VIDEO_ID}&fields=source,permalink_url,published,format`;
        console.log("Fetching:", url);

        const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
        const data = await res.json();

        console.log("Response Status:", res.status);
        fs.writeFileSync('video_response.json', JSON.stringify(data, null, 2));
        console.log("Response saved to video_response.json");

        // 2. Try fetching as AdVideo specifically if needed? No, /ids should work.
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

checkVideo();

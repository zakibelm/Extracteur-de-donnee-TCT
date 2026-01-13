
async function testLiveAuth() {
    console.log("Testing live signup...");
    try {
        const response = await fetch('https://extracteur-de-donnee-tct.vercel.app/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'signup',
                numDome: 'DEBUG001',
                employeeId: 'DEBUGEMP001',
                email: 'debug.auth@example.com',
                password: 'password123',
                accountType: 'driver',
                telephone: '1234567890'
            })
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Headers:", Object.fromEntries(response.headers.entries()));
        console.log("Response Body:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Script error:", e);
    }
}

testLiveAuth();

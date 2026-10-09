document.addEventListener('DOMContentLoaded', async () => {

    // PRODUCTION ENDPOINTS
    const RENDER_API = 'https://wifi-api-1.onrender.com';
    const N8N_PRODUCTION_WEBHOOK = 'https://n8n.kabisakabisa.store/webhook/customer-select-plan';

    let capturedMac = null;

    // 1. STRICT MAC ADDRESS CAPTURE (NO FAKE / MOCK FALLBACKS)
    function captureHardwareMac() {
        const macDisplay = document.getElementById('mac-display');
        const urlParams = new URLSearchParams(window.location.search);

        // Check standard router redirect query parameters
        const rawMac = urlParams.get('mac') || urlParams.get('client_mac') || urlParams.get('usermac');
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

        // Validate MAC format and ensure it isn't the Router's own LAN MAC
        if (rawMac && macRegex.test(rawMac) && rawMac.toUpperCase() !== 'FC:3F:FC:AF:92:F0') {
            capturedMac = rawMac.toUpperCase().replace(/-/g, ':');
            localStorage.setItem('valid_device_mac', capturedMac);
            macDisplay.textContent = capturedMac;
            macDisplay.style.color = '#16a34a'; // Green indicator
            return true;
        }

        // Check if a valid hardware MAC was saved in this browser session
        const storedMac = localStorage.getItem('valid_device_mac');
        if (storedMac && macRegex.test(storedMac) && storedMac.toUpperCase() !== 'FC:3F:FC:AF:92:F0') {
            capturedMac = storedMac;
            macDisplay.textContent = capturedMac;
            macDisplay.style.color = '#16a34a';
            return true;
        }

        // Prompt user if hardware MAC cannot be extracted automatically
        const userPromptMac = prompt("Device Wi-Fi MAC required to activate connection.\nPlease enter your device MAC address (Found in Phone Settings -> About Phone -> Status):");
        if (userPromptMac && macRegex.test(userPromptMac.trim())) {
            capturedMac = userPromptMac.trim().toUpperCase().replace(/-/g, ':');
            localStorage.setItem('valid_device_mac', capturedMac);
            macDisplay.textContent = capturedMac;
            macDisplay.style.color = '#16a34a';
            return true;
        }

        // FAIL-SAFE: Rejects mock data completely
        capturedMac = null;
        macDisplay.textContent = "MAC NOT VERIFIED (CONNECT VIA WI-FI PORTAL)";
        macDisplay.style.color = '#cc3333'; // Red indicator
        return false;
    }

    // 2. CHECK ACTIVE ACCESS STATUS VIA RENDER BACKEND
    async function checkCurrentAccess() {
        if (!capturedMac) return;

        try {
            const res = await fetch(`${RENDER_API}/check-access?mac=${capturedMac}`);
            const data = await res.json();

            if (data.access === 'granted') {
                const statusMsg = document.getElementById('status-message');
                statusMsg.style.color = '#16a34a';
                statusMsg.textContent = 'Active Internet Session Found! Redirecting...';

                setTimeout(() => {
                    window.location.href = 'https://www.google.com';
                }, 1500);
            }
        } catch (err) {
            console.error("Render access check failed:", err);
        }
    }

    // Initialize capture and access check
    const hasValidMac = captureHardwareMac();
    if (hasValidMac) {
        await checkCurrentAccess();
    }

    // 3. HERO SLIDER CYCLE
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;

    setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 3500);

    // 4. PLAN SELECTION LOGIC
    let selectedPlan = '24H';
    const planNameDisplay = document.getElementById('selected-plan-name');
    const planCards = document.querySelectorAll('.plan-card');

    planCards.forEach(card => {
        const btn = card.querySelector('.select-plan-btn');

        btn.addEventListener('click', () => {
            planCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            selectedPlan = card.dataset.plan;
            const price = card.dataset.price;
            const title = card.dataset.title;

            planNameDisplay.textContent = `${title} — KES ${price}`;
            document.getElementById('checkout-section').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // 5. PAYMENT FORM SUBMISSION (TRIGGER N8N WORKFLOW 1)
    const form = document.getElementById('payment-form');
    const statusMsg = document.getElementById('status-message');
    const payBtn = document.getElementById('pay-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Enforce payment block if MAC address is missing or invalid
        if (!capturedMac) {
            statusMsg.style.color = '#cc3333';
            statusMsg.innerHTML = '<strong>Security Alert:</strong> Device hardware MAC address could not be verified. Please reconnect to the Wi-Fi network and try again.';
            return;
        }

        const phoneInput = document.getElementById('phone').value.trim();

        payBtn.disabled = true;
        statusMsg.style.color = '#cc3333';
        statusMsg.textContent = 'Initiating M-Pesa STK Push prompt...';

        try {
            const response = await fetch(N8N_PRODUCTION_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: selectedPlan,
                    phone: phoneInput,
                    mac_address: capturedMac
                })
            });

            if (response.ok) {
                statusMsg.style.color = '#16a34a';
                statusMsg.textContent = 'STK Push sent! Please enter your M-Pesa PIN on your phone to connect.';
            } else {
                throw new Error('STK Push failed');
            }
        } catch (error) {
            statusMsg.style.color = '#cc3333';
            statusMsg.textContent = 'Network error. Please verify your phone number and try again.';
            payBtn.disabled = false;
        }
    });
});
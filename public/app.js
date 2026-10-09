document.addEventListener('DOMContentLoaded', async () => {
    
    const RENDER_API = 'https://wifi-api-1.onrender.com';
    const N8N_PRODUCTION_WEBHOOK = 'https://n8n.kabisakabisa.store/webhook/customer-select-plan';

    let capturedMac = null;

    // 1. EXTRACT REAL HARDWARE MAC ONLY (STRICT PRODUCTION CHECK)
    function captureProductionMac() {
        const macDisplay = document.getElementById('mac-display');
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check standard router parameters: ?mac=, ?client_mac=, or ?usermac=
        const rawMac = urlParams.get('mac') || urlParams.get('client_mac') || urlParams.get('usermac');

        // Regex pattern for valid MAC address format (XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

        if (rawMac && macRegex.test(rawMac)) {
            capturedMac = rawMac.toUpperCase().replace(/-/g, ':');
            localStorage.setItem('valid_device_mac', capturedMac);
            macDisplay.textContent = capturedMac;
            macDisplay.style.color = '#16a34a'; // Green indicator
            return true;
        }

        // Check if device previously stored a valid hardware MAC in this browser session
        const storedMac = localStorage.getItem('valid_device_mac');
        if (storedMac && macRegex.test(storedMac)) {
            capturedMac = storedMac;
            macDisplay.textContent = capturedMac;
            macDisplay.style.color = '#16a34a';
            return true;
        }

        // NO VALID HARDWARE MAC FOUND: DO NOT MOCK OR FALLBACK!
        capturedMac = null;
        macDisplay.textContent = "MAC NOT DETECTED (CONNECT VIA WI-FI PORTAL)";
        macDisplay.style.color = '#cc3333'; // Red alert indicator
        return false;
    }

    // 2. CHECK ACCESS AGAINST RENDER BACKEND
    async function checkCurrentAccess() {
        if (!capturedMac) return;

        try {
            const res = await fetch(`${RENDER_API}/check-access?mac=${capturedMac}`);
            const data = await res.json();

            if (data.access === 'granted') {
                const statusMsg = document.getElementById('status-message');
                statusMsg.style.color = '#16a34a';
                statusMsg.textContent = 'Active Internet Session Found! Granting connection...';

                setTimeout(() => {
                    window.location.href = 'https://www.google.com';
                }, 1500);
            }
        } catch (err) {
            console.error("Render access check failed:", err);
        }
    }

    const hasValidMac = captureProductionMac();
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

    // 4. PLAN SELECTION
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

    // 5. SUBMIT PAYMENT (STRICT BLOCK IF MAC IS MISSING)
    const form = document.getElementById('payment-form');
    const statusMsg = document.getElementById('status-message');
    const payBtn = document.getElementById('pay-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // FAIL-SAFE: Block payment processing if real MAC is absent
        if (!capturedMac) {
            statusMsg.style.color = '#cc3333';
            statusMsg.innerHTML = '<strong>Security Error:</strong> Device physical MAC address could not be verified by the Wi-Fi gateway. Please disconnect and reconnect to the Wi-Fi network.';
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
                    mac_address: capturedMac // ALWAYS A REAL VERIFIED MAC
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
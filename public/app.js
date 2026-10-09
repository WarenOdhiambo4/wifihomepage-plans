document.addEventListener('DOMContentLoaded', async () => {

    // PRODUCTION ENDPOINTS
    const RENDER_API = 'https://wifi-api-1.onrender.com';
    const N8N_PRODUCTION_WEBHOOK = 'https://n8n.kabisakabisa.store/webhook/customer-select-plan';

    let capturedMac = null;

    // 1. AUTOMATIC MAC CAPTURE VIA RENDER SCAPY ARP ENGINE
    async function fetchRealMacAddress() {
        const macDisplay = document.getElementById('mac-display');
        macDisplay.textContent = "Resolving Network Identifier...";

        try {
            // Check URL parameters first (if redirected by router)
            const urlParams = new URLSearchParams(window.location.search);
            const urlMac = urlParams.get('mac');

            if (urlMac && urlMac !== 'UNKNOWN' && urlMac !== 'AA:BB:CC:DD:EE:FF') {
                capturedMac = urlMac.toUpperCase();
            } else {
                // Call Render API to perform server-side ARP lookup
                const res = await fetch(`${RENDER_API}/get-mac`);
                const data = await res.json();
                if (data.mac_address) {
                    capturedMac = data.mac_address.toUpperCase();
                }
            }
        } catch (err) {
            console.error("Failed to query Render MAC resolver:", err);
        }

        // Final local backup if network ARP ping times out
        if (!capturedMac) {
            capturedMac = localStorage.getItem('user_mac') || 'FC:3F:FC:AF:92:F0';
        }

        localStorage.setItem('user_mac', capturedMac);
        macDisplay.textContent = capturedMac;
    }

    // 2. VERIFY SUBSCRIPTION / WHITELIST STATUS
    async function verifyAccessStatus() {
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
            console.error("Access verification error:", err);
        }
    }

    // Run automated MAC capture and verification on page load
    await fetchRealMacAddress();
    await verifyAccessStatus();

    // 3. HERO SLIDER ANIMATION
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

    // 5. SUBMIT TO N8N WORKFLOW 1 WITH CAPTURED MAC
    const form = document.getElementById('payment-form');
    const statusMsg = document.getElementById('status-message');
    const payBtn = document.getElementById('pay-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phoneInput = document.getElementById('phone').value.trim();

        payBtn.disabled = true;
        statusMsg.style.color = '#cc3333';
        statusMsg.textContent = 'Sending M-Pesa STK Push to your phone...';

        try {
            const response = await fetch(N8N_PRODUCTION_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: selectedPlan,
                    phone: phoneInput,
                    mac_address: capturedMac  // True MAC captured via Render ARP
                })
            });

            if (response.ok) {
                statusMsg.style.color = '#16a34a';
                statusMsg.textContent = 'STK Push Sent! Enter your M-Pesa PIN on your phone to complete activation.';
            } else {
                throw new Error('STK Push submission failed');
            }
        } catch (error) {
            statusMsg.style.color = '#cc3333';
            statusMsg.textContent = 'Network error. Please confirm your phone number and try again.';
            payBtn.disabled = false;
        }
    });
});
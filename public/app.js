document.addEventListener('DOMContentLoaded', async () => {
    
    // CONFIGURATION
    const RENDER_API = 'https://wifi-api-yxh4.onrender.com';
    const N8N_PRODUCTION_WEBHOOK = 'https://n8n.kabisakabisa.store/webhook/customer-select-plan';
    const LOCAL_PYTHON_AGENT = 'http://192.168.1.50:5000/get-mac'; // Your local Scapy agent IP

    let resolvedMac = null;

    // 1. MAC RESOLUTION (PYTHON LOCAL AGENT PROXY -> URL QUERY PARAM -> FALLBACK)
    async function detectHardwareMac() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlMac = urlParams.get('mac');

        if (urlMac && urlMac !== 'UNKNOWN' && urlMac !== 'AA:BB:CC:DD:EE:FF') {
            resolvedMac = urlMac;
            console.log("MAC captured from Router URL parameter:", resolvedMac);
        } else {
            // Call Python Agent on local Wi-Fi subnet
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

                const agentRes = await fetch(LOCAL_PYTHON_AGENT, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (agentRes.ok) {
                    const data = await agentRes.json();
                    if (data.mac_address) {
                        resolvedMac = data.mac_address;
                        console.log("MAC resolved via Python Scapy Agent:", resolvedMac);
                    }
                }
            } catch (err) {
                console.warn("Local Python ARP agent unreachable. Using fallback.", err);
            }
        }

        // Final fallback if local ARP agent or router parameter is absent
        if (!resolvedMac) {
            resolvedMac = localStorage.getItem('user_mac') || 'FC:3F:FC:AF:92:F0';
        }

        localStorage.setItem('user_mac', resolvedMac);
        document.getElementById('mac-display').textContent = resolvedMac;
    }

    // 2. CHECK ACCESS AGAINST RENDER BACKEND
    async function checkCurrentAccess() {
        if (!resolvedMac) return;

        try {
            const res = await fetch(`${RENDER_API}/check-access?mac=${resolvedMac}`);
            const data = await res.json();

            if (data.access === 'granted') {
                const statusMsg = document.getElementById('status-message');
                statusMsg.style.color = '#16a34a';
                statusMsg.textContent = 'Active Subscription Found! Granting Internet Access...';
                
                setTimeout(() => {
                    window.location.href = 'https://www.google.com';
                }, 2000);
            }
        } catch (err) {
            console.error("Render access check failed:", err);
        }
    }

    // Initialize detection
    await detectHardwareMac();
    await checkCurrentAccess();

    // 3. HERO SLIDER LOGIC
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

    // 5. M-PESA PAYMENT SUBMISSION (N8N PRODUCTION WEBHOOK)
    const form = document.getElementById('payment-form');
    const statusMsg = document.getElementById('status-message');
    const payBtn = document.getElementById('pay-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
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
                    mac_address: resolvedMac
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
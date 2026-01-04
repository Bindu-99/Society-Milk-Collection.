(function(){
  const form = document.getElementById('collectionForm');
  const messages = document.getElementById('messages');
  const reportTableBody = document.querySelector('#reportTable tbody');
  const filterDate = document.getElementById('filterDate');
  const refreshBtn = document.getElementById('refreshBtn');
  const milkType = document.getElementById('milk_type');
  const fatHint = document.getElementById('fatHint');
  const snfHint = document.getElementById('snfHint');
  const logoutBtn = document.getElementById('logoutBtn');

  let limits = null;

  function setTodayDefaults(){
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dd = String(today.getDate()).padStart(2,'0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) dateInput.value = iso;
    if (filterDate && !filterDate.value) filterDate.value = iso;
  }

  async function authFetch(input, init){
    const res = await fetch(input, init);
    if (res.status === 401){
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    return res;
  }

  function showMessages(list, type='error'){
    messages.innerHTML = '';
    if (!list || !list.length) return;
    list.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${type}`;
      div.textContent = msg;
      messages.appendChild(div);
    });
  }

  async function loadConfig(){
    try {
      const res = await authFetch('/api/config');
      limits = await res.json();
      updateHints();
    } catch (e) {
      // ignore
    }
  }

  function updateHints(){
    if (!limits) return;
    const type = milkType.value;
    const lim = limits.limits[type];
    fatHint.textContent = `Allowed FAT: ${lim.fat.min} - ${lim.fat.max}`;
    snfHint.textContent = `Allowed SNF: ${lim.snf.min} - ${lim.snf.max}`;
  }

  async function fetchReports(){
    const params = new URLSearchParams();
    if (filterDate.value) params.set('date', filterDate.value);
    const res = await authFetch('/api/collections?' + params.toString());
    const rows = await res.json();
    renderTable(rows);
  }

  function renderTable(rows){
    reportTableBody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${r.session}</td>
        <td>${r.farmer_name ? r.farmer_name : r.farmer_id}</td>
        <td>${r.milk_type}</td>
        <td>${Number(r.fat).toFixed(1)}</td>
        <td>${Number(r.snf).toFixed(1)}</td>
        <td>${Number(r.quantity).toFixed(2)}</td>
        <td>₹ ${Number(r.rate_per_liter).toFixed(2)}</td>
        <td>₹ ${Number(r.amount).toFixed(2)}</td>
      `;
      reportTableBody.appendChild(tr);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessages([]);

    const data = Object.fromEntries(new FormData(form).entries());

    // client-side checks
    const errs = [];
    if (!data.date) errs.push('Date is required');
    if (!['Morning','Evening'].includes(data.session)) errs.push('Session is invalid');
    if (!['Cow','Buffalo'].includes(data.milk_type)) errs.push('Milk Type is invalid');
    if (!data.farmer_id) errs.push('Farmer ID is required');

    const fat = Number(data.fat);
    const snf = Number(data.snf);
    const qty = Number(data.quantity);

    if (!(Number.isFinite(fat))) errs.push('FAT must be a number');
    if (!(Number.isFinite(snf))) errs.push('SNF must be a number');
    if (!(Number.isFinite(qty))) errs.push('Quantity must be a number');
    if (Number.isFinite(qty) && qty <= 0) errs.push('Quantity must be greater than zero');

    if (limits) {
      const lim = limits.limits[data.milk_type];
      if (Number.isFinite(fat) && (fat < lim.fat.min || fat > lim.fat.max)) errs.push(`FAT must be within ${lim.fat.min}-${lim.fat.max}`);
      if (Number.isFinite(snf) && (snf < lim.snf.min || snf > lim.snf.max)) errs.push(`SNF must be within ${lim.snf.min}-${lim.snf.max}`);
    }

    if (errs.length){
      showMessages(errs, 'error');
      return;
    }

    try {
      const res = await authFetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data.date,
          session: data.session,
          milk_type: data.milk_type,
          farmer_id: data.farmer_id,
          farmer_name: data.farmer_name || '',
          fat: fat,
          snf: snf,
          quantity: qty
        })
      });
      if (!res.ok){
        const payload = await res.json().catch(()=>({errors:['Failed'] }));
        showMessages(payload.errors || [payload.error || 'Failed to save'], 'error');
      } else {
        showMessages(['Saved successfully'], 'success');
        form.reset();
        setTodayDefaults();
        updateHints();
        await fetchReports();
      }
    } catch (e) {
      showMessages(['Network error. Please try again.'], 'error');
    }
  });

  milkType.addEventListener('change', updateHints);
  refreshBtn.addEventListener('click', fetchReports);

  if (logoutBtn){
    logoutBtn.addEventListener('click', async () => {
      try{
        await fetch('/auth/logout', { method: 'POST' });
      } finally {
        window.location.href = '/login';
      }
    });
  }

  setTodayDefaults();
  loadConfig();
  fetchReports();
})();

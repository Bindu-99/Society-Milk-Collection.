(function(){
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const messages = document.getElementById('messages');

  function showMessages(list, type='error'){
    if (!messages) return;
    messages.innerHTML = '';
    if (!list || !list.length) return;
    list.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${type}`;
      div.textContent = msg;
      messages.appendChild(div);
    });
  }

  if (loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(loginForm).entries());
      try {
        const res = await fetch('/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) {
          const j = await res.json().catch(()=>({error:'Login failed'}));
          showMessages([j.error || 'Login failed'], 'error');
          return;
        }
        window.location.href = '/';
      } catch (e) {
        showMessages(['Network error'], 'error');
      }
    });
  }

  if (signupForm){
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(signupForm).entries());
      try {
        const res = await fetch('/auth/signup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) {
          const j = await res.json().catch(()=>({error:'Signup failed'}));
          showMessages([j.error || 'Signup failed'], 'error');
          return;
        }
        window.location.href = '/';
      } catch (e) {
        showMessages(['Network error'], 'error');
      }
    });
  }
})();

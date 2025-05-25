// src/js/login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.textContent = '';
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const result = await window.electronAPI.login({ email, password });
            if (result.success) {
                localStorage.setItem('auth.token', result.token);
                localStorage.setItem('auth.email', result.user.email);
                localStorage.setItem('auth.name', result.user.nama);

                // Simpan kelas ke localStorage
                localStorage.setItem('auth.kelas', JSON.stringify(result.kelas));

                window.electronAPI.navigate('selection'); // Navigate to selection page
            } else {
                errorMessage.textContent = result.message || 'Login failed.';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'An error occurred during login.';
        }
    });
});